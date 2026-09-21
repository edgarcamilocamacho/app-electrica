import { describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../../../src/core/model/document';
import { canonicalize } from '../../../src/core/topology/canonicalize';
import {
  deleteSelection,
  drawWire,
  eraseTarget,
  moveSegment,
  moveSelection,
  placeComponent,
  rotateComponent,
} from '../../../src/core/topology/ops';
import { computeViolations } from '../../../src/core/topology/validity';
import type { CircuitDocument, Id, Point } from '../../../src/core/model/types';
import { selectionOf } from '../../../src/core/model/selection';
import { DocBuilder, makeCtx } from '../../fixtures/builder';
import { classAt, expectNoAmbiguity, expectValid, netCount, partition, sameNet, spans, vertexAt } from '../../fixtures/queries';

const P = (x: number, y: number): Point => ({ x, y });

function empty() {
  return { doc: createEmptyDocument('t'), ctx: makeCtx() };
}

function wire(doc: CircuitDocument, ctx: ReturnType<typeof makeCtx>, ...pts: Point[]) {
  return expectValid(drawWire(doc, pts, ctx));
}

function place(doc: CircuitDocument, ctx: ReturnType<typeof makeCtx>, type: string, x: number, y: number, rotation: 0 | 90 | 180 | 270 = 0) {
  const r = placeComponent(doc, { type, position: P(x, y), rotation }, ctx);
  return { doc: expectValid(r), id: r.componentId! };
}

describe('Segmentos (R1 §14)', () => {
  it('una polilínea con un codo tiene dos segmentos seleccionables', () => {
    const { doc, ctx } = empty();
    const d = wire(doc, ctx, P(0, 0), P(5, 0), P(5, 4));
    expect(spans(d)).toEqual(['0,0-5,0', '5,0-5,4']);
    expect(classAt(d, 5, 0)).toBe('corner');
    expect(classAt(d, 0, 0)).toBe('free-end');
  });

  it('borrar solo el segmento horizontal mantiene el vertical', () => {
    const { doc, ctx } = empty();
    const d = wire(doc, ctx, P(0, 0), P(5, 0), P(5, 4));
    const horizontal = Object.values(d.segments).find((s) => d.vertices[s.a] && spans({ ...d, segments: { [s.id]: s } })[0] === '0,0-5,0')!;
    const out = expectValid(eraseTarget(d, { kind: 'segment', id: horizontal.id }, ctx));
    expect(spans(out)).toEqual(['5,0-5,4']);
    expect(classAt(out, 5, 0)).toBe('free-end');
  });

  it('borrar el segmento central de una red lineal la parte en dos', () => {
    const { doc, ctx } = empty();
    let d = doc;
    const h1 = place(d, ctx, 'lamp', 0, 0);
    d = h1.doc;
    const h2 = place(d, ctx, 'lamp', 10, 0);
    d = h2.doc;
    d = wire(d, ctx, P(0, 3), P(0, 6), P(10, 6), P(10, 3));
    expect(sameNet(d, [h1.id, 'X2'], [h2.id, 'X2'])).toBe(true);
    const central = vertexAt(d, 0, 6)!;
    const seg = Object.values(d.segments).find((s) => (s.a === central || s.b === central) && spans({ ...d, segments: { [s.id]: s } })[0] === '0,6-10,6')!;
    const out = expectValid(eraseTarget(d, { kind: 'segment', id: seg.id }, ctx));
    expect(sameNet(out, [h1.id, 'X2'], [h2.id, 'X2'])).toBe(false);
  });

  it('dos segmentos colineales consecutivos sin punto significativo se fusionan', () => {
    const { doc, ctx } = empty();
    const d = wire(doc, ctx, P(0, 0), P(3, 0), P(7, 0));
    expect(spans(d)).toEqual(['0,0-7,0']);
  });

  it('continuar un cable desde el extremo libre de otro en línea recta los fusiona', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(4, 0));
    d = wire(d, ctx, P(4, 0), P(9, 0));
    expect(spans(d)).toEqual(['0,0-9,0']);
  });
});

