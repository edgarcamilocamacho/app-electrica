import { describe, expect, it } from 'vitest';
import { SimEngine } from '../../../src/core/sim/engine';
import { defaultRegistry } from '../../../src/core/registry/catalog';
import { Scenario } from '../../fixtures/scenarios';
import { engineFor, ladderCircuit, view } from '../../fixtures/circuits';

const on = (e: SimEngine, s: Scenario, name: string) => view(e, s, name)?.energized ?? false;

describe('escenarios de la spec (§19)', () => {
  it('§19.1 lámpara básica: S1 abierto apaga H1, cerrado la enciende', () => {
    const s = ladderCircuit([[{ name: 'S1', type: 'switch-no' }, { name: 'H1', type: 'lamp' }]]);
    const e = engineFor(s);
    expect(on(e, s, 'H1')).toBe(false);
    e.toggle(s.ids.S1!);
    expect(on(e, s, 'H1')).toBe(true);
    e.toggle(s.ids.S1!);
    expect(on(e, s, 'H1')).toBe(false);
    expect(e.snapshot().mode).toBe('running');
  });

  it('§19.2 contactor con contacto auxiliar', () => {
    const s = ladderCircuit([
      [{ name: 'S1', type: 'switch-no' }, { name: 'K1', type: 'coil' }],
      [{ name: 'K11', type: 'contact-no', props: { link: 'K1' } }, { name: 'H1', type: 'lamp' }],
    ]);
    const e = engineFor(s);
    expect(on(e, s, 'H1')).toBe(false);
    e.toggle(s.ids.S1!);
    expect(view(e, s, 'K1')?.energized).toBe(true);
    expect(view(e, s, 'K11')?.conducting).toBe(true);
    expect(on(e, s, 'H1')).toBe(true);
  });

  it('autorretención: marcha la enciende, se mantiene al soltar y paro la apaga', () => {
    const s = ladderCircuit([
      [{ name: 'S0', type: 'pushbutton-nc' }, { name: 'S1', type: 'pushbutton-no' }, { name: 'K1', type: 'coil' }],
    ]);
    // Rama x=10: S0 (10,-8)…(10,-2) · S1 (10,0)…(10,6) · K1 (10,8)…(10,14).
    // Contacto de retención en paralelo con S1: de la unión S0–S1 (10,-1) a la unión S1–K1 (10,7).
    s.place('K11', 'contact-no', 16, 3, 0, { link: 'K1' }); // terminales (16,0) y (16,6)
    s.wire([10, -1], [16, -1], [16, 0]);
    s.wire([16, 6], [16, 7], [10, 7]);
    const e = engineFor(s);
    expect(on(e, s, 'K1')).toBe(false);
    e.press(s.ids.S1!);
    expect(on(e, s, 'K1')).toBe(true);
    e.release(s.ids.S1!);
    expect(on(e, s, 'K1')).toBe(true); // retención
    e.press(s.ids.S0!);
    expect(on(e, s, 'K1')).toBe(false);
    e.release(s.ids.S0!);
    expect(on(e, s, 'K1')).toBe(false);
  });

  it('§19.3 neutro común de dos fuentes: permitido, sin error', () => {
    const s = new Scenario();
    s.place('GA', 'ac-source', 0, 0); // L (0,-3) N (0,3)
    s.place('GB', 'ac-source', 20, 0); // L (20,-3) N (20,3)
    s.place('HA', 'lamp', 5, 0);
    s.place('HB', 'lamp', 15, 0);
    s.wire([0, -3], [0, -6], [5, -6], [5, -3]);
    s.wire([20, -3], [20, -6], [15, -6], [15, -3]);
    s.wire([0, 3], [0, 10], [20, 10], [20, 3]); // NA y NB unidos
    s.wire([5, 3], [5, 10]);
    s.wire([15, 3], [15, 10]);
    const e = engineFor(s);
    expect(e.snapshot().mode).toBe('running');
    expect(on(e, s, 'HA')).toBe(true);
    expect(on(e, s, 'HB')).toBe(true);
  });

  it('§19.4 nodo flotante: la lámpara enciende cuando la fase la alcanza', () => {
    const s = ladderCircuit([[{ name: 'S1', type: 'switch-no' }, { name: 'H1', type: 'lamp' }]]);
    const e = engineFor(s);
    const snap = e.snapshot();
    const floating = [...snap.netPotentials.values()].filter((p) => p.kind === 'floating');
    expect(floating.length).toBeGreaterThan(0);
    e.toggle(s.ids.S1!);
    expect(on(e, s, 'H1')).toBe(true);
  });

  it('§19.5 corto entre fases independientes: ERROR congelado y nodo en rojo', () => {
    const s = new Scenario();
    s.place('GA', 'ac-source', 0, 0);
    s.place('GB', 'ac-source', 30, 0);
    s.place('S1', 'switch-no', 10, -10); // (10,-13) (10,-7)
    s.place('S2', 'switch-no', 20, -10); // (20,-13) (20,-7)
    s.wire([0, -3], [0, -16], [10, -16], [10, -13]);
    s.wire([30, -3], [30, -16], [20, -16], [20, -13]);
    s.wire([10, -7], [10, -4], [20, -4], [20, -7]); // nodo X
    const e = engineFor(s);
    e.toggle(s.ids.S1!);
    expect(e.snapshot().mode).toBe('running');
    e.toggle(s.ids.S2!);
    const snap = e.snapshot();
    expect(snap.mode).toBe('error');
    expect(snap.fault).toMatchObject({ kind: 'short', reason: 'phase-phase' });
    expect(snap.fault?.kind === 'short' && snap.fault.sources).toEqual([s.ids.GA, s.ids.GB].sort());
    expect([...snap.netPotentials.values()].some((p) => p.kind === 'short')).toBe(true);
    // Congelado: ya no responde a entradas ni al tiempo.
    e.toggle(s.ids.S1!);
    e.advanceTo(10_000);
    expect(e.snapshot().clockMs).toBe(0);
    expect(e.snapshot().mode).toBe('error');
  });

  it('§19.6 oscilación instantánea: K1 alimentado por su propio NC', () => {
    const s = ladderCircuit([
      [{ name: 'K11', type: 'contact-nc', props: { link: 'K1' } }, { name: 'K1', type: 'coil' }],
    ]);
    const e = engineFor(s);
    const snap = e.snapshot();
    expect(snap.mode).toBe('error');
    expect(snap.fault).toMatchObject({ kind: 'oscillation', reason: 'instantaneous' });
    expect(snap.fault!.components).toEqual(expect.arrayContaining([s.ids.K1, s.ids.K11]));
    expect(snap.fault?.kind === 'oscillation' && snap.fault.sequence.length).toBeGreaterThan(0);
  });
});

