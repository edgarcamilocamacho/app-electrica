/**
 * Motor de simulación del tablero (PLAN §9–§10, §22.4). Porta el motor clásico al modelo de
 * elementos: lo que antes era un componente por símbolo ahora es un elemento dentro de un aparato.
 *
 *  · El tiempo es un número (`clockMs`) que empuja quien llama: nunca se lee el reloj del sistema.
 *  · `solve` fusiona redes por los contactos que conducen, inyecta identidades de fuente y detecta
 *    los tres cortos (dos fases; fase y neutro, de la misma fuente o de otra).
 *  · `settle` busca el punto fijo instantáneo; si un estado se repite, es una oscilación.
 *  · Los timers cambian de estado dentro de `settle`, pero solo se agendan eventos al converger.
 *  · Ante una falla todo se congela (modo 'error') y ya no se procesa nada [R5 §14].
 */
import { UnionFind } from '../../connectivity/unionFind';
import type { Id } from '../../model/types';
import type { NetId } from '../nets';
import type { BoardDocument } from '../model';
import type { DeviceRegistry } from '../registry';
import { buildBoardSimModel, type BoardSimModel, type ElementId, type SimActuator, type SimContact } from './model';

export type SourceId = ElementId;
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
      readonly sources: readonly ElementId[];
      /** Aparatos implicados, para resaltarlos en el panel de ERROR. */
      readonly devices: readonly Id[];
    }
  | {
      readonly kind: 'oscillation';
      readonly reason: 'instantaneous' | 'timed-loop';
      readonly devices: readonly Id[];
      readonly sequence: readonly { readonly elementId: ElementId; readonly on: boolean }[];
      readonly nets: readonly NetId[];
    };

export interface TimerView {
  readonly phase: 'idle' | 'running' | 'done';
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly presetMs: number;
  readonly output: boolean;
  readonly input: boolean;
}

export interface DeviceView {
  /** Actuador manual accionado (pulsador apretado, interruptor cerrado). */
  readonly actuated?: boolean;
  readonly position?: number;
  /** Bobina energizada o carga encendida. */
  readonly energized?: boolean;
  readonly timer?: TimerView;
  /** Carga con fase de una fuente y neutro de otra: no enciende (R2 §9). */
  readonly mismatchedSupply?: boolean;
  /** Contactos del aparato que están conduciendo. */
  readonly contacts: ReadonlyMap<ElementId, boolean>;
  /** Cargas del aparato que están encendidas. */
  readonly loads: ReadonlyMap<ElementId, boolean>;
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
  readonly timerId: ElementId;
  readonly token: number;
}

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

export class BoardSimEngine {
  readonly model: BoardSimModel;
  private clock = 0;
  private mode: 'running' | 'error' = 'running';
  private fault: Fault | undefined;
  private readonly manual = new Map<ElementId, number>();
  private readonly coils = new Map<ElementId, boolean>();
  private readonly timers = new Map<ElementId, TimerRuntime>();
  private queue: TimerEvent[] = [];
  private seq = 0;
  private tokens = 0;
  private started = false;
  private lastSolution: Solution | undefined;

