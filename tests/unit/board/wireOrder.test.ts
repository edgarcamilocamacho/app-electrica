/**
 * Cables superpuestos de distinto calibre: queda a la vista, y se elige, el más grueso [R7 §1].
 * Capas por red: los cables de una misma red no se cortan entre sí [R7 §3].
 */
import { describe, expect, it } from 'vitest';
import { wireRoute } from '../../../src/core/board/wireGeometry';
import { wiresBottomToTop } from '../../../src/core/board/model';
import { computeNets, wireLayers } from '../../../src/core/board/nets';
import { hitTest } from '../../../src/app/board/hitTest';
import { BoardBuilder, registry, term } from '../../fixtures/board';

/** Dos cables entre los mismos bornes: misma red y el mismo recorrido, uno encima del otro. */
function overlapping(first: 1 | 2 | 3, second: 1 | 2 | 3) {
  const b = new BoardBuilder();
  const g = b.device('supply-1p', 0, 0);
  const h = b.device('pilot-lamp', 0, 30);
  const a = b.wire(term(g, 'L'), term(h, 'X1'), { gauge: first });
  const c = b.wire(term(g, 'L'), term(h, 'X1'), { gauge: second });
  return { b, a, c };
}

describe('orden de los cables [R7 §1]', () => {
  it('se dibujan de más fino a más grueso, sin importar cuál se hizo primero', () => {
    const thickFirst = overlapping(3, 1);
    expect(wiresBottomToTop(thickFirst.b.doc).map((w) => w.id)).toEqual([thickFirst.c, thickFirst.a]);
    const thinFirst = overlapping(1, 3);
    expect(wiresBottomToTop(thinFirst.b.doc).map((w) => w.id)).toEqual([thinFirst.a, thinFirst.c]);
  });

  it('entre cables del mismo calibre se conserva el orden del documento', () => {
    const same = overlapping(2, 2);
    expect(wiresBottomToTop(same.b.doc).map((w) => w.id)).toEqual([same.a, same.c]);
  });

  it('un clic sobre la parte superpuesta elige el más grueso', () => {
    for (const [first, second] of [
      [3, 1],
      [1, 3],
    ] as const) {
      const { b, a, c } = overlapping(first, second);
      const thick = first === 3 ? a : c;
      const route = wireRoute(b.doc, registry, b.doc.wires[a]!);
      const mid = { x: (route[1]!.x + route[2]!.x) / 2, y: (route[1]!.y + route[2]!.y) / 2 };
      const hit = hitTest(b.doc, registry, mid);
      expect(hit.kind).toBe('wire');
      expect(hit.kind === 'wire' && hit.id).toBe(thick);
    }
  });
});

describe('capas de dibujo por red [R7 §3]', () => {
  it('los cables de una misma red van en la misma capa, de fino a grueso', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h1 = b.device('pilot-lamp', 0, 30);
    const h2 = b.device('pilot-lamp', 20, 30);
    const thick = b.wire(term(g, 'L'), term(h1, 'X1'), { gauge: 3 });
    const thin = b.wire(term(h1, 'X1'), term(h2, 'X1'), { gauge: 1 });
    const other = b.wire(term(g, 'N'), term(h1, 'X2'), { gauge: 2 });
    const layers = wireLayers(b.doc, computeNets(b.doc, registry)).map((layer) => layer.map((w) => w.id));
    // La red de L tiene el cable más grueso: queda arriba de la del neutro.
    expect(layers).toEqual([[other], [thin, thick]]);
  });

  it('un cable con las dos puntas sueltas es su propia capa', () => {
    const b = new BoardBuilder();
    b.doc = {
      ...b.doc,
      wires: {
        w1: { id: 'w1', a: { kind: 'free', at: { x: 0, y: 0 } }, b: { kind: 'free', at: { x: 10, y: 0 } }, bends: [], color: 'red', gauge: 1 },
        w2: { id: 'w2', a: { kind: 'free', at: { x: 0, y: 5 } }, b: { kind: 'free', at: { x: 10, y: 5 } }, bends: [], color: 'red', gauge: 1 },
      },
    };
    expect(wireLayers(b.doc, computeNets(b.doc, registry)).map((l) => l.map((w) => w.id))).toEqual([['w1'], ['w2']]);
  });
});
