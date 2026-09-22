import { componentTerminals, type OpContext } from '../../model/document';
import { onSegment, samePoint, strictlyInside } from '../../model/geometry';
import { compareIds, sortIds } from '../../model/ids';
import type { Id, Point } from '../../model/types';
import type { WorkGraph } from '../graph';

/**
 * Conexiones explícitas por acción de autoría (PLAN §5.6, §6.3). Nunca se llaman desde una
 * reparación geométrica: la geometría jamás crea conexiones por sí sola.
 */

export interface StaticFilter {
  /** Vértices que se están moviendo: no son destino de conexión. */
  readonly movingVertices?: ReadonlySet<Id>;
  /** Componentes que se están moviendo o colocando: sus terminales no son destino. */
  readonly movingComponents?: ReadonlySet<Id>;
}

function isStaticVertex(g: WorkGraph, id: Id, filter: StaticFilter): boolean {
  if (filter.movingVertices?.has(id)) return false;
  const v = g.vertices[id];
  if (v?.kind === 'terminal' && filter.movingComponents?.has(v.componentId)) return false;
  return true;
}

function isStaticSegment(g: WorkGraph, id: Id, filter: StaticFilter): boolean {
  const s = g.segments[id];
  return !!s && isStaticVertex(g, s.a, filter) && isStaticVertex(g, s.b, filter);
}

function vertexAt(g: WorkGraph, p: Point, filter: StaticFilter): Id | undefined {
  return sortIds(Object.keys(g.vertices)).find((id) => isStaticVertex(g, id, filter) && samePoint(g.pos(id), p));
}

function segmentThrough(g: WorkGraph, p: Point, filter: StaticFilter): Id | undefined {
  return sortIds(Object.keys(g.segments)).find((id) => {
    if (!isStaticSegment(g, id, filter)) return false;
    const s = g.segments[id]!;
    return strictlyInside(p, g.pos(s.a), g.pos(s.b));
  });
}

interface FreeTerminal {
  readonly componentId: Id;
  readonly terminalId: string;
  readonly position: Point;
}

function freeTerminalAt(g: WorkGraph, p: Point, filter: StaticFilter): FreeTerminal | undefined {
  for (const cid of sortIds(Object.keys(g.components))) {
    if (filter.movingComponents?.has(cid)) continue;
    for (const t of componentTerminals(g.components[cid]!, g.registry)) {
      if (samePoint(t.position, p) && !g.terminalVertex(cid, t.terminalId)) {
        return { componentId: cid, terminalId: t.terminalId, position: t.position };
      }
    }
  }
  return undefined;
}

function materialize(g: WorkGraph, ctx: OpContext, componentId: Id, terminalId: string): Id {
  const existing = g.terminalVertex(componentId, terminalId);
  if (existing) return existing;
  const id = ctx.ids.next('v');
  g.addVertex({ id, kind: 'terminal', componentId, terminalId });
  return id;
}

/** Parte un segmento en `p` con el vértice `vertexId` (que debe estar en `p`). */
export function splitSegmentAt(g: WorkGraph, ctx: OpContext, segmentId: Id, vertexId: Id): void {
  const s = g.segments[segmentId]!;
  g.removeSegment(segmentId);
  g.addSegment({ id: s.id, a: s.a, b: vertexId });
  g.addSegment({ id: ctx.ids.next('s'), a: vertexId, b: s.b });
}

/**
 * Vértice en `p` para enganchar un cable (herramienta Cable). Prioridad: vértice existente →
 * terminal sin cable → interior de un segmento (se parte, R1 §4) → punto nuevo (extremo libre).
 */
export function connectAtPoint(g: WorkGraph, ctx: OpContext, p: Point, filter: StaticFilter = {}): Id {
  const vertex = vertexAt(g, p, filter);
  if (vertex) return vertex;
  const terminal = freeTerminalAt(g, p, filter);
  if (terminal) return materialize(g, ctx, terminal.componentId, terminal.terminalId);
  const id = ctx.ids.next('v');
  g.addVertex({ id, kind: 'point', position: p });
  const seg = segmentThrough(g, p, filter);
  if (seg) splitSegmentAt(g, ctx, seg, id);
  return id;
}