describe('Derivaciones (R1 §4, §14)', () => {
  it('iniciar una conexión en medio de un segmento lo divide y crea un junction visible', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(10, 0));
    d = wire(d, ctx, P(4, 0), P(4, 5));
    expect(spans(d)).toEqual(['0,0-4,0', '4,0-10,0', '4,0-4,5']);
    expect(classAt(d, 4, 0)).toBe('junction');
    expect(netCount(d)).toBe(1);
  });

  it('terminar un cable en medio de otro también crea el junction', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(10, 0));
    d = wire(d, ctx, P(4, 5), P(4, 0));
    expect(classAt(d, 4, 0)).toBe('junction');
    expect(netCount(d)).toBe(1);
  });
});

describe('Terminal sobre cable (R1 §5, §14)', () => {
  it('colocar un componente con un terminal sobre un segmento lo conecta y lo parte', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(10, 0), P(10, 10));
    const h = place(d, ctx, 'lamp', 4, 3); // X1 en (4,0)
    d = h.doc;
    expect(spans(d)).toEqual(['0,0-4,0', '10,0-10,10', '4,0-10,0']);
    expect(classAt(d, 4, 0)).toBe('junction');
    const nets = partition(d).find((g) => g.includes(`${h.id}:X1`))!;
    expect(nets).toEqual([`${h.id}:X1`]); // único terminal de esa red, pero la red tiene los tramos
    expect(netCount(d)).toBe(1);
  });

  it('el documento original no se modifica (inmutabilidad → undo exacto)', () => {
    const { doc, ctx } = empty();
    const d = wire(doc, ctx, P(0, 0), P(10, 0));
    const snapshot = JSON.stringify(d);
    placeComponent(d, { type: 'lamp', position: P(4, 3), rotation: 0 }, ctx);
    expect(JSON.stringify(d)).toBe(snapshot);
  });

  it('inserción en serie: los dos terminales sobre el mismo tramo recto (R3 Q3.3)', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(0, 20));
    const s = place(d, ctx, 'switch-no', 0, 10); // 13 en (0,7), 14 en (0,13)
    d = s.doc;
    expect(spans(d)).toEqual(['0,0-0,7', '0,13-0,20']);
    expect(sameNet(d, [s.id, '13'], [s.id, '14'])).toBe(false);
  });

  it('dos terminales sobre la misma red pero no el mismo tramo: ambos se conectan (componente puenteado)', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 7), P(3, 7), P(3, 13), P(0, 13));
    const s = place(d, ctx, 'switch-no', 0, 10);
    d = s.doc;
    expect(sameNet(d, [s.id, '13'], [s.id, '14'])).toBe(true);
  });
});

/** Circuito base: bobina K1 arriba, lámpara H1 abajo, unidas por un cable recto. */
function coilAndLamp() {
  const { doc, ctx } = empty();
  let d = doc;
  const k = place(d, ctx, 'coil', 10, -5); // A2 en (10,-2)
  d = k.doc;
  const h = place(d, ctx, 'lamp', 10, 5); // X1 en (10,2)
  d = h.doc;
  d = wire(d, ctx, P(10, -2), P(10, 2));
  return { d, ctx, k: k.id, h: h.id };
}