describe('reglas de cortocircuito (R1 §1)', () => {
  it('L y N unidos directamente → ERROR fase-neutro al arrancar', () => {
    const s = new Scenario();
    s.place('G1', 'ac-source', 0, 0);
    s.wire([0, -3], [0, -6], [4, -6], [4, 6], [0, 6], [0, 3]);
    const e = engineFor(s);
    expect(e.snapshot().fault).toMatchObject({ kind: 'short', reason: 'phase-neutral' });
  });

  it('fase de A con neutro de B en el mismo nodo → ERROR', () => {
    const s = new Scenario();
    s.place('GA', 'ac-source', 0, 0);
    s.place('GB', 'ac-source', 20, 0);
    s.place('S1', 'switch-no', 10, -10);
    s.wire([0, -3], [0, -16], [10, -16], [10, -13]);
    s.wire([10, -7], [10, -4], [16, -4], [16, 6], [20, 6], [20, 3]); // a NB
    const e = engineFor(s);
    expect(e.snapshot().mode).toBe('running');
    e.toggle(s.ids.S1!);
    expect(e.snapshot().fault).toMatchObject({ kind: 'short', reason: 'phase-neutral' });
  });

  it('carga entre fase de A y neutro de B (neutros sin unir): no enciende, sin error (R2 §9)', () => {
    const s = new Scenario();
    s.place('GA', 'ac-source', 0, 0);
    s.place('GB', 'ac-source', 20, 0);
    s.place('H1', 'lamp', 10, 0);
    s.wire([0, -3], [0, -6], [10, -6], [10, -3]);
    s.wire([10, 3], [10, 6], [20, 6], [20, 3]);
    const e = engineFor(s);
    expect(e.snapshot().mode).toBe('running');
    expect(view(e, s, 'H1')).toMatchObject({ energized: false, mismatchedSupply: true });
  });

  it('dos cargas en serie quedan apagadas (modelo simplificado aceptado, R1 §1)', () => {
    const s = ladderCircuit([[{ name: 'H1', type: 'lamp' }, { name: 'H2', type: 'lamp' }]]);
    const e = engineFor(s);
    expect(on(e, s, 'H1')).toBe(false);
    expect(on(e, s, 'H2')).toBe(false);
    expect(e.snapshot().mode).toBe('running');
  });

  it('un extremo libre no altera la simulación', () => {
    const s = ladderCircuit([[{ name: 'S1', type: 'switch-no', props: { initiallyActuated: true } }, { name: 'H1', type: 'lamp' }]]);
    s.wire([10, 20], [18, 20]); // rama suelta desde el cable de H1 al neutro: extremo libre en (18,20)
    const e = engineFor(s);
    expect(e.snapshot().mode).toBe('running');
    expect(on(e, s, 'H1')).toBe(true);
  });
});