/** Engancha un terminal libre que cayó exactamente sobre un conductor (R1 §5, R1 §9, R2 §8). */
function landTerminal(g: WorkGraph, ctx: OpContext, t: FreeTerminal, filter: StaticFilter): boolean {
  const vertex = vertexAt(g, t.position, filter);
  if (vertex) {
    const target = g.vertices[vertex]!;
    const tv = materialize(g, ctx, t.componentId, t.terminalId);
    if (target.kind === 'point') g.replaceVertex(vertex, tv);
    else g.addSegment({ id: ctx.ids.next('s'), a: tv, b: vertex }); // terminal sobre terminal
    return true;
  }
  const other = freeTerminalAt(g, t.position, filter);
  if (other) {
    const tv = materialize(g, ctx, t.componentId, t.terminalId);
    const ov = materialize(g, ctx, other.componentId, other.terminalId);
    g.addSegment({ id: ctx.ids.next('s'), a: tv, b: ov });
    return true;
  }
  const seg = segmentThrough(g, t.position, filter);
  if (seg) {
    const tv = materialize(g, ctx, t.componentId, t.terminalId);
    splitSegmentAt(g, ctx, seg, tv);
    return true;
  }
  return false;
}

/**
 * Inserción en serie (R3 Q3.3): si los dos terminales libres de un componente caen
 * sobre el mismo tramo recto, se elimina exactamente el pedazo entre ellos.
 */
function tryInsertInSeries(
  g: WorkGraph,
  ctx: OpContext,
  componentId: Id,
  terminals: readonly FreeTerminal[],
  filter: StaticFilter,
): boolean {
  if (terminals.length !== 2) return false;
  const [t1, t2] = terminals as [FreeTerminal, FreeTerminal];
  if (samePoint(t1.position, t2.position)) return false;
  // Si alguno cae sobre un vértice existente, no es "el mismo tramo recto": se conecta normal.
  if (vertexAt(g, t1.position, filter) || vertexAt(g, t2.position, filter)) return false;

  const segId = sortIds(Object.keys(g.segments)).find((id) => {
    if (!isStaticSegment(g, id, filter)) return false;
    const s = g.segments[id]!;
    const a = g.pos(s.a);
    const b = g.pos(s.b);
    return onSegment(t1.position, a, b) && onSegment(t2.position, a, b);
  });
  if (!segId) return false;

  const s = g.segments[segId]!;
  const a = g.pos(s.a);
  const d = (p: Point) => Math.abs(p.x - a.x) + Math.abs(p.y - a.y);
  const [near, far] = d(t1.position) <= d(t2.position) ? [t1, t2] : [t2, t1];
  const vNear = materialize(g, ctx, componentId, near.terminalId);
  const vFar = materialize(g, ctx, componentId, far.terminalId);
  g.removeSegment(segId);
  g.addSegment({ id: s.id, a: s.a, b: vNear });
  g.addSegment({ id: ctx.ids.next('s'), a: vFar, b: s.b });
  return true;
}

/**
 * Tras colocar, mover o pegar: conecta los terminales libres de `componentIds` que aterrizaron
 * exactamente sobre un conductor estático. Los terminales ya conectados no se tocan (R2 §2).
 */
export function landFreeTerminals(
  g: WorkGraph,
  ctx: OpContext,
  componentIds: Iterable<Id>,
  filter: StaticFilter = {},
): void {
  const moving = new Set(filter.movingComponents ?? []);
  for (const cid of [...componentIds].sort(compareIds)) moving.add(cid);
  const effective: StaticFilter = { ...filter, movingComponents: moving };

  for (const cid of [...componentIds].sort(compareIds)) {
    const component = g.components[cid];
    if (!component) continue;
    const free = componentTerminals(component, g.registry)
      .filter((t) => !g.terminalVertex(cid, t.terminalId))
      .map((t) => ({ componentId: cid, terminalId: t.terminalId, position: t.position }));
    if (free.length === 0) continue;
    const def = g.registry.require(component.type);
    if (def.terminals.length === 2 && free.length === 2 && tryInsertInSeries(g, ctx, cid, free, effective)) continue;
    for (const t of free) landTerminal(g, ctx, t, effective);
  }
}