describe('Movimiento (R1 §6, §14; R2 §2)', () => {
  it('mover un componente conectado conserva la conectividad', () => {
    const { d, ctx, k, h } = coilAndLamp();
    const out = expectValid(moveSelection(d, selectionOf({ components: [h] }), P(6, 4), ctx));
    expect(partition(out)).toEqual(partition(d));
    expect(sameNet(out, [k, 'A2'], [h, 'X1'])).toBe(true);
  });

  it('bajarlo desde una T alarga el tramo vertical y no toca el junction', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(20, 0));
    const h = place(d, ctx, 'lamp', 10, 5); // X1 (10,2)
    d = wire(h.doc, ctx, P(10, 0), P(10, 2));
    expect(classAt(d, 10, 0)).toBe('junction');
    const out = expectValid(moveSelection(d, selectionOf({ components: [h.id] }), P(0, 3), ctx));
    expect(spans(out)).toEqual(['0,0-10,0', '10,0-10,5', '10,0-20,0']);
    expect(classAt(out, 10, 0)).toBe('junction');
  });

  it('moverlo lateralmente crea varios segmentos ortogonales', () => {
    const { d, ctx, h } = coilAndLamp();
    expect(Object.keys(d.segments)).toHaveLength(1);
    const out = expectValid(moveSelection(d, selectionOf({ components: [h] }), P(4, 3), ctx));
    expect(Object.keys(out.segments).length).toBeGreaterThanOrEqual(2);
    expect(partition(out)).toEqual(partition(d));
  });

  it('una esquina se desliza sobre su tramo en vez de agregar codos', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(10, 0));
    const h = place(d, ctx, 'lamp', 10, 5);
    d = wire(h.doc, ctx, P(10, 0), P(10, 2)); // (10,0) es esquina
    const out = expectValid(moveSelection(d, selectionOf({ components: [h.id] }), P(4, 3), ctx));
    expect(spans(out)).toEqual(['0,0-14,0', '14,0-14,5']);
  });

  it('un cable suelto colgado del componente viaja con él', () => {
    const { doc, ctx } = empty();
    const h = place(doc, ctx, 'lamp', 0, 0);
    const d = wire(h.doc, ctx, P(0, 3), P(0, 8)); // extremo libre en (0,8)
    const out = expectValid(moveSelection(d, selectionOf({ components: [h.id] }), P(5, 1), ctx));
    expect(spans(out)).toEqual(['5,4-5,9']);
  });

  it('ningún movimiento inventa una conexión con un cable que simplemente se cruza', () => {
    const { d: base, ctx, k, h } = coilAndLamp();
    // Cable de otra red que cruza en perpendicular por y=0.
    const d = wire(base, ctx, P(0, 0), P(30, 0));
    expectNoAmbiguity(d);
    const before = partition(d);
    for (const delta of [P(3, 2), P(-4, 1), P(6, 0), P(0, 5)]) {
      const r = moveSelection(d, selectionOf({ components: [h] }), delta, ctx);
      if (!r.ok) continue;
      expect(partition(r.doc)).toEqual(before);
      expect(netCount(r.doc)).toBe(netCount(d));
      expect(sameNet(r.doc, [k, 'A2'], [h, 'X1'])).toBe(true);
    }
  });

  it('un terminal ya conectado no puede caer sobre un conductor de otra red (R2 §2)', () => {
    const { d: base, ctx, h } = coilAndLamp();
    const d = wire(base, ctx, P(0, 20), P(30, 20)); // otra red
    // Bajar la lámpara para que X1 (conectado) caiga en (10,20).
    const r = moveSelection(d, selectionOf({ components: [h] }), P(0, 18), ctx);
    expect(r.ok).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
  });

  it('un terminal libre que cae sobre un conductor se conecta al soltar', () => {
    const { d: base, ctx, h } = coilAndLamp();
    const d = wire(base, ctx, P(0, 20), P(30, 20));
    // X2 (libre) de la lámpara en (10,8) → (10,20) si baja 12.
    const out = expectValid(moveSelection(d, selectionOf({ components: [h] }), P(0, 12), ctx));
    expect(classAt(out, 10, 20)).toBe('junction');
  });

  it('una posición inválida no rompe el documento original y la vista previa marca el motivo', () => {
    const { d: base, ctx, h } = coilAndLamp();
    const d = wire(base, ctx, P(0, 20), P(30, 20));
    const snapshot = JSON.stringify(d);
    const r = moveSelection(d, selectionOf({ components: [h] }), P(0, 18), ctx);
    expect(r.reason).toBe('AMBIGUOUS');
    expect(JSON.stringify(d)).toBe(snapshot);
  });

  it('mover un grupo mueve rígido lo interno y repara lo que sale del grupo', () => {
    const { d, ctx, k, h } = coilAndLamp();
    const segId = Object.keys(d.segments)[0]!;
    const out = expectValid(moveSelection(d, selectionOf({ components: [k, h], segments: [segId] }), P(7, -3), ctx));
    expect(spans(out)).toEqual(['17,-5-17,-1']);
  });

  it('es determinista: la misma operación da exactamente el mismo documento', () => {
    const a = coilAndLamp();
    const b = coilAndLamp();
    const ra = moveSelection(a.d, selectionOf({ components: [a.h] }), P(4, 3), a.ctx);
    const rb = moveSelection(b.d, selectionOf({ components: [b.h] }), P(4, 3), b.ctx);
    expect(ra.doc).toEqual(rb.doc);
  });
});

