import { createEmptyDocument, type OpContext } from '../../src/core/model/document';
import type { CircuitDocument, Id, Point, Rotation } from '../../src/core/model/types';
import { drawWire, placeComponent } from '../../src/core/topology/ops';
import { makeCtx } from './builder';

const P = (x: number, y: number): Point => ({ x, y });

/** Constructor fluido sobre las operaciones reales del núcleo (falla si alguna es inválida). */
export class Scenario {
  doc: CircuitDocument;
  readonly ids: Record<string, Id> = {};

  constructor(readonly ctx: OpContext = makeCtx()) {
    this.doc = createEmptyDocument('escenario');
  }

  place(name: string, type: string, x: number, y: number, rotation: Rotation = 0, props: Record<string, unknown> = {}): this {
    const r = placeComponent(this.doc, { type, position: P(x, y), rotation, props }, this.ctx);
    if (!r.ok) throw new Error(`No se pudo colocar ${name}: ${r.reason} ${r.violations.map((v) => v.key).join(' ')}`);
    this.doc = r.doc;
    this.ids[name] = r.componentId!;
    return this;
  }

  wire(...pts: [number, number][]): this {
    const r = drawWire(this.doc, pts.map(([x, y]) => P(x, y)), this.ctx);
    if (!r.ok) throw new Error(`Cable inválido ${JSON.stringify(pts)}: ${r.reason} ${r.violations.map((v) => v.key).join(' ')}`);
    this.doc = r.doc;
    return this;
  }
}

/**
 * Escalera clásica: fuente a la izquierda, riel de fase arriba (y=-10), riel de neutro abajo
 * (y=20), y tres ramas con interruptor + lámpara.
 */
export function ladder(ctx?: OpContext): Scenario {
  const s = new Scenario(ctx);
  s.place('G1', 'ac-source', 0, 5);
  s.wire([0, 2], [0, -10], [40, -10]);
  s.wire([0, 8], [0, 20], [40, 20]);
  for (const [i, x] of [10, 22, 34].entries()) {
    s.place(`S${i + 1}`, 'switch-no', x, -2);
    s.place(`H${i + 1}`, 'lamp', x, 10);
    s.wire([x, -10], [x, -5]);
    s.wire([x, 1], [x, 7]);
    s.wire([x, 13], [x, 20]);
  }
  return s;
}

/** Arranque directo con autorretención: marcha/paro, contactor, contacto de retención y lámpara. */
export function sealIn(ctx?: OpContext): Scenario {
  const s = new Scenario(ctx);
  s.place('G1', 'ac-source', 0, 5);
  s.wire([0, 2], [0, -12], [40, -12]);
  s.wire([0, 8], [0, 30], [40, 30]);
  s.place('S0', 'pushbutton-nc', 12, -6); // paro
  s.place('S1', 'pushbutton-no', 12, 4); // marcha
  s.place('K1', 'coil', 12, 20);
  s.place('K11', 'contact-no', 20, 4, 0, { link: 'K1' });
  s.place('K12', 'contact-no', 32, 10, 0, { link: 'K1' });
  s.place('H1', 'lamp', 32, 20);
  s.wire([12, -12], [12, -9]);
  s.wire([12, -3], [12, 1]);
  s.wire([12, 7], [12, 17]);
  s.wire([12, 23], [12, 30]);
  s.wire([12, -1], [20, -1], [20, 1]);
  s.wire([20, 7], [20, 12], [12, 12]);
  s.wire([32, -12], [32, 7]);
  s.wire([32, 13], [32, 17]);
  s.wire([32, 23], [32, 30]);
  return s;
}
