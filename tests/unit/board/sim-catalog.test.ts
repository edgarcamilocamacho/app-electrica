import { describe, expect, it } from 'vitest';
import { BoardSimEngine } from '../../../src/core/board/sim/engine';
import { BoardBuilder, registry, term } from '../../fixtures/board';

const engineOf = (b: BoardBuilder) => new BoardSimEngine(b.doc, registry);
const on = (snap: ReturnType<BoardSimEngine['snapshot']>, id: string) => snap.devices.get(id)?.energized === true;

describe('acometidas de varias fases [R5 §2]', () => {
  it('una carga entre fase y neutro del mismo poste enciende', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-3p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    b.wire(term(g, 'L2'), term(h, 'X1'));
    b.wire(term(g, 'N'), term(h, 'X2'));
    expect(on(engineOf(b).start(), h)).toBe(true);
  });

  it('una carga entre dos fases no enciende [R5 §12]', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-3p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    b.wire(term(g, 'L1'), term(h, 'X1'));
    b.wire(term(g, 'L2'), term(h, 'X2'));
    const snap = engineOf(b).start();
    expect(snap.mode).toBe('running');
    expect(on(snap, h)).toBe(false);
  });

  it('dos fases del mismo poste en el mismo nodo son corto', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-3p', 0, 0);
    b.wire(term(g, 'L1'), term(g, 'L3'), { bends: [{ x: -6, y: 20 }, { x: 2, y: 20 }] });
    const snap = engineOf(b).start();
    expect(snap.mode).toBe('error');
    if (snap.fault?.kind === 'short') expect(snap.fault.reason).toBe('phase-phase');
  });
});

describe('relé enchufable', () => {
  it('la bobina cierra el NA y abre el NC de los dos polos', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const s = b.device('switch-no', 30, 0);
    const k = b.device('relay-8', 70, 0);
    const hNo = b.device('pilot-lamp', 110, 0);
    const hNc = b.device('pilot-lamp', 140, 0);
    b.wire(term(g, 'L'), term(s, '13'));
    b.wire(term(s, '14'), term(k, '7'));
    b.wire(term(k, '2'), term(g, 'N'));
    b.wire(term(g, 'L'), term(k, '8'));
    b.wire(term(k, '6'), term(hNo, 'X1'));
    b.wire(term(hNo, 'X2'), term(g, 'N'));
    b.wire(term(k, '5'), term(hNc, 'X1'));
    b.wire(term(hNc, 'X2'), term(g, 'N'));

    const engine = engineOf(b);
    const idle = engine.start();
    expect(on(idle, hNo)).toBe(false);
    expect(on(idle, hNc)).toBe(true);

    engine.toggle(s);
    const live = engine.snapshot();
    expect(live.devices.get(k)?.energized).toBe(true);
    expect(on(live, hNo)).toBe(true);
    expect(on(live, hNc)).toBe(false);
  });
});

describe('temporizadores [R5 §13]', () => {
  it('el TON cierra su contacto recién al cumplirse el tiempo', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const s = b.device('switch-no', 30, 0);
    const t = b.device('timer-ton', 70, 0, { presetMs: 3000 });
    const h = b.device('pilot-lamp', 120, 0);
    b.wire(term(g, 'L'), term(s, '13'));
    b.wire(term(s, '14'), term(t, '7'));
    b.wire(term(t, '2'), term(g, 'N'));
    b.wire(term(g, 'L'), term(t, '8'));
    b.wire(term(t, '6'), term(h, 'X1'));
    b.wire(term(h, 'X2'), term(g, 'N'));

    const engine = engineOf(b);
    engine.start();
    engine.toggle(s);
    expect(on(engine.snapshot(), h)).toBe(false);
    engine.advanceTo(2999);
    expect(on(engine.snapshot(), h)).toBe(false);
    engine.advanceTo(3000);
    expect(on(engine.snapshot(), h)).toBe(true);
    expect(engine.snapshot().devices.get(t)?.timer?.phase).toBe('done');
  });

  it('el TOF sostiene su contacto hasta que pasa el tiempo', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const s = b.device('switch-no', 30, 0, { initiallyActuated: true });
    const t = b.device('timer-tof', 70, 0, { presetMs: 2000 });
    const h = b.device('pilot-lamp', 120, 0);
    b.wire(term(g, 'L'), term(s, '13'));
    b.wire(term(s, '14'), term(t, '7'));
    b.wire(term(t, '2'), term(g, 'N'));
    b.wire(term(g, 'L'), term(t, '8'));
    b.wire(term(t, '6'), term(h, 'X1'));
    b.wire(term(h, 'X2'), term(g, 'N'));

    const engine = engineOf(b);
    engine.start();
    expect(on(engine.snapshot(), h)).toBe(true);
    engine.advanceTo(1000);
    engine.toggle(s);
    expect(on(engine.snapshot(), h)).toBe(true);
    engine.advanceTo(2999);
    expect(on(engine.snapshot(), h)).toBe(true);
    engine.advanceTo(3000);
    expect(on(engine.snapshot(), h)).toBe(false);
  });
});