describe('controles manuales', () => {
  it('pulsador momentáneo NO: cerrado solo mientras se mantiene', () => {
    const s = ladderCircuit([[{ name: 'S1', type: 'pushbutton-no' }, { name: 'H1', type: 'lamp' }]]);
    const e = engineFor(s);
    e.press(s.ids.S1!);
    expect(on(e, s, 'H1')).toBe(true);
    e.release(s.ids.S1!);
    expect(on(e, s, 'H1')).toBe(false);
  });

  it('pulsador momentáneo NC: abre solo mientras se mantiene', () => {
    const s = ladderCircuit([[{ name: 'S1', type: 'pushbutton-nc' }, { name: 'H1', type: 'lamp' }]]);
    const e = engineFor(s);
    expect(on(e, s, 'H1')).toBe(true);
    e.press(s.ids.S1!);
    expect(on(e, s, 'H1')).toBe(false);
    e.release(s.ids.S1!);
    expect(on(e, s, 'H1')).toBe(true);
  });

  it('interruptor mantenido: estado inicial desde el documento y cada clic alterna (R3 Q3.8)', () => {
    const s = ladderCircuit([[{ name: 'S1', type: 'switch-nc', props: { initiallyActuated: true } }, { name: 'H1', type: 'lamp' }]]);
    const e = engineFor(s);
    expect(on(e, s, 'H1')).toBe(false); // NC accionado = abierto
    e.toggle(s.ids.S1!);
    expect(on(e, s, 'H1')).toBe(true);
  });

  it('los toggles no afectan a un pulsador momentáneo', () => {
    const s = ladderCircuit([[{ name: 'S1', type: 'pushbutton-no' }, { name: 'H1', type: 'lamp' }]]);
    const e = engineFor(s);
    e.toggle(s.ids.S1!);
    expect(on(e, s, 'H1')).toBe(false);
  });

  it('parada de emergencia: un clic enclava (abre), otro clic libera (I2)', () => {
    const s = ladderCircuit([[{ name: 'S0', type: 'emergency-stop' }, { name: 'H1', type: 'lamp' }]]);
    const e = engineFor(s);
    expect(on(e, s, 'H1')).toBe(true);
    e.toggle(s.ids.S0!);
    expect(view(e, s, 'S0')?.actuated).toBe(true);
    expect(on(e, s, 'H1')).toBe(false);
    e.toggle(s.ids.S0!);
    expect(on(e, s, 'H1')).toBe(true);
  });

  it('selector de 3 posiciones: I conduce C–1, 0 nada, II conduce C–2 (I3)', () => {
    const s = new Scenario();
    s.place('G1', 'ac-source', 0, 0);
    s.place('SA', 'selector-3', 10, -8); // C (10,-11) · 1 (8,-5) · 2 (12,-5)
    s.place('H1', 'lamp', 8, 2); // X1 (8,-1) X2 (8,5)
    s.place('H2', 'lamp', 16, 2); // X1 (16,-1) X2 (16,5)
    s.wire([0, -3], [0, -14], [10, -14], [10, -11]);
    s.wire([8, -5], [8, -1]);
    s.wire([12, -5], [12, -3], [16, -3], [16, -1]);
    s.wire([0, 3], [0, 8], [16, 8], [16, 5]);
    s.wire([8, 5], [8, 8]);
    const e = engineFor(s);
    expect([on(e, s, 'H1'), on(e, s, 'H2')]).toEqual([false, false]);
    e.setSelector(s.ids.SA!, 1);
    expect([on(e, s, 'H1'), on(e, s, 'H2')]).toEqual([true, false]);
    e.setSelector(s.ids.SA!, 2);
    expect([on(e, s, 'H1'), on(e, s, 'H2')]).toEqual([false, true]);
    e.setSelector(s.ids.SA!, 0);
    expect([on(e, s, 'H1'), on(e, s, 'H2')]).toEqual([false, false]);
  });
});

