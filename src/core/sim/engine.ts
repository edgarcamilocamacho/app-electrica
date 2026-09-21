import type { NetId } from '../connectivity/nets';
import { UnionFind } from '../connectivity/unionFind';
import type { CircuitDocument, Id } from '../model/types';
import type { Registry } from '../registry/types';
import { buildSimModel, type SimDevice, type SimModel } from './model';

/**
 * Motor de simulación por eventos discretos (PLAN §9–§10).
 *
 *  · El tiempo es un número (`clockMs`) que empuja quien llama: nunca se lee el reloj del sistema.
 *  · `solve` fusiona redes por los dispositivos que conducen, inyecta identidades de fuente y
 *    detecta los tres cortos (dos fases; fase y neutro, de la misma fuente o de otra).
 *  · `settle` busca el punto fijo instantáneo; si un estado se repite, es una oscilación.
 *  · Los timers cambian de estado dentro de `settle`, pero solo se agendan eventos al converger.
 *  · Ante una falla todo se congela (modo 'error') y ya no se procesa nada.
 */

export type SourceId = Id;
export type LineId = `${string}:${number}`;

export type NetPotential =
  | { readonly kind: 'floating' }
  | { readonly kind: 'line'; readonly sources: readonly SourceId[] }
  | { readonly kind: 'neutral'; readonly sources: readonly SourceId[] }
  | { readonly kind: 'short' };

export type Fault =
  | {
      readonly kind: 'short';
      readonly reason: 'phase-phase' | 'phase-neutral';
      readonly nets: readonly NetId[];
      readonly sources: readonly Id[];
      readonly components: readonly Id[];
      readonly lineSources: readonly Id[];
      readonly neutralSources: readonly Id[];
    }
  | {
      readonly kind: 'oscillation';
      readonly reason: 'instantaneous' | 'timed-loop';
      readonly components: readonly Id[];
      /** Secuencia de cambios del ciclo: qué dispositivo pasó a qué estado. */
      readonly sequence: readonly { readonly componentId: Id; readonly on: boolean }[];
      readonly nets: readonly NetId[];
    };

interface TimerRuntime {
  running: boolean;
  /** TON: tiempo cumplido con la entrada todavía activa. TOF: salida sostenida. */
  held: boolean;
  output: boolean;
  startedAt: number;
  token?: number;
}

interface TimerEvent {
  readonly time: number;
  readonly seq: number;
  readonly timerId: Id;
  readonly token: number;
}

export interface TimerView {
  readonly phase: 'idle' | 'running' | 'done';
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly presetMs: number;
  readonly output: boolean;
  readonly input: boolean;
}

export interface DeviceView {
  readonly conducting?: boolean;
  readonly energized?: boolean;
  readonly actuated?: boolean;
  readonly position?: 0 | 1 | 2;
  readonly timer?: TimerView;
  /** Carga con fase de una fuente y neutro de otra: no enciende (R2 §9). */
  readonly mismatchedSupply?: boolean;
}

export interface SimSnapshot {
  readonly clockMs: number;
  readonly mode: 'running' | 'error';
  readonly fault?: Fault;
  readonly netPotentials: ReadonlyMap<NetId, NetPotential>;
  readonly devices: ReadonlyMap<Id, DeviceView>;
}

export const MAX_SETTLE_ITERATIONS = 1000;
export const MAX_EVENTS_SAME_INSTANT = 1000;
export const MAX_EVENTS_PER_ADVANCE = 20_000;

interface Potential {
  lines: Set<LineId>;
  neutrals: Set<SourceId>;
}

interface Solution {
  uf: UnionFind;
  pot: Map<string, Potential>;
  shortRoot?: string;
  shortReason?: 'phase-phase' | 'phase-neutral';
}