  constructor(doc: BoardDocument, registry: DeviceRegistry) {
    this.model = buildBoardSimModel(doc, registry);
    for (const a of this.model.actuators) {
      if (a.kind === 'manual') this.manual.set(a.id, a.initialState);
      if (a.kind === 'coil') this.coils.set(a.id, false);
      if (a.kind === 'timer') this.timers.set(a.id, { running: false, held: false, output: false, startedAt: 0 });
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

  // ── Entradas externas (por aparato: el usuario aprieta el aparato, no el elemento) ─────────

  /** Pulsador momentáneo: accionado mientras se mantiene apretado (spec §8.3). */
  press(deviceId: Id): void {
    this.setManual(deviceId, 1, 'momentary');
  }

  release(deviceId: Id): void {
    this.setManual(deviceId, 0, 'momentary');
  }

  /** Interruptor mantenido o parada de emergencia: cada clic alterna (spec §8.2, I2). */
  toggle(deviceId: Id): void {
    const actuator = this.manualActuator(deviceId);
    if (!actuator || actuator.action === 'momentary' || actuator.action === 'selector') return;
    this.setManual(deviceId, this.manual.get(actuator.id) ? 0 : 1, actuator.action);
  }

  /** Selector de 3 posiciones (I3). */
  setSelector(deviceId: Id, position: number): void {
    const actuator = this.manualActuator(deviceId);
    if (!actuator || actuator.action !== 'selector' || this.mode === 'error') return;
    if (this.manual.get(actuator.id) === position) return;
    this.manual.set(actuator.id, position);
    this.settle();
  }

  private manualActuator(deviceId: Id): Extract<SimActuator, { kind: 'manual' }> | undefined {
    const id = this.model.manualOf.get(deviceId);
    const actuator = id ? this.model.actuatorById.get(id) : undefined;
    return actuator?.kind === 'manual' ? actuator : undefined;
  }

  private setManual(deviceId: Id, value: number, action: 'maintained' | 'momentary' | 'latching'): void {
    const actuator = this.manualActuator(deviceId);
    if (!actuator || actuator.action !== action || this.mode === 'error') return;
    if (this.manual.get(actuator.id) === value) return;
    this.manual.set(actuator.id, value);
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
      processed += 1;
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
    const actuator = this.model.actuatorById.get(ev.timerId);
    if (actuator?.kind !== 'timer') return;
    if (actuator.timerType === 'TON') rt.held = true;
    else rt.held = false;
    this.settle();
  }

  private schedule(timerId: ElementId, time: number): number {
    const token = (this.tokens += 1);
    const ev: TimerEvent = { time, seq: (this.seq += 1), timerId, token };
    let i = this.queue.length;
    while (
      i > 0 &&
      (this.queue[i - 1]!.time > time || (this.queue[i - 1]!.time === time && this.queue[i - 1]!.seq > ev.seq))
    ) {
      i -= 1;
    }
    this.queue.splice(i, 0, ev);
    return token;
  }

  // ── Resolución eléctrica ──────────────────────────────────────────────────────────────────

  private actuatorOn(id: ElementId): boolean {
    const actuator = this.model.actuatorById.get(id);
    if (!actuator) return false;
    if (actuator.kind === 'coil') return this.coils.get(id) ?? false;
    if (actuator.kind === 'timer') return this.timers.get(id)?.output ?? false;
    return this.manual.get(id) === 1;
  }

  private closed(contact: SimContact): boolean {
    const actuator = this.model.actuatorById.get(contact.actuatorId);
    if (actuator?.kind === 'manual' && actuator.action === 'selector') {
      return this.manual.get(actuator.id) === contact.position;
    }
    const on = this.actuatorOn(contact.actuatorId);
    return contact.normal === 'NO' ? on : !on;
  }

  private solve(): Solution {
    const uf = new UnionFind();
    for (const n of this.model.nets) uf.add(n);
    for (const contact of this.model.contacts) if (this.closed(contact)) uf.union(contact.a, contact.b);

    const pot = new Map<string, Potential>();
    const at = (net: NetId): Potential => {
      const root = uf.find(net);
      let p = pot.get(root);
      if (!p) {
        p = { lines: new Set(), neutrals: new Set() };
        pot.set(root, p);
      }
      return p;
    };
    for (const source of this.model.sources) {
      source.phases.forEach((net, index) => at(net).lines.add(`${source.id}:${index}`));
      at(source.neutral).neutrals.add(source.id);
    }
    for (const root of [...pot.keys()].sort()) {
      const p = pot.get(root)!;
      if (p.lines.size > 1) return { uf, pot, shortRoot: root, shortReason: 'phase-phase' };
      if (p.lines.size >= 1 && p.neutrals.size >= 1) return { uf, pot, shortRoot: root, shortReason: 'phase-neutral' };
    }
    return { uf, pot };
  }

  /** Carga energizada: fase de una fuente en un borne y neutro de LA MISMA fuente en el otro. */
  private energized(sol: Solution, a: NetId, b: NetId): { on: boolean; mismatched: boolean } {
    const pa = sol.pot.get(sol.uf.find(a));
    const pb = sol.pot.get(sol.uf.find(b));
    if (!pa || !pb) return { on: false, mismatched: false };
    const check = (line: Potential, neutral: Potential): { on: boolean; mismatched: boolean } => {
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
    const history: { hash: string; changes: { elementId: ElementId; on: boolean }[] }[] = [];
    seen.set(this.stateHash(), 0);

    for (let iter = 1; iter <= MAX_SETTLE_ITERATIONS; iter += 1) {
      const sol = this.solve();
      this.lastSolution = sol;
      if (sol.shortRoot) {
        this.enterShort(sol);
        return;
      }

      const changes: { elementId: ElementId; on: boolean }[] = [];
      const nextCoils = new Map<ElementId, boolean>();
      const nextTimers = new Map<ElementId, TimerRuntime>();

      for (const actuator of this.model.actuators) {
        if (actuator.kind === 'coil') {
          const on = this.energized(sol, actuator.a, actuator.b).on;
          nextCoils.set(actuator.id, on);
          if (on !== this.coils.get(actuator.id)) changes.push({ elementId: actuator.id, on });
        } else if (actuator.kind === 'timer') {
          const cur = this.timers.get(actuator.id)!;
          const input = this.energized(sol, actuator.a, actuator.b).on;
          const next: TimerRuntime = { ...cur };
          if (actuator.timerType === 'TON') {
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
          nextTimers.set(actuator.id, next);
          if (next.output !== cur.output) changes.push({ elementId: actuator.id, on: next.output });
        }
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
        this.enterOscillation(
          'instantaneous',
          [...new Set(cycle.flatMap((s) => s.changes.map((c) => c.elementId)))],
          cycle.flatMap((s) => s.changes),
        );
        return;
      }
      seen.set(hash, history.length);
    }
    this.enterOscillation('instantaneous', [...this.coils.keys(), ...this.timers.keys()], []);
  }

  /** Al converger: agendar timers que empezaron a contar, olvidar los que se detuvieron. */
  private reconcileTimers(): void {
    for (const actuator of this.model.actuators) {
      if (actuator.kind !== 'timer') continue;
      const rt = this.timers.get(actuator.id)!;
      if (rt.running && rt.token === undefined) {
        rt.token = this.schedule(actuator.id, rt.startedAt + actuator.presetMs);
      }
    }
    this.queue = this.queue.filter((ev) => this.timers.get(ev.timerId)?.token === ev.token);
  }

  // ── Fallas ────────────────────────────────────────────────────────────────────────────────

  private devicesOf(elements: Iterable<ElementId>): Id[] {
    const devices = new Set<Id>();
    for (const element of elements) {
      const deviceId = this.model.deviceOf.get(element);
      if (deviceId) devices.add(deviceId);
    }
    return [...devices].sort();
  }

  private enterShort(sol: Solution): void {
    const root = sol.shortRoot!;
    const p = sol.pot.get(root)!;
    const nets = this.model.nets.filter((n) => sol.uf.find(n) === root);
    const netSet = new Set(nets);
    const lineSources = [...p.lines].map((l) => l.slice(0, l.lastIndexOf(':')));
    const sources = [...new Set([...lineSources, ...p.neutrals])].sort();
    const bridges = this.model.contacts
      .filter((c) => this.closed(c) && netSet.has(c.a) && netSet.has(c.b))
      .map((c) => c.id);
    this.fault = {
      kind: 'short',
      reason: sol.shortReason!,
      nets,
      sources,
      devices: this.devicesOf([...sources, ...bridges]),
    };
    this.mode = 'error';
  }

  private enterOscillation(
    reason: 'instantaneous' | 'timed-loop',
    elements: readonly ElementId[],
    sequence: { elementId: ElementId; on: boolean }[],
  ): void {
    const involved = new Set<ElementId>(elements);
    for (const id of elements) for (const c of this.model.contactsOf.get(id) ?? []) involved.add(c);
    this.fault = { kind: 'oscillation', reason, devices: this.devicesOf(involved), sequence, nets: [] };
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
      if (p && p.lines.size > 0) {
        netPotentials.set(n, { kind: 'line', sources: [...p.lines].map((l) => l.slice(0, l.lastIndexOf(':'))) });
      } else if (p && p.neutrals.size > 0) {
        netPotentials.set(n, { kind: 'neutral', sources: [...p.neutrals] });
      } else {
        netPotentials.set(n, { kind: 'floating' });
      }
    }

    const devices = new Map<Id, DeviceView>();
    for (const [deviceId, elements] of this.model.elementsOf) {
      const contacts = new Map<ElementId, boolean>();
      for (const id of elements.contacts) {
        const contact = this.model.contactById.get(id);
        if (contact) contacts.set(id, this.closed(contact));
      }
      const loads = new Map<ElementId, boolean>();
      let energized: boolean | undefined;
      let mismatched = false;
      for (const id of elements.loads) {
        const load = this.model.loads.find((l) => l.id === id)!;
        const e = this.energized(sol, load.a, load.b);
        loads.set(id, e.on);
        energized = (energized ?? false) || e.on;
        mismatched = mismatched || (!e.on && e.mismatched);
      }

      let actuated: boolean | undefined;
      let position: number | undefined;
      let timer: TimerView | undefined;
      for (const id of elements.actuators) {
        const actuator = this.model.actuatorById.get(id)!;
        if (actuator.kind === 'manual') {
          if (actuator.action === 'selector') position = this.manual.get(id) ?? 0;
          else actuated = this.manual.get(id) === 1;
        } else if (actuator.kind === 'coil') {
          energized = (energized ?? false) || (this.coils.get(id) ?? false);
        } else {
          const rt = this.timers.get(id)!;
          const input = this.energized(sol, actuator.a, actuator.b).on;
          const done = actuator.timerType === 'TON' && rt.held;
          const elapsed = rt.running ? Math.min(actuator.presetMs, this.clock - rt.startedAt) : done ? actuator.presetMs : 0;
          timer = {
            phase: rt.running ? 'running' : done ? 'done' : 'idle',
            elapsedMs: elapsed,
            remainingMs: rt.running ? actuator.presetMs - elapsed : 0,
            presetMs: actuator.presetMs,
            output: rt.output,
            input,
          };
          energized = (energized ?? false) || input;
        }
      }

      devices.set(deviceId, {
        ...(actuated === undefined ? {} : { actuated }),
        ...(position === undefined ? {} : { position }),
        ...(energized === undefined ? {} : { energized }),
        ...(timer ? { timer } : {}),
        ...(mismatched ? { mismatchedSupply: true } : {}),
        contacts,
        loads,
      });
    }

    return {
      clockMs: this.clock,
      mode: this.mode,
      ...(this.fault ? { fault: this.fault } : {}),
      netPotentials,
      devices,
    };
  }
}