describe('temporizadores (spec §10.3–§10.4, R2 §1)', () => {
  const tonCircuit = (presetMs = 5000) =>
    ladderCircuit([
      [{ name: 'S1', type: 'switch-no' }, { name: 'T1', type: 'timer-ton', props: { presetMs } }],
      [{ name: 'T11', type: 'timed-contact-no', props: { link: 'T1' } }, { name: 'H1', type: 'lamp' }],
    ]);

  it('TON: la salida se activa exactamente al vencer el preset', () => {
    const s = tonCircuit();
    const e = engineFor(s);
    e.toggle(s.ids.S1!);
    expect(view(e, s, 'T1')?.timer).toMatchObject({ phase: 'running', elapsedMs: 0, remainingMs: 5000, output: false });
    e.advanceTo(4999);
    expect(on(e, s, 'H1')).toBe(false);
    expect(view(e, s, 'T1')?.timer).toMatchObject({ elapsedMs: 4999, remainingMs: 1 });
    e.advanceTo(5000);
    expect(on(e, s, 'H1')).toBe(true);
    expect(view(e, s, 'T1')?.timer).toMatchObject({ phase: 'done', output: true });
  });

  it('TON: desenergizar antes de vencer cancela el evento y reinicia desde cero', () => {
    const s = tonCircuit();
    const e = engineFor(s);
    e.toggle(s.ids.S1!);
    e.advanceTo(3000);
    e.toggle(s.ids.S1!); // corta la entrada
    expect(view(e, s, 'T1')?.timer).toMatchObject({ phase: 'idle', elapsedMs: 0, output: false });
    expect(e.nextEventTime()).toBeUndefined();
    e.advanceTo(4000);
    e.toggle(s.ids.S1!); // vuelve a energizar en t=4000
    e.advanceTo(8999);
    expect(on(e, s, 'H1')).toBe(false); // no acumuló los 3000 anteriores
    e.advanceTo(9000);
    expect(on(e, s, 'H1')).toBe(true);
  });

  it('TON: al desenergizar con la salida activa, la salida cae de inmediato', () => {
    const s = tonCircuit(1000);
    const e = engineFor(s);
    e.toggle(s.ids.S1!);
    e.advanceTo(1000);
    expect(on(e, s, 'H1')).toBe(true);
    e.toggle(s.ids.S1!);
    expect(on(e, s, 'H1')).toBe(false);
  });

  const tofCircuit = (presetMs = 2000) =>
    ladderCircuit([
      [{ name: 'S1', type: 'switch-no' }, { name: 'T1', type: 'timer-tof', props: { presetMs } }],
      [{ name: 'T11', type: 'timed-contact-no', props: { link: 'T1' } }, { name: 'H1', type: 'lamp' }],
    ]);

  it('TOF: la salida sube al energizar y cae al vencer tras desenergizar', () => {
    const s = tofCircuit();
    const e = engineFor(s);
    e.toggle(s.ids.S1!);
    expect(on(e, s, 'H1')).toBe(true);
    e.advanceTo(10_000);
    expect(on(e, s, 'H1')).toBe(true);
    e.toggle(s.ids.S1!); // cae la entrada en t=10000
    expect(on(e, s, 'H1')).toBe(true);
    expect(view(e, s, 'T1')?.timer).toMatchObject({ phase: 'running', remainingMs: 2000 });
    e.advanceTo(11_999);
    expect(on(e, s, 'H1')).toBe(true);
    e.advanceTo(12_000);
    expect(on(e, s, 'H1')).toBe(false);
  });

  it('TOF: re-energizar antes de vencer cancela el apagado', () => {
    const s = tofCircuit();
    const e = engineFor(s);
    e.toggle(s.ids.S1!);
    e.toggle(s.ids.S1!); // t=0: cae, agenda t=2000
    e.advanceTo(1500);
    e.toggle(s.ids.S1!); // vuelve
    e.advanceTo(5000);
    expect(on(e, s, 'H1')).toBe(true);
    expect(e.nextEventTime()).toBeUndefined();
  });

  it('el preset se limita al mínimo de 100 ms (evita lazos de retardo cero)', () => {
    const s = tonCircuit(0);
    const e = new SimEngine(s.doc, defaultRegistry);
    const timer = e.model.byId.get(s.ids.T1!);
    expect(timer?.kind === 'timer' && timer.presetMs).toBe(100);
  });

  it('intermitente con TON y su propio NC: oscila en el tiempo sin ser un error', () => {
    const s = ladderCircuit([
      [{ name: 'T11', type: 'timed-contact-nc', props: { link: 'T1' } }, { name: 'T1', type: 'timer-ton', props: { presetMs: 500 } }],
    ]);
    const e = engineFor(s);
    const outputs: boolean[] = [];
    for (let t = 0; t <= 3000; t += 250) {
      e.advanceTo(t);
      outputs.push(view(e, s, 'T1')!.timer!.phase === 'running');
    }
    expect(e.snapshot().mode).toBe('running');
    expect(outputs.every((x) => x)).toBe(true); // se reinicia cada 500 ms: siempre contando
  });

  it('el ERROR congela el tiempo transcurrido del timer (spec §12)', () => {
    const s = tonCircuit(5000);
    // Rama extra que provoca un corto fase-neutro al cerrar S9.
    s.place('S9', 'switch-no', 40, 20); // (40,17) · (40,23)
    s.wire([30, -10], [40, -10], [40, 17]); // prolonga el riel de fase
    s.wire([40, 23], [40, 50], [30, 50]); // hasta el riel de neutro
    const e = engineFor(s);
    e.toggle(s.ids.S1!);
    e.advanceTo(2000);
    e.toggle(s.ids.S9!);
    const frozen = e.snapshot();
    expect(frozen.mode).toBe('error');
    expect(view(e, s, 'T1')?.timer).toMatchObject({ elapsedMs: 2000, remainingMs: 3000 });
    e.advanceTo(9000);
    expect(e.snapshot().clockMs).toBe(2000);
    expect(view(e, s, 'T1')?.timer).toMatchObject({ elapsedMs: 2000 });
  });
});