export class SimEngine {
  readonly model: SimModel;
  private clock = 0;
  private mode: 'running' | 'error' = 'running';
  private fault: Fault | undefined;
  private readonly manual = new Map<Id, number>();
  private readonly coils = new Map<Id, boolean>();
  private readonly timers = new Map<Id, TimerRuntime>();
  private queue: TimerEvent[] = [];
  private seq = 0;
  private tokens = 0;
  private started = false;
  private lastSolution: Solution | undefined;

  constructor(doc: CircuitDocument, registry: Registry) {
    this.model = buildSimModel(doc, registry);
    for (const d of this.model.devices) {
      if (d.kind === 'switch') this.manual.set(d.id, d.initiallyActuated ? 1 : 0);
      if (d.kind === 'selector') this.manual.set(d.id, d.initialPosition);
      if (d.kind === 'coil') this.coils.set(d.id, false);
      if (d.kind === 'timer') this.timers.set(d.id, { running: false, held: false, output: false, startedAt: 0 });
    }
  }

  get clockMs(): number {
    return this.clock;
  }

  get isError(): boolean {
    return this.mode === 'error';
  }

  /** Estabiliza el estado inicial en t = 0. Puede terminar directamente en ERROR. */
  start(): SimSnapshot {
    if (!this.started) {
      this.started = true;
      this.settle();
    }
    return this.snapshot();
  }

  // ── Entradas externas ──────────────────────────────────────────────────────────────────────

  /** Pulsador momentáneo: accionado mientras se mantiene apretado (spec §8.3). */
  press(id: Id): void {
    this.setManual(id, 1, 'momentary');
  }

  release(id: Id): void {
    this.setManual(id, 0, 'momentary');
  }

  /** Interruptor mantenido o parada de emergencia: cada clic alterna (spec §8.2, I2). */
  toggle(id: Id): void {
    const d = this.model.byId.get(id);
    if (d?.kind !== 'switch' || d.action === 'momentary') return;
    this.setManual(id, this.manual.get(id) ? 0 : 1, d.action);
  }

  /** Selector de 3 posiciones (I3). */
  setSelector(id: Id, position: 0 | 1 | 2): void {
    const d = this.model.byId.get(id);
    if (d?.kind !== 'selector' || this.mode === 'error') return;
    if (this.manual.get(id) === position) return;
    this.manual.set(id, position);
    this.settle();
  }

  private setManual(id: Id, value: number, action: 'maintained' | 'momentary' | 'latching'): void {
    const d = this.model.byId.get(id);
    if (d?.kind !== 'switch' || d.action !== action || this.mode === 'error') return;
    if (this.manual.get(id) === value) return;
    this.manual.set(id, value);
    this.settle();
  }

  // ── Tiempo ────────────────────────────────────────────────────────────────────────────────

  /**
   * Avanza el reloj hasta `t`, procesando en orden cada evento vencido. Devuelve false si quedó
   * rezagado por el tope de eventos por llamada (continúa en la siguiente).
   */
  advanceTo(t: number): boolean {
    if (this.mode === 'error' || t < this.clock) return true;
    let processed = 0;
    let sameInstant = 0;
    while (this.queue.length > 0 && this.queue[0]!.time <= t) {
      if (processed >= MAX_EVENTS_PER_ADVANCE) return false;
      const ev = this.queue.shift()!;
      sameInstant = ev.time === this.clock ? sameInstant + 1 : 0;
      this.clock = ev.time;
      if (sameInstant > MAX_EVENTS_SAME_INSTANT) {
        this.enterOscillation('timed-loop', [...this.timers.keys()], []);
        return true;
      }
      processed++;
      this.fireTimer(ev);
      if (this.isError) return true;
    }
    this.clock = t;
    return true;
  }

  /** Próximo instante con un evento agendado (para avanzar "hasta el próximo evento" en tests). */
  nextEventTime(): number | undefined {
    return this.queue[0]?.time;
  }