describe('Rotación', () => {
  it('rotar un componente cableado repara sus cables sin romper conexiones', () => {
    const { d, ctx, k, h } = coilAndLamp();
    const out = expectValid(rotateComponent(d, h, ctx));
    expect(out.components[h]!.rotation).toBe(90);
    expect(sameNet(out, [k, 'A2'], [h, 'X1'])).toBe(true);
  });

  it('una rotación que produciría ambigüedad se rechaza (R3 Q3.5)', () => {
    const { doc, ctx } = empty();
    const h = place(doc, ctx, 'lamp', 0, 0);
    let d = wire(h.doc, ctx, P(0, -3), P(0, -8), P(10, -8));
    // Cable de otra red justo donde caería X1 al rotar (3,0).
    d = wire(d, ctx, P(3, -5), P(3, 5));
    const r = rotateComponent(d, h.id, ctx);
    expect(r.ok).toBe(false);
  });
});

describe('Mover un segmento (R2 §3)', () => {
  it('esquinas y extremos libres viajan con el segmento; los vecinos se estiran', () => {
    const { doc, ctx } = empty();
    const d = wire(doc, ctx, P(0, 0), P(10, 0), P(10, 5));
    const horizontal = Object.values(d.segments).find((s) => spans({ ...d, segments: { [s.id]: s } })[0] === '0,0-10,0')!;
    const out = expectValid(moveSegment(d, horizontal.id, -2, ctx));
    expect(spans(out)).toEqual(['0,-2-10,-2', '10,-2-10,5']);
  });

  it('un junction queda anclado y se agrega un tramo nuevo', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(20, 0));
    d = wire(d, ctx, P(10, 0), P(10, 5));
    const right = Object.values(d.segments).find((s) => spans({ ...d, segments: { [s.id]: s } })[0] === '10,0-20,0')!;
    const out = expectValid(moveSegment(d, right.id, -3, ctx));
    expect(spans(out)).toEqual(['0,0-10,0', '10,-3-10,0', '10,-3-20,-3', '10,0-10,5']);
    expect(netCount(out)).toBe(1);
  });

  it('un terminal queda anclado', () => {
    const { doc, ctx } = empty();
    const h = place(doc, ctx, 'lamp', 0, 0); // X2 (0,3)
    const d = wire(h.doc, ctx, P(0, 3), P(0, 6), P(8, 6));
    const bottom = Object.values(d.segments).find((s) => spans({ ...d, segments: { [s.id]: s } })[0] === '0,6-8,6')!;
    const out = expectValid(moveSegment(d, bottom.id, 2, ctx));
    expect(spans(out)).toEqual(['0,3-0,8', '0,8-8,8']);
  });

  it('nunca crea conexiones: apoyar el extremo libre sobre otra red es inválido', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(0, 5)); // vertical, extremo libre abajo en (0,5)
    d = wire(d, ctx, P(-5, 8), P(5, 8)); // otra red en y=8
    const vertical = Object.keys(d.segments).find((id) => spans({ ...d, segments: { [id]: d.segments[id]! } })[0] === '0,0-0,5')!;
    // Mover el vertical en x no llega; alargar no es mover. Movemos un tramo horizontal que termina encima.
    const d2 = wire(d, ctx, P(0, 5), P(3, 5)); // codo: (0,5) esquina, (3,5) extremo libre
    const horizontal = Object.keys(d2.segments).find((id) => spans({ ...d2, segments: { [id]: d2.segments[id]! } })[0] === '0,5-3,5')!;
    void vertical;
    const r = moveSegment(d2, horizontal, 3, ctx); // baja a y=8: se apoya sobre la otra red
    expect(r.ok).toBe(false);
    expect(netCount(r.doc)).toBe(2);
  });
});

