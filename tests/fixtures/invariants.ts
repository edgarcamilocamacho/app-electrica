import { computeNets } from '../../src/core/connectivity/nets';
import { buildAdjacency, otherEnd, vertexPosition } from '../../src/core/model/document';
import { isOrthogonal, pointKey, samePoint, strictlyInside } from '../../src/core/model/geometry';
import type { CircuitDocument } from '../../src/core/model/types';
import type { Registry } from '../../src/core/registry/types';

/**
 * Violaciones de la forma normal (PLAN §4.5). Lista vacía = documento en forma normal.
 * Se usa como test transversal tras cada operación.
 */
export function normalFormViolations(doc: CircuitDocument, registry: Registry): string[] {
  const problems: string[] = [];
  const nets = computeNets(doc);
  const adj = buildAdjacency(doc);
  const pos = (id: string) => vertexPosition(doc, doc.vertices[id]!, registry);

  const pairs = new Set<string>();
  for (const s of Object.values(doc.segments)) {
    if (!doc.vertices[s.a] || !doc.vertices[s.b]) {
      problems.push(`segmento ${s.id} con vértice inexistente`);
      continue;
    }
    const a = pos(s.a);
    const b = pos(s.b);
    if (!isOrthogonal(a, b)) problems.push(`segmento ${s.id} no ortogonal`);
    if (s.a === s.b) problems.push(`segmento ${s.id} es un lazo`);
    if (samePoint(a, b)) {
      const bothTerminals = doc.vertices[s.a]!.kind === 'terminal' && doc.vertices[s.b]!.kind === 'terminal';
      if (!bothTerminals) problems.push(`segmento ${s.id} de largo cero`);
    }
    const key = [s.a, s.b].sort().join('|');
    if (pairs.has(key)) problems.push(`segmento ${s.id} duplicado`);
    pairs.add(key);
  }

  const byPos = new Map<string, string[]>();
  for (const v of Object.values(doc.vertices)) {
    const degree = adj.get(v.id)?.length ?? 0;
    if (degree === 0) problems.push(`vértice ${v.id} sin segmentos`);
    const p = pos(v.id);
    const k = `${pointKey(p)}|${nets.netOfVertex.get(v.id)}`;
    byPos.set(k, [...(byPos.get(k) ?? []), v.id]);

    if (v.kind === 'point' && degree === 2) {
      const [s1, s2] = adj.get(v.id)!;
      const a = pos(otherEnd(doc.segments[s1!]!, v.id));
      const b = pos(otherEnd(doc.segments[s2!]!, v.id));
      if (strictlyInside(p, a, b)) problems.push(`vértice ${v.id} redundante (colineal)`);
    }

    for (const s of Object.values(doc.segments)) {
      if (nets.netOfSegment.get(s.id) !== nets.netOfVertex.get(v.id)) continue;
      if (strictlyInside(p, pos(s.a), pos(s.b))) problems.push(`vértice ${v.id} dentro del segmento ${s.id} de su red`);
    }
  }
  for (const ids of byPos.values()) {
    const points = ids.filter((id) => doc.vertices[id]!.kind === 'point');
    if (ids.length > 1 && points.length > 0) problems.push(`vértices coincidentes de la misma red: ${ids.join(',')}`);
  }
  return problems;
}