  private fireTimer(ev: TimerEvent): void {
    const rt = this.timers.get(ev.timerId);
    if (!rt || !rt.running || rt.token !== ev.token) return; // cancelado
    rt.running = false;
    rt.token = undefined;
    const d = this.model.byId.get(ev.timerId);
    if (d?.kind !== 'timer') return;
    if (d.timerType === 'TON') rt.held = true; // cumplió el tiempo con la entrada activa
    else rt.held = false; // TOF: terminó el retardo a la desconexión
    this.settle();
  }

  private schedule(timerId: Id, time: number): number {
    const token = ++this.tokens;
    const ev: TimerEvent = { time, seq: ++this.seq, timerId, token };
    let i = this.queue.length;
    while (i > 0 && (this.queue[i - 1]!.time > time || (this.queue[i - 1]!.time === time && this.queue[i - 1]!.seq > ev.seq))) i--;
    this.queue.splice(i, 0, ev);
    return token;
  }

  // ── Resolución eléctrica ──────────────────────────────────────────────────────────────────

  private conducts(d: SimDevice): [NetId, NetId][] {
    switch (d.kind) {
      case 'switch': {
        const actuated = this.manual.get(d.id) === 1;
        return (d.normal === 'NO' ? actuated : !actuated) ? [[d.a, d.b]] : [];
      }
      case 'selector': {
        const pos = this.manual.get(d.id);
        if (pos === 1) return [[d.common, d.out1]];
        if (pos === 2) return [[d.common, d.out2]];
        return [];
      }
      case 'contact': {
        if (!d.target) return []; // vínculo roto: no se llega aquí si se respetan los diagnósticos
        const on = this.targetOn(d.target);
        return (d.normal === 'NO' ? on : !on) ? [[d.a, d.b]] : [];
      }
      default:
        return [];
    }
  }

  private targetOn(targetId: Id): boolean {
    if (this.coils.has(targetId)) return this.coils.get(targetId)!;
    return this.timers.get(targetId)?.output ?? false;
  }

  private solve(): Solution {
    const uf = new UnionFind();
    for (const n of this.model.nets) uf.add(n);
    for (const d of this.model.devices) for (const [a, b] of this.conducts(d)) uf.union(a, b);

    const pot = new Map<string, Potential>();
    const at = (net: NetId) => {
      const root = uf.find(net);
      let p = pot.get(root);
      if (!p) {
        p = { lines: new Set(), neutrals: new Set() };
        pot.set(root, p);
      }
      return p;
    };
    for (const d of this.model.devices) {
      if (d.kind !== 'source') continue;
      at(d.line).lines.add(`${d.id}:0`);
      at(d.neutral).neutrals.add(d.id);
    }
    for (const root of [...pot.keys()].sort()) {
      const p = pot.get(root)!;
      if (p.lines.size > 1) return { uf, pot, shortRoot: root, shortReason: 'phase-phase' };
      if (p.lines.size >= 1 && p.neutrals.size >= 1) return { uf, pot, shortRoot: root, shortReason: 'phase-neutral' };
    }
    return { uf, pot };
  }

  /** Carga energizada: fase de una fuente en un terminal y neutro de LA MISMA fuente en el otro. */
  private energized(sol: Solution, a: NetId, b: NetId): { on: boolean; mismatched: boolean } {
    const pa = sol.pot.get(sol.uf.find(a));
    const pb = sol.pot.get(sol.uf.find(b));
    if (!pa || !pb) return { on: false, mismatched: false };
    const check = (line: Potential, neutral: Potential) => {
      let any = false;
      for (const l of line.lines) {
        const source = l.slice(0, l.lastIndexOf(':'));
        if (neutral.neutrals.has(source)) return { on: true, mismatched: false };
        if (neutral.neutrals.size > 0) any = true;
      }
      return { on: false, mismatched: any };
    };
    const ab = check(pa, pb);
    if (ab.on) return ab;
    const ba = check(pb, pa);
    if (ba.on) return ba;
    return { on: false, mismatched: ab.mismatched || ba.mismatched };
  }

  // ── Punto fijo ────────────────────────────────────────────────────────────────────────────