describe('determinismo (spec §17)', () => {
  it('el mismo guion de entradas produce exactamente los mismos estados', () => {
    const run = () => {
      const s = ladderCircuit([
        [{ name: 'S1', type: 'switch-no' }, { name: 'T1', type: 'timer-ton', props: { presetMs: 700 } }],
        [{ name: 'T11', type: 'timed-contact-no', props: { link: 'T1' } }, { name: 'K1', type: 'coil' }],
        [{ name: 'K11', type: 'contact-no', props: { link: 'K1' } }, { name: 'H1', type: 'lamp' }],
      ]);
      const e = engineFor(s);
      const trace: string[] = [];
      const script: [number, () => void][] = [
        [0, () => e.toggle(s.ids.S1!)],
        [350, () => e.toggle(s.ids.S1!)],
        [400, () => e.toggle(s.ids.S1!)],
        [2000, () => e.toggle(s.ids.S1!)],
      ];
      for (const [t, action] of script) {
        e.advanceTo(t);
        action();
        const snap = e.snapshot();
        trace.push(JSON.stringify([snap.clockMs, [...snap.devices.entries()]]));
      }
      e.advanceTo(5000);
      trace.push(JSON.stringify([...e.snapshot().devices.entries()]));
      return trace;
    };
    expect(run()).toEqual(run());
  });
});
