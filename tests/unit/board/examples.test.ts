import { describe, expect, it } from 'vitest';
import { boardRegistry } from '../../../src/core/board/catalog';
import { blockingDiagnostics, computeDiagnostics } from '../../../src/core/board/diagnostics';
import { BoardSimEngine } from '../../../src/core/board/sim/engine';
import { createCounterIdGen } from '../../../src/core/model/ids';
import { catalogBoard, selectorBoard, starterBoard, timerBoard } from '../../../src/examples/board';

const ctx = () => ({ ids: createCounterIdGen(), registry: boardRegistry });

describe('circuitos de ejemplo', () => {
  it('el arranque directo no tiene diagnósticos bloqueantes', () => {
    const doc = starterBoard(ctx());
    const blocking = blockingDiagnostics(computeDiagnostics(doc, boardRegistry));
    expect(blocking.map((d) => `${d.code} ${d.at ? `${d.at.x},${d.at.y}` : ''}`)).toEqual([]);
  });

  it('el arranque directo arranca, retiene y enciende el piloto', () => {
    const doc = starterBoard(ctx());
    const engine = new BoardSimEngine(doc, boardRegistry);
    engine.start();
    const idOf = (ref: string) => Object.values(doc.devices).find((d) => d.props.ref === ref)!.id;
    const k1 = idOf('K1');
    const h1 = idOf('H1');
    const s1 = idOf('S1');
    const s0 = idOf('S0');
    expect(engine.snapshot().devices.get(k1)?.energized).toBe(false);
    engine.press(s1);
    engine.release(s1);
    expect(engine.snapshot().devices.get(k1)?.energized).toBe(true);
    expect(engine.snapshot().devices.get(h1)?.energized).toBe(true);
    engine.press(s0);
    expect(engine.snapshot().devices.get(k1)?.energized).toBe(false);
  });

  it('el encendido retardado no tiene diagnósticos bloqueantes y enciende al cumplirse el tiempo', () => {
    const doc = timerBoard(ctx());
    const blocking = blockingDiagnostics(computeDiagnostics(doc, boardRegistry));
    expect(blocking.map((d) => `${d.code} ${d.at ? `${d.at.x},${d.at.y}` : ''}`)).toEqual([]);

    const engine = new BoardSimEngine(doc, boardRegistry);
    const idOf = (ref: string) => Object.values(doc.devices).find((d) => d.props.ref === ref)!.id;
    engine.start();
    engine.toggle(idOf('S1'));
    expect(engine.snapshot().devices.get(idOf('H1'))?.energized).toBe(false);
    engine.advanceTo(5000);
    expect(engine.snapshot().devices.get(idOf('H1'))?.energized).toBe(true);
  });

  it('el selector de 3 posiciones manda cada piloto por su posición [I3]', () => {
    const doc = selectorBoard(ctx());
    const blocking = blockingDiagnostics(computeDiagnostics(doc, boardRegistry));
    expect(blocking.map((d) => `${d.code} ${d.at ? `${d.at.x},${d.at.y}` : ''}`)).toEqual([]);

    const engine = new BoardSimEngine(doc, boardRegistry);
    const idOf = (ref: string) => Object.values(doc.devices).find((d) => d.props.ref === ref)!.id;
    const lit = (ref: string) => engine.snapshot().devices.get(idOf(ref))?.energized === true;
    engine.start();
    expect([lit('H1'), lit('H2')]).toEqual([false, false]);
    engine.setSelector(idOf('S1'), 1);
    expect([lit('H1'), lit('H2')]).toEqual([true, false]);
    engine.setSelector(idOf('S1'), 2);
    expect([lit('H1'), lit('H2')]).toEqual([false, true]);
    engine.setSelector(idOf('S1'), 0);
    expect([lit('H1'), lit('H2')]).toEqual([false, false]);
  });

  it('el catálogo de muestra no superpone aparatos', () => {
    const doc = catalogBoard(ctx());
    const blocking = blockingDiagnostics(computeDiagnostics(doc, boardRegistry));
    expect(blocking.map((d) => d.code)).toEqual([]);
  });
});