  private stateHash(): string {
    let h = '';
    for (const [id, on] of this.coils) h += `${id}=${on ? 1 : 0};`;
    for (const [id, t] of this.timers) h += `${id}=${t.running ? 1 : 0}${t.held ? 1 : 0}${t.output ? 1 : 0};`;
    return h;
  }

  private settle(): void {
    if (this.mode === 'error') return;
    const seen = new Map<string, number>();
    const history: { hash: string; changes: { componentId: Id; on: boolean }[] }[] = [];
    seen.set(this.stateHash(), 0);

    for (let iter = 1; iter <= MAX_SETTLE_ITERATIONS; iter++) {
      const sol = this.solve();
      this.lastSolution = sol;
      if (sol.shortRoot) {
        this.enterShort(sol);
        return;
      }

      const changes: { componentId: Id; on: boolean }[] = [];
      // Bobinas.
      const nextCoils = new Map<Id, boolean>();
      for (const d of this.model.devices) {
        if (d.kind !== 'coil') continue;
        const on = this.energized(sol, d.a, d.b).on;
        nextCoils.set(d.id, on);
        if (on !== this.coils.get(d.id)) changes.push({ componentId: d.id, on });
      }
      // Timers: transiciones de estado, sin agendar todavía.
      const nextTimers = new Map<Id, TimerRuntime>();
      for (const d of this.model.devices) {
        if (d.kind !== 'timer') continue;
        const cur = this.timers.get(d.id)!;
        const input = this.energized(sol, d.a, d.b).on;
        const next: TimerRuntime = { ...cur };
        if (d.timerType === 'TON') {
          if (!input) {
            next.running = false;
            next.held = false;
          } else if (!cur.running && !cur.held) {
            next.running = true;
            next.startedAt = this.clock;
          }
          next.output = input && next.held;
        } else {
          if (input) {
            next.held = true;
            next.running = false;
          } else if (cur.held && !cur.running) {
            next.running = true;
            next.startedAt = this.clock;
          }
          next.output = input || next.held;
        }
        if (!next.running) next.token = undefined;
        nextTimers.set(d.id, next);
        if (next.output !== cur.output) changes.push({ componentId: d.id, on: next.output });
      }

      const timersChanged = [...nextTimers].some(([id, t]) => {
        const c = this.timers.get(id)!;
        return c.running !== t.running || c.held !== t.held || c.output !== t.output || c.startedAt !== t.startedAt;
      });
      if (changes.length === 0 && !timersChanged) {
        this.reconcileTimers();
        return;
      }

      for (const [id, on] of nextCoils) this.coils.set(id, on);
      for (const [id, t] of nextTimers) this.timers.set(id, t);
      const hash = this.stateHash();
      history.push({ hash, changes });
      const first = seen.get(hash);
      if (first !== undefined) {
        const cycle = history.slice(first);
        this.enterOscillation('instantaneous', [...new Set(cycle.flatMap((s) => s.changes.map((c) => c.componentId)))], cycle.flatMap((s) => s.changes));
        return;
      }
      seen.set(hash, history.length);
    }
    this.enterOscillation('instantaneous', [...this.coils.keys(), ...this.timers.keys()], []);
  }

  /** Al converger: agendar timers que empezaron a contar, olvidar los que se detuvieron. */
  private reconcileTimers(): void {
    for (const d of this.model.devices) {
      if (d.kind !== 'timer') continue;
      const rt = this.timers.get(d.id)!;
      if (rt.running && rt.token === undefined) rt.token = this.schedule(d.id, rt.startedAt + d.presetMs);
    }
    // Los eventos cuyo token ya no coincide se descartan al dispararse (cancelación perezosa);
    // además se limpian de la cola para que no cuenten como eventos del mismo instante.
    this.queue = this.queue.filter((ev) => this.timers.get(ev.timerId)?.token === ev.token);
  }

  // ── Fallas ────────────────────────────────────────────────────────────────────────────────

