import type { OpContext } from '../../model/document';
import { samePoint } from '../../model/geometry';
import { sortIds } from '../../model/ids';
import type { Selection } from '../../model/selection';
import type { CircuitDocument, Id } from '../../model/types';
import { computeNets } from '../../connectivity/nets';
import { classifyVertices } from '../classify';
import { WorkGraph } from '../graph';
import { finalizeEdit, rejected, type EditResult } from './common';

/** Objetivo de un clic de la herramienta Borrar, ya resuelto por prioridad (R3 Q3.6). */
export type EraseTarget =
  | { readonly kind: 'vertex'; readonly id: Id }
  | { readonly kind: 'segment'; readonly id: Id }
  | { readonly kind: 'component'; readonly id: Id }
  | { readonly kind: 'annotation'; readonly id: Id };

/**
 * Borra un componente conservando su cableado: cada vértice terminal se convierte en un punto en su
 * última posición, que queda como extremo libre (R1 §10).
 */
function deleteComponentInGraph(g: WorkGraph, ctx: OpContext, componentId: Id): void {
  for (const vid of sortIds(Object.keys(g.vertices))) {
    const v = g.vertices[vid]!;
    if (v.kind !== 'terminal' || v.componentId !== componentId) continue;
    const pointId = ctx.ids.next('v');
    g.addVertex({ id: pointId, kind: 'point', position: g.pos(vid) });
    g.replaceVertex(vid, pointId);
  }
  delete g.components[componentId];
}

/**
 * Semántica de la goma (R2 §5): un clic = una transacción.
 *   junction ● → todos los segmentos incidentes, y el componente ligado a ese punto
 *   esquina    → los dos segmentos que la forman
 *   extremo ○  → su segmento completo
 *   terminal con un solo cable → el componente (R3 Q3.6)
 *   segmento   → solo ese segmento
 */
export function eraseTarget(doc: CircuitDocument, target: EraseTarget, ctx: OpContext): EditResult {
  const g = new WorkGraph(doc, ctx.registry);
  switch (target.kind) {
    case 'segment':
      if (!g.segments[target.id]) return rejected(doc, 'NOT_FOUND');
      g.removeSegment(target.id);
      break;
    case 'component':
      if (!g.components[target.id]) return rejected(doc, 'NOT_FOUND');
      deleteComponentInGraph(g, ctx, target.id);
      break;
    case 'annotation':
      if (!g.annotations[target.id]) return rejected(doc, 'NOT_FOUND');
      delete g.annotations[target.id];
      break;
    case 'vertex': {
      const v = g.vertices[target.id];
      if (!v) return rejected(doc, 'NOT_FOUND');
      const cls = classifyVertices(doc, ctx.registry).get(target.id);
      if (cls === 'terminal' && v.kind === 'terminal') {
        deleteComponentInGraph(g, ctx, v.componentId);
      } else if (cls === 'junction') {
        // El junction puede ser un grupo de vértices en el mismo punto (terminal sobre terminal).
        const nets = computeNets(doc);
        const net = nets.netOfVertex.get(target.id);
        const p = g.pos(target.id);
        const cluster = sortIds(Object.keys(g.vertices)).filter(
          (id) => nets.netOfVertex.get(id) === net && samePoint(g.pos(id), p),
        );
        const components = new Set<Id>();
        for (const id of cluster) {
          for (const sid of g.segmentsAt(id)) g.removeSegment(sid);
          const cv = g.vertices[id]!;
          if (cv.kind === 'terminal') components.add(cv.componentId);
        }
        for (const cid of sortIds(components)) deleteComponentInGraph(g, ctx, cid);
      } else {
        for (const sid of g.segmentsAt(target.id)) g.removeSegment(sid);
      }
      break;
    }
  }
  return finalizeEdit(doc, g, ctx);
}

/** Borra toda una selección en una sola transacción (R2 §30.1). */
export function deleteSelection(doc: CircuitDocument, selection: Selection, ctx: OpContext): EditResult {
  const g = new WorkGraph(doc, ctx.registry);
  for (const sid of selection.segments) g.removeSegment(sid);
  for (const cid of sortIds(selection.components)) if (g.components[cid]) deleteComponentInGraph(g, ctx, cid);
  for (const nid of selection.annotations) delete g.annotations[nid];
  return finalizeEdit(doc, g, ctx);
}
