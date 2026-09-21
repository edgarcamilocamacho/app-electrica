import { computeNets } from '../connectivity/nets';
import type { OpContext } from '../model/document';
import type { CircuitDocument, Id, Point } from '../model/types';
import type { Registry } from '../registry/types';
import { WorkGraph } from './graph';
import { GeometryIndex, type ConnectionPoint } from './spatialIndex';

/**
 * Validador de ambigüedad geométrica (PLAN §5.5, RESPONSE_ROUND_2 §6, RESPONSE_ROUND_3 Q3.1).
 * Dos redes distintas no pueden tocarse sin estar conectadas; solo el cruce perpendicular vale.
 *
 *   V1  solapamiento colineal entre segmentos de redes distintas
 *   V2  punto de conexión de una red en el interior de un segmento de otra
 *       (T sin punto, cable que pasa por un terminal ajeno)
 *   V3  puntos de conexión de redes distintas en la misma posición
 *   V5  segmento no ortogonal
 *
 * Cada violación lleva una clave geométrica estable: sirve para saber qué violaciones *agrega*
 * una operación, aunque los ids cambien por la canonicalización.
 */
export type ViolationCode = 'V1' | 'V2' | 'V3' | 'V5';

export interface Violation {
  readonly code: ViolationCode;
  readonly key: string;
  /** Punto representativo, para centrar la vista y dibujar la marca. */
  readonly at: Point;
  readonly segmentIds: readonly Id[];
  readonly vertexIds: readonly Id[];
  readonly componentIds: readonly Id[];
}

export function computeViolations(doc: CircuitDocument, registry: Registry): Violation[] {
  const g = new WorkGraph(doc, registry);
  const index = GeometryIndex.forGraph(g);
  const out: Violation[] = [];

  // V1: solapamientos por línea.
  for (const [axis, lines] of [['H', index.hSegs] as const, ['V', index.vSegs] as const]) {
    for (const segs of lines.values()) {
      const sorted = [...segs].sort((x, y) => x.lo - y.lo);
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const s = sorted[i]!;
          const t = sorted[j]!;
          if (t.lo >= s.hi) break;
          if (s.net === t.net) continue;
          const lo = Math.max(s.lo, t.lo);
          const hi = Math.min(s.hi, t.hi);
          if (hi - lo <= 0) continue;
          const at = axis === 'H' ? { x: (lo + hi) / 2, y: s.line } : { x: s.line, y: (lo + hi) / 2 };
          out.push({
            code: 'V1',
            key: `V1|${axis}|${s.line}|${lo}|${hi}`,
            at,
            segmentIds: [s.id, t.id],
            vertexIds: [],
            componentIds: [],
          });
        }
      }
    }
  }

  // V2: punto de conexión dentro de un segmento de otra red.
  for (const p of index.points) {
    for (const s of index.segmentsThrough(p.position)) {
      if (s.net === p.net) continue;
      const axis = s.a.y === s.b.y ? 'H' : 'V';
      out.push({
        code: 'V2',
        key: `V2|${p.position.x},${p.position.y}|${axis}`,
        at: p.position,
        segmentIds: [s.id],
        ...pointRefs([p]),
      });
    }
  }

  // V3: puntos de redes distintas en la misma posición.
  for (const group of index.pointsAt.values()) {
    if (new Set(group.map((p) => p.net)).size < 2) continue;
    const at = group[0]!.position;
    out.push({ code: 'V3', key: `V3|${at.x},${at.y}`, at, segmentIds: [], ...pointRefs(group) });
  }

  // V5: segmentos diagonales.
  for (const s of index.diagonal) {
    out.push({
      code: 'V5',
      key: `V5|${s.a.x},${s.a.y}|${s.b.x},${s.b.y}`,
      at: s.a,
      segmentIds: [s.id],
      vertexIds: [],
      componentIds: [],
    });
  }

  // Deduplicar por clave (un mismo punto puede reportarse desde varios segmentos).
  const seen = new Set<string>();
  return out.filter((v) => (seen.has(v.key) ? false : (seen.add(v.key), true)));
}

function pointRefs(points: readonly ConnectionPoint[]): { vertexIds: Id[]; componentIds: Id[] } {
  const vertexIds = points.flatMap((p) => (p.vertexId ? [p.vertexId] : []));
  const componentIds = [...new Set(points.flatMap((p) => (p.componentId ? [p.componentId] : [])))];
  return { vertexIds, componentIds };
}

/** Violaciones de `after` que no existían en `before` (PLAN §5.1). */
export function introducedViolations(before: CircuitDocument, after: CircuitDocument, registry: Registry): Violation[] {
  const existing = new Set(computeViolations(before, registry).map((v) => v.key));
  return computeViolations(after, registry).filter((v) => !existing.has(v.key));
}

/** Atajo para tests y diagnósticos: ¿el documento tiene alguna ambigüedad? */
export function isUnambiguous(doc: CircuitDocument, ctx: Pick<OpContext, 'registry'>): boolean {
  return computeViolations(doc, ctx.registry).length === 0;
}

/** Recalcula las redes de un documento (reexportado para comodidad de las operaciones). */
export { computeNets };