describe('selector de 3 posiciones [I3]', () => {
  it('cada posición alimenta su salida', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const s = b.device('selector-3', 40, 0);
    const h1 = b.device('pilot-lamp', 80, 0);
    const h2 = b.device('pilot-lamp', 110, 0);
    b.wire(term(g, 'L'), term(s, '1'));
    b.wire(term(s, '2'), term(h1, 'X1'));
    b.wire(term(s, '4'), term(h2, 'X1'));
    b.wire(term(h1, 'X2'), term(g, 'N'));
    b.wire(term(h2, 'X2'), term(g, 'N'));

    const engine = engineOf(b);
    const idle = engine.start();
    expect(on(idle, h1)).toBe(false);
    expect(on(idle, h2)).toBe(false);

    engine.setSelector(s, 1);
    expect(on(engine.snapshot(), h1)).toBe(true);
    engine.setSelector(s, 2);
    expect(on(engine.snapshot(), h1)).toBe(false);
    expect(on(engine.snapshot(), h2)).toBe(true);
  });
});

describe('parada de emergencia [I2]', () => {
  it('enclava al primer clic y se libera al segundo', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const e = b.device('emergency-stop', 30, 0);
    const h = b.device('pilot-lamp', 70, 0);
    b.wire(term(g, 'L'), term(e, '11'));
    b.wire(term(e, '12'), term(h, 'X1'));
    b.wire(term(h, 'X2'), term(g, 'N'));

    const engine = engineOf(b);
    expect(on(engine.start(), h)).toBe(true);
    engine.toggle(e);
    expect(on(engine.snapshot(), h)).toBe(false);
    engine.toggle(e);
    expect(on(engine.snapshot(), h)).toBe(true);
  });
});

describe('UPS [R5 §11]', () => {
  it('su salida alimenta aunque la entrada esté muerta', () => {
    const b = new BoardBuilder();
    const ups = b.device('ups', 0, 0);
    const h = b.device('pilot-lamp', 40, 0);
    b.wire(term(ups, 'L2'), term(h, 'X1'));
    b.wire(term(ups, 'N2'), term(h, 'X2'));
    expect(on(engineOf(b).start(), h)).toBe(true);
  });

  it('la entrada solo enciende su indicador', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 40);
    const ups = b.device('ups', 60, 0);
    b.wire(term(g, 'L'), term(ups, 'L1'));
    b.wire(term(g, 'N'), term(ups, 'N1'));
    const snap = engineOf(b).start();
    expect(snap.mode).toBe('running');
    expect(snap.devices.get(ups)?.energized).toBe(true);
  });

  it('mezclar su salida con la red es cortocircuito', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 40);
    const ups = b.device('ups', 60, 0);
    b.wire(term(g, 'L'), term(ups, 'L2'));
    const snap = engineOf(b).start();
    expect(snap.mode).toBe('error');
    if (snap.fault?.kind === 'short') expect(snap.fault.reason).toBe('phase-phase');
  });
});