describe('Extremos libres (R1 §9, §14)', () => {
  it('borrar un componente deja extremos libres y conserva el cableado', () => {
    const { d, ctx, h } = coilAndLamp();
    const out = expectValid(eraseTarget(d, { kind: 'component', id: h }, ctx));
    expect(out.components[h]).toBeUndefined();
    expect(spans(out)).toEqual(['10,-2-10,2']);
    expect(classAt(out, 10, 2)).toBe('free-end');
  });

  it('colocar después un terminal sobre el extremo libre lo reconecta', () => {
    const { d, ctx, k, h } = coilAndLamp();
    const erased = expectValid(eraseTarget(d, { kind: 'component', id: h }, ctx));
    const again = place(erased, ctx, 'lamp', 10, 5);
    expect(sameNet(again.doc, [k, 'A2'], [again.id, 'X1'])).toBe(true);
  });

  it('se puede trazar un cable nuevo desde un extremo libre', () => {
    const { d, ctx } = coilAndLamp();
    const erased = expectValid(eraseTarget(d, { kind: 'component', id: Object.keys(d.components)[1]! }, ctx));
    const out = wire(erased, ctx, P(10, 2), P(10, 6), P(15, 6));
    expect(spans(out)).toEqual(['10,-2-10,6', '10,6-15,6']);
  });

  it('se puede dibujar a propósito un cable que termina en el vacío (R2 §4)', () => {
    const { doc, ctx } = empty();
    const out = wire(doc, ctx, P(0, 0), P(0, 5));
    expect(classAt(out, 0, 0)).toBe('free-end');
    expect(classAt(out, 0, 5)).toBe('free-end');
  });
});

