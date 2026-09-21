import { createEmptyDocument, type OpContext } from '../core/model/document';
import { createCounterIdGen } from '../core/model/ids';
import type { CircuitDocument, Rotation } from '../core/model/types';
import { defaultRegistry } from '../core/registry/catalog';
import { addAnnotation, drawWire, placeComponent } from '../core/topology/ops';

/**
 * Circuitos de ejemplo (RESPONSE_ROUND_2 §30.4). Se construyen con las mismas operaciones del
 * editor, así siempre respetan las reglas vigentes; también sirven de fixtures para los E2E.
 * Los textos visibles (nombre, anotaciones) llegan desde la UI para respetar el i18n.
 */
export type ExampleId = 'lamp' | 'seal-in' | 'ton' | 'tof' | 'selector';

export const EXAMPLE_IDS: readonly ExampleId[] = ['lamp', 'seal-in', 'ton', 'tof', 'selector'];

export interface ExampleTexts {
  readonly name: string;
  readonly note: string;
}

class ExampleBuilder {
  private readonly ctx: OpContext = { ids: createCounterIdGen(), registry: defaultRegistry };
  doc: CircuitDocument;

  constructor(name: string) {
    this.doc = createEmptyDocument(name);
  }

  place(type: string, x: number, y: number, props: Record<string, unknown> = {}, rotation: Rotation = 0): this {
    const r = placeComponent(this.doc, { type, position: { x, y }, rotation, props }, this.ctx);
    if (!r.ok) throw new Error(`Ejemplo inválido: ${type} en ${x},${y}`);
    this.doc = r.doc;
    return this;
  }

  wire(...pts: [number, number][]): this {
    const r = drawWire(this.doc, pts.map(([x, y]) => ({ x, y })), this.ctx);
    if (!r.ok) throw new Error(`Ejemplo inválido: cable ${JSON.stringify(pts)}`);
    this.doc = r.doc;
    return this;
  }

  note(x: number, y: number, text: string): this {
    this.doc = addAnnotation(this.doc, { x, y }, text, this.ctx).doc;
    return this;
  }

  /** Fuente en (0, sy) con rieles de fase (arriba) y neutro (abajo) hasta x = width. */
  rails(sy: number, top: number, bottom: number, width: number): this {
    this.place('ac-source', 0, sy);
    this.wire([0, sy - 3], [0, top], [width, top]);
    this.wire([0, sy + 3], [0, bottom], [width, bottom]);
    return this;
  }
}

const builders: Record<ExampleId, (texts: ExampleTexts) => CircuitDocument> = {
  lamp: (t) =>
    new ExampleBuilder(t.name)
      .rails(10, -4, 24, 20)
      .place('switch-no', 12, 3)
      .place('lamp', 12, 13, { color: 'amber' })
      .wire([12, -4], [12, 0])
      .wire([12, 6], [12, 10])
      .wire([12, 16], [12, 24])
      .note(-2, -8, t.note).doc,

  'seal-in': (t) =>
    new ExampleBuilder(t.name)
      .rails(14, -6, 34, 36)
      .place('emergency-stop', 12, -1)
      .place('pushbutton-nc', 12, 7)
      .place('pushbutton-no', 12, 15)
      .place('coil', 12, 25)
      .place('contact-no', 18, 15, { link: 'K1' })
      .place('contact-no', 30, 7, { link: 'K1' })
      .place('lamp', 30, 17, { color: 'green' })
      .wire([12, -6], [12, -4])
      .wire([12, 2], [12, 4])
      .wire([12, 10], [12, 12])
      .wire([12, 18], [12, 22])
      .wire([12, 28], [12, 34])
      .wire([12, 11], [18, 11], [18, 12])
      .wire([18, 18], [18, 20], [12, 20])
      .wire([30, -6], [30, 4])
      .wire([30, 10], [30, 14])
      .wire([30, 20], [30, 34])
      .note(-2, -10, t.note).doc,

  ton: (t) =>
    new ExampleBuilder(t.name)
      .rails(10, -4, 24, 30)
      .place('switch-no', 12, 3)
      .place('timer-ton', 12, 13, { presetMs: 3000 })
      .place('timed-contact-no', 24, 3, { link: 'T1' })
      .place('lamp', 24, 13, { color: 'amber' })
      .wire([12, -4], [12, 0])
      .wire([12, 6], [12, 10])
      .wire([12, 16], [12, 24])
      .wire([24, -4], [24, 0])
      .wire([24, 6], [24, 10])
      .wire([24, 16], [24, 24])
      .note(-2, -8, t.note).doc,

  tof: (t) =>
    new ExampleBuilder(t.name)
      .rails(10, -4, 24, 30)
      .place('switch-no', 12, 3)
      .place('timer-tof', 12, 13, { presetMs: 3000 })
      .place('timed-contact-no', 24, 3, { link: 'T1' })
      .place('lamp', 24, 13, { color: 'red' })
      .wire([12, -4], [12, 0])
      .wire([12, 6], [12, 10])
      .wire([12, 16], [12, 24])
      .wire([24, -4], [24, 0])
      .wire([24, 6], [24, 10])
      .wire([24, 16], [24, 24])
      .note(-2, -8, t.note).doc,

  selector: (t) =>
    new ExampleBuilder(t.name)
      .rails(10, -4, 24, 30)
      .place('selector-3', 14, 2)
      .place('lamp', 12, 13, { color: 'green' })
      .place('lamp', 24, 13, { color: 'blue' })
      .wire([14, -4], [14, -1])
      .wire([12, 5], [12, 10])
      .wire([16, 5], [16, 7], [24, 7], [24, 10])
      .wire([12, 16], [12, 24])
      .wire([24, 16], [24, 24])
      .note(-2, -8, t.note).doc,
};

export function buildExample(id: ExampleId, texts: ExampleTexts): CircuitDocument {
  return builders[id](texts);
}
