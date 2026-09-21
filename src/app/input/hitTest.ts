import { componentBounds, vertexPosition } from '../../core/model/document';
import { distanceToSegment } from '../../core/model/geometry';
import type { CircuitDocument, Id, Point, TextAnnotation } from '../../core/model/types';
import type { Registry } from '../../core/registry/types';
import type { VertexClass } from '../../core/topology/classify';

/**
 * Qué hay bajo el cursor (PLAN §7.1, R3 Q3.6). Coordenadas del mundo en unidades de grid (con
 * decimales); las tolerancias llegan ya convertidas a unidades de grid según el zoom.
 */
export type Hit =
  | { readonly kind: 'vertex'; readonly id: Id; readonly cls: VertexClass; readonly distance: number }
  | { readonly kind: 'segment'; readonly id: Id; readonly distance: number }
  | { readonly kind: 'annotation'; readonly id: Id; readonly distance: number }
  | { readonly kind: 'component'; readonly id: Id; readonly distance: number };

export const ANNOTATION_FONT = 1.2;

/** Caja aproximada de un texto libre (para selección y exportación). */
export function annotationBounds(n: TextAnnotation) {
  const lines = n.text.split('\n');
  const width = Math.max(1, ...lines.map((l) => l.length)) * ANNOTATION_FONT * 0.58;
  return { minX: n.position.x, minY: n.position.y - ANNOTATION_FONT, maxX: n.position.x + width, maxY: n.position.y + (lines.length - 1) * ANNOTATION_FONT * 1.25 + 0.35 };
}

export interface Tolerances {
  readonly vertex: number;
  readonly segment: number;
}

export function hitTest(
  doc: CircuitDocument,
  registry: Registry,
  classes: ReadonlyMap<Id, VertexClass>,
  p: Point,
  tol: Tolerances,
): Hit[] {
  const hits: Hit[] = [];
  for (const v of Object.values(doc.vertices)) {
    const q = vertexPosition(doc, v, registry);
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d <= tol.vertex) hits.push({ kind: 'vertex', id: v.id, cls: classes.get(v.id) ?? 'orphan', distance: d });
  }
  for (const s of Object.values(doc.segments)) {
    const va = doc.vertices[s.a];
    const vb = doc.vertices[s.b];
    if (!va || !vb) continue;
    const d = distanceToSegment(p, vertexPosition(doc, va, registry), vertexPosition(doc, vb, registry));
    if (d <= tol.segment) hits.push({ kind: 'segment', id: s.id, distance: d });
  }
  for (const n of Object.values(doc.annotations)) {
    const b = annotationBounds(n);
    if (p.x >= b.minX - 0.2 && p.x <= b.maxX + 0.2 && p.y >= b.minY - 0.2 && p.y <= b.maxY + 0.2) {
      hits.push({ kind: 'annotation', id: n.id, distance: 0 });
    }
  }
  for (const c of Object.values(doc.components)) {
    const b = componentBounds(c, registry);
    if (p.x >= b.minX - 0.3 && p.x <= b.maxX + 0.3 && p.y >= b.minY - 0.3 && p.y <= b.maxY + 0.3) {
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      hits.push({ kind: 'component', id: c.id, distance: Math.hypot(p.x - cx, p.y - cy) });
    }
  }
  return hits.sort((a, b) => a.distance - b.distance);
}

const ERASE_VERTEX_ORDER: Readonly<Record<VertexClass, number>> = {
  junction: 0,
  'free-end': 1,
  corner: 2,
  straight: 3,
  orphan: 4,
  terminal: 5,
};

/**
 * Prioridad de la goma (R2 §5, R3 Q3.6): junction ● → extremo libre ○ → esquina → segmento →
 * texto → componente. En un terminal con un solo cable gana el componente.
 */
export function pickForErase(doc: CircuitDocument, hits: readonly Hit[]): Hit | undefined {
  const vertices = hits
    .filter((h): h is Extract<Hit, { kind: 'vertex' }> => h.kind === 'vertex')
    .sort((a, b) => ERASE_VERTEX_ORDER[a.cls] - ERASE_VERTEX_ORDER[b.cls] || a.distance - b.distance);
  const vertex = vertices[0];
  if (vertex && vertex.cls !== 'terminal') return vertex;
  if (vertex?.cls === 'terminal') {
    const v = doc.vertices[vertex.id];
    if (v?.kind === 'terminal') return { kind: 'component', id: v.componentId, distance: 0 };
  }
  return (
    hits.find((h) => h.kind === 'segment') ??
    hits.find((h) => h.kind === 'annotation') ??
    hits.find((h) => h.kind === 'component')
  );
}

/** Seleccionar y Mover: segmento → texto → componente (los vértices no se seleccionan). */
export function pickForSelect(hits: readonly Hit[]): Exclude<Hit, { kind: 'vertex' }> | undefined {
  const pick = hits.find((h) => h.kind === 'segment') ?? hits.find((h) => h.kind === 'annotation') ?? hits.find((h) => h.kind === 'component');
  return pick as Exclude<Hit, { kind: 'vertex' }> | undefined;
}

/** Componente bajo el cursor (interacción en simulación). */
export function pickComponent(hits: readonly Hit[]): Id | undefined {
  return hits.find((h) => h.kind === 'component')?.id;
}