describe('Goma (R2 §5)', () => {
  it('clic en un junction borra todos los segmentos incidentes', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(10, 0));
    d = wire(d, ctx, P(5, 0), P(5, 5));
    const out = expectValid(eraseTarget(d, { kind: 'vertex', id: vertexAt(d, 5, 0)! }, ctx));
    expect(spans(out)).toEqual([]);
  });

  it('clic en un junction que es terminal borra también el componente', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(10, 0));
    const h = place(d, ctx, 'lamp', 4, 3); // X1 en (4,0), grado 2
    d = wire(h.doc, ctx, P(4, 6), P(4, 10)); // X2 con un cable
    const out = expectValid(eraseTarget(d, { kind: 'vertex', id: vertexAt(d, 4, 0)! }, ctx));
    expect(out.components[h.id]).toBeUndefined();
    expect(spans(out)).toEqual(['4,6-4,10']);
    expect(classAt(out, 4, 6)).toBe('free-end');
  });

  it('clic en una esquina borra los dos segmentos que la forman', () => {
    const { doc, ctx } = empty();
    const d = wire(doc, ctx, P(0, 0), P(5, 0), P(5, 5), P(9, 5));
    const out = expectValid(eraseTarget(d, { kind: 'vertex', id: vertexAt(d, 5, 0)! }, ctx));
    expect(spans(out)).toEqual(['5,5-9,5']);
  });

  it('clic en un extremo libre borra el segmento completo hasta el siguiente vértice', () => {
    const { doc, ctx } = empty();
    const d = wire(doc, ctx, P(0, 0), P(8, 0), P(8, 4));
    const out = expectValid(eraseTarget(d, { kind: 'vertex', id: vertexAt(d, 0, 0)! }, ctx));
    expect(spans(out)).toEqual(['8,0-8,4']);
  });

  it('clic en un terminal con un solo cable borra el componente (R3 Q3.6)', () => {
    const { d, ctx, h } = coilAndLamp();
    const out = expectValid(eraseTarget(d, { kind: 'vertex', id: vertexAt(d, 10, 2)! }, ctx));
    expect(out.components[h]).toBeUndefined();
    expect(spans(out)).toEqual(['10,-2-10,2']);
  });

  it('terminal sobre terminal: la goma sobre el punto borra los dos componentes (I14)', () => {
    const { doc, ctx } = empty();
    const k = place(doc, ctx, 'coil', 0, 0); // A2 (0,3)
    const h = place(k.doc, ctx, 'lamp', 0, 6); // X1 (0,3): se conecta a A2
    expect(sameNet(h.doc, [k.id, 'A2'], [h.id, 'X1'])).toBe(true);
    expect(classAt(h.doc, 0, 3)).toBe('junction');
    const out = expectValid(eraseTarget(h.doc, { kind: 'vertex', id: vertexAt(h.doc, 0, 3)! }, ctx));
    expect(Object.keys(out.components)).toEqual([]);
  });

  it('borrar una selección múltiple es una sola operación', () => {
    const { d, ctx, k, h } = coilAndLamp();
    const out = expectValid(deleteSelection(d, selectionOf({ components: [k, h] }), ctx));
    expect(Object.keys(out.components)).toEqual([]);
    expect(spans(out)).toEqual(['10,-2-10,2']);
  });
});

