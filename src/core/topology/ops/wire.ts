import type { OpContext } from '../../model/document';
import type { CircuitDocument, Id, Point } from '../../model/types';
import { WorkGraph } from '../graph';
import { finalizeEdit, rejected, type EditResult } from './common';
import { connectAtPoint } from './connect';

export interface WireResult extends EditResult {
  readonly segmentIds?: readonly Id[];
}

/**
 * Traza un cable por una polilínea ortogonal (PLAN §6.3). Inicio y fin se enganchan a lo que haya
 * en ese punto (vértice, terminal o interior de segmento, que se parte → junction). Si no hay nada,
 * quedan como extremo libre (R2 §4). Los puntos intermedios son codos.
 */
export function drawWire(doc: CircuitDocument, points: readonly Point[], ctx: OpContext): WireResult {
  const poly = dedupe(points);
  if (poly.length < 2) return rejected(doc, 'INVALID_INPUT');
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[i + 1]!;
    if (a.x !== b.x && a.y !== b.y) return rejected(doc, 'INVALID_INPUT');
  }

  const g = new WorkGraph(doc, ctx.registry);
  const start = connectAtPoint(g, ctx, poly[0]!);
  const end = connectAtPoint(g, ctx, poly[poly.length - 1]!);
  const vertexIds: Id[] = [start];
  for (let i = 1; i + 1 < poly.length; i++) {
    const id = ctx.ids.next('v');
    g.addVertex({ id, kind: 'point', position: poly[i]! });
    vertexIds.push(id);
  }
  vertexIds.push(end);

  const segmentIds: Id[] = [];
  for (let i = 0; i + 1 < vertexIds.length; i++) {
    const id = ctx.ids.next('s');
    g.addSegment({ id, a: vertexIds[i]!, b: vertexIds[i + 1]! });
    segmentIds.push(id);
  }
  const result = finalizeEdit(doc, g, ctx);
  return { ...result, segmentIds: segmentIds.filter((id) => result.doc.segments[id]) };
}

function dedupe(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}