  private enterShort(sol: Solution): void {
    const root = sol.shortRoot!;
    const p = sol.pot.get(root)!;
    const nets = this.model.nets.filter((n) => sol.uf.find(n) === root);
    const netSet = new Set(nets);
    const lineSources = [...p.lines].map((l) => l.slice(0, l.lastIndexOf(':')));
    const neutralSources = [...p.neutrals];
    const bridges = this.model.devices
      .filter((d) => this.conducts(d).some(([a, b]) => netSet.has(a) && netSet.has(b)))
      .map((d) => d.id);
    const sources = [...new Set([...lineSources, ...neutralSources])].sort();
    this.fault = {
      kind: 'short',
      reason: sol.shortReason!,
      nets,
      sources,
      components: [...new Set([...sources, ...bridges])].sort(),
      lineSources: lineSources.sort(),
      neutralSources: neutralSources.sort(),
    };
    this.mode = 'error';
  }

  private enterOscillation(reason: 'instantaneous' | 'timed-loop', ids: Id[], sequence: { componentId: Id; on: boolean }[]): void {
    const components = new Set(ids);
    for (const id of ids) for (const c of this.model.contactsOf.get(id) ?? []) components.add(c);
    this.fault = { kind: 'oscillation', reason, components: [...components].sort(), sequence, nets: [] };
    this.mode = 'error';
  }

  // ── Vista ─────────────────────────────────────────────────────────────────────────────────

  snapshot(): SimSnapshot {
    const sol = this.lastSolution ?? this.solve();
    const netPotentials = new Map<NetId, NetPotential>();
    const shortNets = this.fault?.kind === 'short' ? new Set(this.fault.nets) : new Set<NetId>();
    for (const n of this.model.nets) {
      if (shortNets.has(n)) {
        netPotentials.set(n, { kind: 'short' });
        continue;
      }
      const p = sol.pot.get(sol.uf.find(n));
      if (p && p.lines.size > 0) netPotentials.set(n, { kind: 'line', sources: [...p.lines].map((l) => l.slice(0, l.lastIndexOf(':'))) });
      else if (p && p.neutrals.size > 0) netPotentials.set(n, { kind: 'neutral', sources: [...p.neutrals] });
      else netPotentials.set(n, { kind: 'floating' });
    }

    const devices = new Map<Id, DeviceView>();
    for (const d of this.model.devices) {
      switch (d.kind) {
        case 'switch':
          devices.set(d.id, { actuated: this.manual.get(d.id) === 1, conducting: this.conducts(d).length > 0 });
          break;
        case 'selector':
          devices.set(d.id, { position: (this.manual.get(d.id) ?? 0) as 0 | 1 | 2 });
          break;
        case 'contact':
          devices.set(d.id, { conducting: this.conducts(d).length > 0 });
          break;
        case 'coil':
          devices.set(d.id, { energized: this.coils.get(d.id) ?? false });
          break;
        case 'load': {
          const e = this.energized(sol, d.a, d.b);
          devices.set(d.id, { energized: e.on, mismatchedSupply: !e.on && e.mismatched });
          break;
        }
        case 'timer': {
          const rt = this.timers.get(d.id)!;
          const input = this.energized(sol, d.a, d.b).on;
          const elapsed = rt.running ? Math.min(d.presetMs, this.clock - rt.startedAt) : d.timerType === 'TON' && rt.held ? d.presetMs : 0;
          const phase = rt.running ? 'running' : d.timerType === 'TON' && rt.held ? 'done' : 'idle';
          devices.set(d.id, {
            energized: input,
            timer: { phase, elapsedMs: elapsed, remainingMs: rt.running ? d.presetMs - elapsed : 0, presetMs: d.presetMs, output: rt.output, input },
          });
          break;
        }
        default:
          break;
      }
    }
    return { clockMs: this.clock, mode: this.mode, ...(this.fault ? { fault: this.fault } : {}), netPotentials, devices };
  }
}
