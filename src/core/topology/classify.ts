import { buildAdjacency, otherEnd, vertexPosition } from '../model/document';
import { strictlyInside } from '../model/geometry';
import type { CircuitDocument, Id } from '../model/types';
import type { Registry } from '../registry/types';

/**
 * Clase visual de un vértice, derivada de su grado (PLAN §4.2):
 *   free-end ○ · corner · junction ● · terminal (con un cable) · straight (no debería existir en forma normal)
 */
export type VertexClass = 'free-end' | 'corner' | 'junction' | 'terminal' | 'straight' | 'orphan';

export function classifyVertices(doc: CircuitDocument, registry: Registry): Map<Id, VertexClass> {
  const adj = buildAdjacency(doc);
  const pos = (id: Id) => vertexPosition(doc, doc.vertices[id]!, registry);
  const result = new Map<Id, VertexClass>();

  for (const v of Object.values(doc.vertices)) {
    const segs = adj.get(v.id) ?? [];
    // Un segmento de largo cero entre dos terminales (terminal sobre terminal) cuenta como unión.
    const touchesTerminalPair = segs.some((sid) => {
      const s = doc.segments[sid]!;
      const o = doc.vertices[otherEnd(s, v.id)];
      if (!o || o.kind !== 'terminal' || v.kind !== 'terminal') return false;
      const p = pos(v.id);
      const q = pos(o.id);
      return p.x === q.x && p.y === q.y;
    });
    const degree = segs.length;
    if (v.kind === 'terminal') {
      result.set(v.id, degree === 0 ? 'orphan' : degree >= 2 || touchesTerminalPair ? 'junction' : 'terminal');
      continue;
    }
    if (degree === 0) result.set(v.id, 'orphan');
    else if (degree === 1) result.set(v.id, 'free-end');
    else if (degree >= 3) result.set(v.id, 'junction');
    else {
      const [s1, s2] = segs as [Id, Id];
      const a = pos(otherEnd(doc.segments[s1]!, v.id));
      const b = pos(otherEnd(doc.segments[s2]!, v.id));
      result.set(v.id, strictlyInside(pos(v.id), a, b) ? 'straight' : 'corner');
    }
  }
  return result;
}
