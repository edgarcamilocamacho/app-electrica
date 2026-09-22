import { describe, expect, it } from 'vitest';
import { BoardSimEngine } from '../../../src/core/board/sim/engine';
import { buildBoardSimModel } from '../../../src/core/board/sim/model';
import { BoardBuilder, registry, term } from '../../fixtures/board';

const engineOf = (b: BoardBuilder) => new BoardSimEngine(b.doc, registry);
const lampOn = (snap: ReturnType<BoardSimEngine['snapshot']>, id: string) =>
  snap.devices.get(id)?.energized === true;

describe('modelo de simulación por elementos', () => {
  it('traduce un contactor a una bobina y sus cinco contactos [R5 §1]', () => {
    const b = new BoardBuilder();
    const k = b.device('contactor-3p', 0, 0);
    const model = buildBoardSimModel(b.doc, registry);
    expect(model.actuators).toHaveLength(1);
    expect(model.actuators[0]!.kind).toBe('coil');
    expect(model.contacts).toHaveLength(5);
    expect(model.contactsOf.get(`${k}:K`)).toHaveLength(5);
    expect([...new Set(model.contacts.map((c) => c.deviceId))]).toEqual([k]);
  });
});

describe('simulación del tablero', () => {
  it('un piloto entre fase y neutro de la misma acometida enciende', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    b.wire(term(g, 'L'), term(h, 'X1'));
    b.wire(term(g, 'N'), term(h, 'X2'));
    const engine = engineOf(b);
    expect(lampOn(engine.start(), h)).toBe(true);
  });

  it('sin el retorno, el piloto queda apagado', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    b.wire(term(g, 'L'), term(h, 'X1'));
    const engine = engineOf(b);
    expect(lampOn(engine.start(), h)).toBe(false);
  });

  it('un pulsador NA enciende mientras se mantiene apretado', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const s = b.device('pushbutton-no', 0, 40);
    const h = b.device('pilot-lamp', 0, 80);
    b.wire(term(g, 'L'), term(s, '13'));
    b.wire(term(s, '14'), term(h, 'X1'));
    b.wire(term(g, 'N'), term(h, 'X2'));
    const engine = engineOf(b);
    expect(lampOn(engine.start(), h)).toBe(false);
    engine.press(s);
    expect(lampOn(engine.snapshot(), h)).toBe(true);
    engine.release(s);
    expect(lampOn(engine.snapshot(), h)).toBe(false);
  });

  it('el contactor cierra sus NA y abre su NC al energizar la bobina', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const s = b.device('pushbutton-no', 40, 0);
    const k = b.device('contactor-3p', 80, 0);
    const hOn = b.device('pilot-lamp', 120, 0);
    const hOff = b.device('pilot-lamp', 160, 0);
    // Mando: L → S1 → A1 ; A2 → N
    b.wire(term(g, 'L'), term(s, '13'));
    b.wire(term(s, '14'), term(k, 'A1'));
    b.wire(term(k, 'A2'), term(g, 'N'));
    // Potencia: L → 1 ; 2 → piloto ; piloto → N
    b.wire(term(g, 'L'), term(k, '1'));
    b.wire(term(k, '2'), term(hOn, 'X1'));
    b.wire(term(hOn, 'X2'), term(g, 'N'));
    // Auxiliar NC: L → 21 ; 22 → piloto ; piloto → N
    b.wire(term(g, 'L'), term(k, '21'));
    b.wire(term(k, '22'), term(hOff, 'X1'));
    b.wire(term(hOff, 'X2'), term(g, 'N'));

    const engine = engineOf(b);
    const idle = engine.start();
    expect(lampOn(idle, hOn)).toBe(false);
    expect(lampOn(idle, hOff)).toBe(true);
    expect(idle.devices.get(k)?.energized).toBe(false);

    engine.press(s);
    const on = engine.snapshot();
    expect(on.devices.get(k)?.energized).toBe(true);
    expect(lampOn(on, hOn)).toBe(true);
    expect(lampOn(on, hOff)).toBe(false);
    expect(on.devices.get(k)?.contacts.get(`${k}:1-2`)).toBe(true);
    expect(on.devices.get(k)?.contacts.get(`${k}:21-22`)).toBe(false);
  });

  it('el contacto auxiliar 13-14 retiene la bobina después de soltar el pulsador', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const marcha = b.device('pushbutton-no', 40, 0);
    const paro = b.device('pushbutton-nc', 80, 0);
    const k = b.device('contactor-3p', 120, 0);
    b.wire(term(g, 'L'), term(paro, '11'));
    b.wire(term(paro, '12'), term(marcha, '13'));
    b.wire(term(marcha, '14'), term(k, 'A1'));
    b.wire(term(k, 'A2'), term(g, 'N'));
    // Retención en paralelo con el pulsador de marcha.
    b.wire(term(paro, '12'), term(k, '13'));
    b.wire(term(k, '14'), term(k, 'A1'));

    const engine = engineOf(b);
    engine.start();
    engine.press(marcha);
    expect(engine.snapshot().devices.get(k)?.energized).toBe(true);
    engine.release(marcha);
    expect(engine.snapshot().devices.get(k)?.energized).toBe(true);
    engine.press(paro);
    expect(engine.snapshot().devices.get(k)?.energized).toBe(false);
    engine.release(paro);
    expect(engine.snapshot().devices.get(k)?.energized).toBe(false);
  });

  it('el taco abierto corta el circuito', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const q = b.device('breaker-1p', 40, 0, { initiallyActuated: false });
    const h = b.device('pilot-lamp', 80, 0);
    b.wire(term(g, 'L'), term(q, '1'));
    b.wire(term(q, '2'), term(h, 'X1'));
    b.wire(term(g, 'N'), term(h, 'X2'));
    const engine = engineOf(b);
    expect(lampOn(engine.start(), h)).toBe(false);
    engine.toggle(q);
    expect(lampOn(engine.snapshot(), h)).toBe(true);
  });

  it('fase y neutro unidos por un cable son cortocircuito y congelan todo [R5 §14]', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    b.wire(term(g, 'L'), term(g, 'N'), { bends: [{ x: -2, y: 20 }, { x: 2, y: 20 }] });
    const engine = engineOf(b);
    const snap = engine.start();
    expect(snap.mode).toBe('error');
    expect(snap.fault?.kind).toBe('short');
    if (snap.fault?.kind === 'short') {
      expect(snap.fault.reason).toBe('phase-neutral');
      expect(snap.fault.devices).toContain(g);
    }
  });

  it('una carga con fase de una acometida y neutro de otra no enciende [R2 §9]', () => {
    const b = new BoardBuilder();
    const g1 = b.device('supply-1p', 0, 0);
    const g2 = b.device('supply-1p', 60, 0);
    const h = b.device('pilot-lamp', 30, 40);
    b.wire(term(g1, 'L'), term(h, 'X1'));
    b.wire(term(g2, 'N'), term(h, 'X2'));
    const engine = engineOf(b);
    const snap = engine.start();
    expect(snap.mode).toBe('running');
    expect(lampOn(snap, h)).toBe(false);
    expect(snap.devices.get(h)?.mismatchedSupply).toBe(true);
  });

  it('dos fases de acometidas distintas en el mismo nodo son corto', () => {
    const b = new BoardBuilder();
    const g1 = b.device('supply-1p', 0, 0);
    const g2 = b.device('supply-1p', 60, 0);
    b.wire(term(g1, 'L'), term(g2, 'L'));
    const engine = engineOf(b);
    const snap = engine.start();
    expect(snap.mode).toBe('error');
    if (snap.fault?.kind === 'short') expect(snap.fault.reason).toBe('phase-phase');
  });

  it('en ERROR ya no responde a los pulsadores [R5 §14]', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const s = b.device('pushbutton-no', 40, 0);
    b.wire(term(g, 'L'), term(g, 'N'), { bends: [{ x: -2, y: 20 }, { x: 2, y: 20 }] });
    const engine = engineOf(b);
    engine.start();
    engine.press(s);
    expect(engine.snapshot().devices.get(s)?.actuated).toBe(false);
    expect(engine.isError).toBe(true);
  });
});
