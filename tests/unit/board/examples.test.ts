import { describe, expect, it } from 'vitest';
import { boardRegistry } from '../../../src/core/board/catalog';
import { blockingDiagnostics, computeDiagnostics } from '../../../src/core/board/diagnostics';
import { BoardSimEngine } from '../../../src/core/board/sim/engine';
import { createCounterIdGen } from '../../../src/core/model/ids';
import { catalogBoard, starterBoard } from '../../../src/examples/board';

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

  it('el catálogo de muestra no superpone aparatos', () => {
    const doc = catalogBoard(ctx());
    const blocking = blockingDiagnostics(computeDiagnostics(doc, boardRegistry));
    expect(blocking.map((d) => d.code)).toEqual([]);
  });
});
