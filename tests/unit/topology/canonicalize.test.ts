import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../../src/core/topology/canonicalize';
import { netSignature, terminalPartition } from '../../../src/core/connectivity/nets';
import { vertexPosition } from '../../../src/core/model/document';
import type { CircuitDocument } from '../../../src/core/model/types';
import { DocBuilder, makeCtx, randInt, rng } from '../../fixtures/builder';
import { normalFormViolations } from '../../fixtures/invariants';

const segs = (doc: CircuitDocument) => Object.values(doc.segments);
const verts = (doc: CircuitDocument) => Object.values(doc.vertices);

function segmentSpans(doc: CircuitDocument, ctxRegistry = makeCtx().registry) {
  return segs(doc)
    .map((s) => {
      const a = vertexPosition(doc, doc.vertices[s.a]!, ctxRegistry);
      const b = vertexPosition(doc, doc.vertices[s.b]!, ctxRegistry);
      const [p, q] = a.x < b.x || (a.x === b.x && a.y < b.y) ? [a, b] : [b, a];
      return `${p.x},${p.y}-${q.x},${q.y}`;
    })
    .sort();
}

describe('canonicalize — paso 1: largo cero', () => {
  it('fusiona dos puntos unidos por un segmento de largo cero', () => {
    const b = new DocBuilder();
    const [, p] = b.wire({ x: 0, y: 0 }, { x: 5, y: 0 });
    const q = b.point(5, 0);
    b.seg(p!, q);
    b.wire(q, { x: 5, y: 4 });
    const out = canonicalize(b.build(), b.ctx);
    expect(normalFormViolations(out, b.ctx.registry)).toEqual([]);
    expect(segmentSpans(out)).toEqual(['0,0-5,0', '5,0-5,4']);
  });

  it('un punto sobre un terminal se absorbe en el terminal', () => {
    const b = new DocBuilder();
    const k = b.component('coil', 0, 10);
    const top = b.terminal(k, 'A1'); // (0, 7)
    const p = b.point(0, 7);
    b.seg(top, p);
    b.wire(p, { x: 0, y: 2 });
    const out = canonicalize(b.build(), b.ctx);
    expect(verts(out).filter((v) => v.kind === 'point')).toHaveLength(1);
    expect(segmentSpans(out)).toEqual(['0,2-0,7']);
  });

  it('conserva el segmento de largo cero entre dos terminales (terminal sobre terminal)', () => {
    const b = new DocBuilder();
    const k1 = b.component('coil', 0, 0); // A2 en (0, 3)
    const k2 = b.component('lamp', 0, 6); // X1 en (0, 3)
    b.seg(b.terminal(k1, 'A2'), b.terminal(k2, 'X1'));
    const doc = b.build();
    const out = canonicalize(doc, b.ctx);
    expect(segs(out)).toHaveLength(1);
    expect(terminalPartition(out, b.ctx.registry)).toContainEqual([`${k1}:A2`, `${k2}:X1`]);
  });
});

describe('canonicalize — paso 2: duplicados', () => {
  it('elimina segmentos repetidos entre el mismo par de vértices', () => {
    const b = new DocBuilder();
    const [p, q] = b.wire({ x: 0, y: 0 }, { x: 4, y: 0 });
    b.seg(q!, p!);
    const out = canonicalize(b.build(), b.ctx);
    expect(segs(out)).toHaveLength(1);
  });
});

describe('canonicalize — paso 3: coincidencias dentro de una misma red', () => {
  it('fusiona vértices de la misma red en la misma posición', () => {
    const b = new DocBuilder();
    // Dos caminos que llegan al mismo punto (4,0) por vértices distintos, unidos por (0,0).
    const o = b.point(0, 0);
    const p1 = b.point(4, 0);
    const p2 = b.point(4, 0);
    b.seg(o, p1);
    b.wire(o, { x: 0, y: 3 }, { x: 4, y: 3 }, p2);
    b.wire(p1, { x: 8, y: 0 });
    const before = b.build();
    const out = canonicalize(before, b.ctx);
    expect(normalFormViolations(out, b.ctx.registry)).toEqual([]);
    expect(netSignature(out, b.ctx.registry)).toEqual(netSignature(before, b.ctx.registry));
  });

  it('parte un segmento que contiene en su interior un vértice de su misma red', () => {
    const b = new DocBuilder();
    // Línea horizontal 0..8 y una rama que vuelve a tocarla en (4,0) por su extremo.
    const [a, , , , t] = b.wire({ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 1 }, { x: 4, y: 0 });
    const end = b.point(8, 0);
    b.seg(a!, end);
    void t;
    const before = b.build();
    const out = canonicalize(before, b.ctx);
    expect(normalFormViolations(out, b.ctx.registry)).toEqual([]);
    expect(netSignature(out, b.ctx.registry)).toEqual(netSignature(before, b.ctx.registry));
    // (4,0) quedó como junction: tres segmentos lo tocan.
    const junction = verts(out).find((v) => v.kind === 'point' && v.position.x === 4 && v.position.y === 0)!;
    expect(segs(out).filter((s) => s.a === junction.id || s.b === junction.id)).toHaveLength(3);
  });

  it('normaliza solapamientos colineales de la misma red (RESPONSE_ROUND_2 §7)', () => {
    const b = new DocBuilder();
    // A(0,0)–B(5,0) y C(2,0)–D(8,0), unidos además por abajo: misma red, superpuestos en 2..5.
    const [a] = b.wire({ x: 0, y: 0 }, { x: 5, y: 0 });
    const [c] = b.wire({ x: 2, y: 0 }, { x: 8, y: 0 });
    b.wire(a!, { x: 0, y: 4 }, { x: 2, y: 4 }, c!);
    const before = b.build();
    const out = canonicalize(before, b.ctx);
    expect(normalFormViolations(out, b.ctx.registry)).toEqual([]);
    expect(netSignature(out, b.ctx.registry)).toEqual(netSignature(before, b.ctx.registry));
    const onTopLine = segmentSpans(out).filter((s) => s.endsWith(',0') && s.startsWith('0,0') || /,0-\d+,0$/.test(s));
    expect(onTopLine.sort()).toEqual(['0,0-2,0', '2,0-8,0']);
  });

  it('no toca coincidencias entre redes distintas', () => {
    const b = new DocBuilder();
    b.wire({ x: 0, y: 0 }, { x: 8, y: 0 });
    b.wire({ x: 4, y: 0 }, { x: 4, y: 5 }); // T sin punto: otra red
    const before = b.build();
    const out = canonicalize(before, b.ctx);
    expect(segs(out)).toHaveLength(2);
    expect(terminalPartition(out, b.ctx.registry)).toEqual(terminalPartition(before, b.ctx.registry));
  });
});