describe('Cruces (R1 §7, §14; R3 Q3.1)', () => {
  it('dos segmentos cruzados sin junction siguen en redes distintas', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 5), P(10, 5));
    d = wire(d, ctx, P(5, 0), P(5, 10));
    expect(netCount(d)).toBe(2);
    expectNoAmbiguity(d);
  });

  it('agregar un junction explícito sí las fusiona', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 5), P(10, 5));
    d = wire(d, ctx, P(5, 0), P(5, 10));
    d = wire(d, ctx, P(2, 5), P(2, 8), P(5, 8));
    expect(netCount(d)).toBe(1);
  });

  it('un cable que pasa sobre un terminal ajeno es inválido y no conecta', () => {
    const { doc, ctx } = empty();
    const h = place(doc, ctx, 'lamp', 5, 3); // X1 libre en (5,0)
    const r = drawWire(h.doc, [P(0, 0), P(10, 0)], ctx);
    expect(r.ok).toBe(false);
    expect(r.violations.map((v) => v.code)).toContain('V2');
    expect(sameNet(r.doc, [h.id, 'X1'], [h.id, 'X2'])).toBe(false);
    expect(netCount(r.doc)).toBe(1);
  });

  it('superponer un cable sobre otro de otra red es inválido (V1)', () => {
    const { doc, ctx } = empty();
    const d = wire(doc, ctx, P(0, 0), P(10, 0));
    // Un cable nuevo por la misma línea, sin terminar sobre la otra red: se superpone.
    const r = drawWire(d, [P(-5, 0), P(15, 0)], ctx);
    expect(r.ok).toBe(false);
    expect(r.violations.map((v) => v.code)).toContain('V1');
    // Lo mismo moviendo un segmento de otra red encima.
    const d2 = wire(d, ctx, P(5, 3), P(15, 3));
    const other = Object.keys(d2.segments).find((id) => spans({ ...d2, segments: { [id]: d2.segments[id]! } })[0] === '5,3-15,3')!;
    const moved = moveSegment(d2, other, -3, ctx);
    expect(moved.ok).toBe(false);
    expect(moved.violations.map((v) => v.code)).toContain('V1');
  });

  it('T sin punto entre redes distintas es inválida (V2)', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(10, 0));
    d = wire(d, ctx, P(5, 8), P(5, 3), P(9, 3)); // extremo libre (9,3); tramo vertical x=5 de 3..8
    const horizontal = Object.keys(d.segments).find((id) => spans({ ...d, segments: { [id]: d.segments[id]! } })[0] === '5,3-9,3')!;
    const r = moveSegment(d, horizontal, -3, ctx); // sube a y=0: el codo (5,0) toca la otra red
    expect(r.ok).toBe(false);
    expect(r.violations.map((v) => v.code).some((c) => c === 'V1' || c === 'V2' || c === 'V3')).toBe(true);
  });

  it('puntos coincidentes de redes distintas son inválidos (V3)', () => {
    const { doc, ctx } = empty();
    let d = wire(doc, ctx, P(0, 0), P(4, 0), P(4, 4)); // esquina (4,0)
    d = wire(d, ctx, P(10, 0), P(6, 0), P(6, -4)); // esquina (6,0)
    const piece = Object.keys(d.segments).find((id) => spans({ ...d, segments: { [id]: d.segments[id]! } })[0] === '6,-4-6,0')!;
    const r = moveSegment(d, piece, -2, ctx); // la esquina (6,0) pasa a (4,0)
    expect(r.ok).toBe(false);
  });

  it('una operación válida sobre un documento que ya traía un solapamiento no se rechaza', () => {
    const b = new DocBuilder();
    b.wire({ x: 0, y: 0 }, { x: 10, y: 0 });
    b.wire({ x: 5, y: 0 }, { x: 15, y: 0 }); // otra red superpuesta (documento "importado")
    const d = canonicalize(b.build(), b.ctx);
    expect(computeViolations(d, b.ctx.registry).length).toBeGreaterThan(0);
    const r = drawWire(d, [P(30, 30), P(30, 40)], b.ctx);
    expect(r.ok).toBe(true);
  });
});

describe('Invariante transversal: forma normal tras cada operación', () => {
  it('una secuencia larga de operaciones deja siempre forma normal y sin ambigüedad', () => {
    const { doc, ctx } = empty();
    let d = doc;
    const ids: Id[] = [];
    const steps: (() => void)[] = [
      () => {
        const r = placeComponent(d, { type: 'ac-source', position: P(0, 0), rotation: 0 }, ctx);
        d = expectValid(r);
        ids.push(r.componentId!);
      },
      () => (d = wire(d, ctx, P(0, -3), P(0, -8), P(20, -8))),
      () => {
        const r = placeComponent(d, { type: 'switch-no', position: P(20, -2), rotation: 0 }, ctx);
        d = expectValid(r);
        ids.push(r.componentId!);
      },
      () => (d = wire(d, ctx, P(20, 1), P(20, 5))),
      () => {
        const r = placeComponent(d, { type: 'lamp', position: P(20, 8), rotation: 0 }, ctx);
        d = expectValid(r);
        ids.push(r.componentId!);
      },
      () => (d = wire(d, ctx, P(20, 11), P(20, 14), P(0, 14), P(0, 3))),
      () => (d = expectValid(moveSelection(d, selectionOf({ components: [ids[2]!] }), P(4, 2), ctx))),
      () => (d = expectValid(rotateComponent(d, ids[1]!, ctx))),
      () => (d = expectValid(moveSelection(d, selectionOf({ components: [ids[0]!] }), P(-3, 0), ctx))),
      () => (d = expectValid(eraseTarget(d, { kind: 'component', id: ids[1]! }, ctx))),
    ];
    for (const step of steps) {
      step();
      expectNoAmbiguity(d);
    }
    expect(Object.keys(d.components)).toHaveLength(2);
  });
});
