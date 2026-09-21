import type { OpContext } from '../../model/document';
import { add, nextRotation } from '../../model/geometry';
import type { Selection } from '../../model/selection';
import type { CircuitDocument, Id, Point } from '../../model/types';
import { WorkGraph } from '../graph';
import { repairAfterMove } from '../repair';
import { finalizeEdit, rejected, type EditResult } from './common';
import { landFreeTerminals } from './connect';

export interface MoveOptions {
  /** Pasos de 90° a aplicar al único componente movido (R con un componente tomado). */
  readonly rotationSteps?: number;
}

/**
 * Mueve una selección (componentes, segmentos, anotaciones) por `delta` (PLAN §5.3, R2 §2).
 * Los terminales libres que aterrizan sobre un conductor se conectan; los ya conectados no.
 * Los segmentos con un extremo desplazado se reparan con rutas ortogonales.
 */
export function moveSelection(
  doc: CircuitDocument,
  selection: Selection,
  delta: Point,
  ctx: OpContext,
  options: MoveOptions = {},
): EditResult {
  const components = selection.components.filter((id) => doc.components[id]);
  const segments = selection.segments.filter((id) => doc.segments[id]);
  const annotations = selection.annotations.filter((id) => doc.annotations[id]);
  if (components.length + segments.length + annotations.length === 0) return rejected(doc, 'NOT_FOUND');

  const rotationSteps = ((options.rotationSteps ?? 0) % 4 + 4) % 4;
  if (rotationSteps !== 0 && (components.length !== 1 || segments.length + annotations.length > 0)) {
    return rejected(doc, 'INVALID_INPUT'); // sin rotación de grupos (spec §6.4)
  }

  const g = new WorkGraph(doc, ctx.registry);
  const movingComponents = new Set(components);
  const moved = new Set<Id>();
  for (const v of Object.values(g.vertices)) {
    if (v.kind === 'terminal' && movingComponents.has(v.componentId)) moved.add(v.id);
  }
  for (const sid of segments) {
    const s = g.segments[sid]!;
    for (const end of [s.a, s.b]) if (g.vertices[end]!.kind === 'point') moved.add(end);
  }
  const originalPositions = new Map<Id, Point>([...moved].map((id) => [id, g.pos(id)]));

  for (const cid of components) {
    const c = g.components[cid]!;
    let rotation = c.rotation;
    for (let i = 0; i < rotationSteps; i++) rotation = nextRotation(rotation);
    g.components[cid] = { ...c, position: add(c.position, delta), rotation };
  }
  for (const vid of moved) {
    const v = g.vertices[vid]!;
    if (v.kind === 'point') g.setVertex({ ...v, position: add(v.position, delta) });
  }
  for (const nid of annotations) {
    const n = g.annotations[nid]!;
    g.annotations[nid] = { ...n, position: add(n.position, delta) };
  }

  landFreeTerminals(g, ctx, components, { movingVertices: moved, movingComponents });
  const { failedSegments } = repairAfterMove(g, ctx, { moved, originalPositions });
  return finalizeEdit(doc, g, ctx, failedSegments);
}

/** Rota 90° un componente en el lugar. Si el resultado es inválido, la UI lo rechaza (R3 Q3.5). */
export function rotateComponent(doc: CircuitDocument, componentId: Id, ctx: OpContext): EditResult {
  if (!doc.components[componentId]) return rejected(doc, 'NOT_FOUND');
  return moveSelection(doc, { components: [componentId], segments: [], annotations: [] }, { x: 0, y: 0 }, ctx, {
    rotationSteps: 1,
  });
}

/**
 * Desplaza un segmento en perpendicular a sí mismo (R2 §3). Esquinas y extremos libres viajan con
 * él; junctions y terminales quedan anclados y se agrega un tramo nuevo (I11). Es una operación
 * puramente geométrica: nunca crea ni rompe conexiones.
 */
export function moveSegment(doc: CircuitDocument, segmentId: Id, offset: number, ctx: OpContext): EditResult {
  const seg = doc.segments[segmentId];
  if (!seg) return rejected(doc, 'NOT_FOUND');
  const g = new WorkGraph(doc, ctx.registry);
  const pa = g.pos(seg.a);
  const pb = g.pos(seg.b);
  if (pa.x !== pb.x && pa.y !== pb.y) return rejected(doc, 'INVALID_INPUT');
  const delta: Point = pa.y === pb.y ? { x: 0, y: offset } : { x: offset, y: 0 };
  if (offset === 0) return finalizeEdit(doc, g, ctx);

  const moved = new Set<Id>();
  const ends: [Id, Id] = [seg.a, seg.b];
  for (let i = 0; i < 2; i++) {
    const end = ends[i]!;
    const v = g.vertices[end]!;
    if (v.kind === 'point' && g.degree(end) <= 2) {
      moved.add(end);
      continue;
    }
    // Ancla: junction o terminal. Se le cuelga un tramo nuevo (por ahora de largo cero).
    const jog = ctx.ids.next('v');
    g.addVertex({ id: jog, kind: 'point', position: g.pos(end) });
    g.addSegment({ id: ctx.ids.next('s'), a: end, b: jog });
    ends[i] = jog;
    moved.add(jog);
  }
  g.removeSegment(seg.id);
  g.addSegment({ id: seg.id, a: ends[0], b: ends[1] });

  const originalPositions = new Map<Id, Point>([...moved].map((id) => [id, g.pos(id)]));
  for (const vid of moved) {
    const v = g.vertices[vid]!;
    if (v.kind === 'point') g.setVertex({ ...v, position: add(v.position, delta) });
  }
  const { failedSegments } = repairAfterMove(g, ctx, { moved, originalPositions });
  return finalizeEdit(doc, g, ctx, failedSegments);
}