describe('canonicalize — paso 4: colineales', () => {
  it('fusiona un punto intermedio sin función', () => {
    const b = new DocBuilder();
    b.wire({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 7, y: 0 });
    const out = canonicalize(b.build(), b.ctx);
    expect(segmentSpans(out)).toEqual(['0,0-7,0']);
    expect(verts(out)).toHaveLength(2);
  });

  it('no fusiona una esquina: los dos lados siguen siendo segmentos independientes', () => {
    const b = new DocBuilder();
    b.wire({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 });
    const out = canonicalize(b.build(), b.ctx);
    expect(segmentSpans(out)).toEqual(['0,0-5,0', '5,0-5,4']);
  });

  it('no fusiona en un junction ni en un terminal', () => {
    const b = new DocBuilder();
    const [, mid] = b.wire({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 0 });
    b.wire(mid!, { x: 4, y: 5 });
    const out = canonicalize(b.build(), b.ctx);
    expect(segs(out)).toHaveLength(3);
  });

  it('el caso degenerado (vértice no intermedio) conserva toda la geometría', () => {
    const b = new DocBuilder();
    // A(0,0)–V(5,0) y V(5,0)–B(2,0): fusionar ingenuamente perdería el tramo 2..5.
    b.wire({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 2, y: 0 });
    const before = b.build();
    const out = canonicalize(before, b.ctx);
    expect(normalFormViolations(out, b.ctx.registry)).toEqual([]);
    expect(segmentSpans(out)).toEqual(['0,0-5,0']);
  });
});

describe('canonicalize — paso 5: huérfanos', () => {
  it('elimina puntos sueltos y desmaterializa terminales sin cables', () => {
    const b = new DocBuilder();
    const k = b.component('coil', 0, 0);
    b.terminal(k, 'A1');
    b.point(9, 9);
    const out = canonicalize(b.build(), b.ctx);
    expect(verts(out)).toHaveLength(0);
  });
});

describe('canonicalize — propiedades sobre documentos aleatorios', () => {
  function randomDoc(seed: number): { doc: CircuitDocument; ctx: ReturnType<typeof makeCtx> } {
    const r = rng(seed);
    const b = new DocBuilder();
    const comps = randInt(r, 0, 3);
    const endpoints: string[] = [];
    for (let i = 0; i < comps; i++) {
      const c = b.component('lamp', randInt(r, 0, 3) * 2, randInt(r, 1, 3) * 3);
      endpoints.push(b.terminal(c, 'X1'), b.terminal(c, 'X2'));
    }
    const nPoints = randInt(r, 2, 9);
    for (let i = 0; i < nPoints; i++) endpoints.push(b.point(randInt(r, 0, 6), randInt(r, 0, 9)));
    const doc0 = b.build();
    const pos = (id: string) => vertexPosition(doc0, doc0.vertices[id]!, b.ctx.registry);
    const nSegs = randInt(r, 1, 14);
    for (let i = 0; i < nSegs; i++) {
      const a = endpoints[randInt(r, 0, endpoints.length - 1)]!;
      const c = endpoints[randInt(r, 0, endpoints.length - 1)]!;
      const pa = pos(a);
      const pc = pos(c);
      if (pa.x === pc.x || pa.y === pc.y) b.seg(a, c);
    }
    return { doc: b.build(), ctx: b.ctx };
  }

  it('conserva conectividad y geometría por red, deja forma normal y es idempotente', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { doc, ctx } = randomDoc(seed);
      const out = canonicalize(doc, ctx);
      expect(netSignature(out, ctx.registry), `semilla ${seed}`).toEqual(netSignature(doc, ctx.registry));
      expect(normalFormViolations(out, ctx.registry), `semilla ${seed}`).toEqual([]);
      expect(canonicalize(out, ctx), `semilla ${seed}`).toEqual(out);
    }
  });
});
