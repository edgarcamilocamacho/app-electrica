import type { OpContext } from '../../src/core/model/document';
import type { Id } from '../../src/core/model/types';
import { SimEngine } from '../../src/core/sim/engine';
import { defaultRegistry } from '../../src/core/registry/catalog';
import { Scenario } from './scenarios';

export interface RungDevice {
  readonly name: string;
  readonly type: string;
  readonly props?: Record<string, unknown>;
}

export const TOP_RAIL = -10;
export const BOTTOM_RAIL = 50;

/**
 * Circuito en escalera con una fuente G1: riel de fase arriba (y = −10), riel de neutro abajo
 * (y = 50) y una rama vertical por cada lista de dispositivos, en x = 10, 20, 30…
 * Todo se construye con las operaciones reales del editor.
 */
export function ladderCircuit(rungs: readonly (readonly RungDevice[])[], ctx?: OpContext): Scenario {
  const s = new Scenario(ctx);
  const width = rungs.length * 10 + 10;
  s.place('G1', 'ac-source', 0, 20); // L (0,17) · N (0,23)
  s.wire([0, 17], [0, TOP_RAIL], [width, TOP_RAIL]);
  s.wire([0, 23], [0, BOTTOM_RAIL], [width, BOTTOM_RAIL]);
  rungs.forEach((devices, i) => {
    const x = 10 + i * 10;
    let prevBottom = TOP_RAIL;
    devices.forEach((d, j) => {
      const top = TOP_RAIL + 2 + j * 8;
      s.place(d.name, d.type, x, top + 3, 0, d.props ?? {});
      s.wire([x, prevBottom], [x, top]);
      prevBottom = top + 6;
    });
    s.wire([x, prevBottom], [x, BOTTOM_RAIL]);
  });
  return s;
}

export function engineFor(s: Scenario): SimEngine {
  const engine = new SimEngine(s.doc, defaultRegistry);
  engine.start();
  return engine;
}

export function view(engine: SimEngine, s: Scenario, name: string) {
  const id: Id = s.ids[name]!;
  return engine.snapshot().devices.get(id);
}
