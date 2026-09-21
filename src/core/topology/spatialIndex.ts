import { computeNets, type NetId } from '../connectivity/nets';
import { componentTerminals, terminalKey } from '../model/document';
import { compareIds } from '../model/ids';
import type { Id, Point } from '../model/types';
import type { WorkGraph } from './graph';

/**
 * Punto de conexión: todo lugar donde un cable podría "tocar" eléctricamente algo.
 * Incluye todos los vértices y los terminales que todavía no tienen cable (PLAN §5.5).
 */
export interface ConnectionPoint {
  readonly key: string; // `v:<id>` o `t:<componente>:<terminal>`
  readonly position: Point;
  readonly net: NetId;
  readonly vertexId?: Id;
  readonly componentId?: Id;
  readonly terminalId?: string;
}

export interface IndexedSegment {
  readonly id: Id;
  readonly net: NetId;
  readonly a: Point;
  readonly b: Point;
  /** Coordenada fija (y para horizontales, x para verticales). */
  readonly line: number;
  readonly lo: number;
  readonly hi: number;
}

/** Colección de puntos de conexión con su red, a partir de un grafo y una partición dada. */
export function connectionPoints(g: WorkGraph, netOfVertex: (id: Id) => NetId): ConnectionPoint[] {
  const points: ConnectionPoint[] = [];
  const materialized = new Set<string>();
  for (const id of Object.keys(g.vertices).sort(compareIds)) {
    const v = g.vertices[id]!;
    if (v.kind === 'terminal') materialized.add(terminalKey(v.componentId, v.terminalId));
    points.push({
      key: `v:${id}`,
      position: g.vertexPos(v),
      net: netOfVertex(id),
      vertexId: id,
      ...(v.kind === 'terminal' ? { componentId: v.componentId, terminalId: v.terminalId } : {}),
    });
  }
  for (const cid of Object.keys(g.components).sort(compareIds)) {
    for (const t of componentTerminals(g.components[cid]!, g.registry)) {
      const key = terminalKey(cid, t.terminalId);
      if (materialized.has(key)) continue;
      points.push({ key: `t:${key}`, position: t.position, net: `t:${key}`, componentId: cid, terminalId: t.terminalId });
    }
  }
  return points;
}

/**
 * Índice por filas y columnas de segmentos y puntos de conexión. Permite responder rápido
 * "¿qué hay sobre esta línea?", que es todo lo que necesitan el validador y el router.
 */
export class GeometryIndex {
  readonly hSegs = new Map<number, IndexedSegment[]>();
  readonly vSegs = new Map<number, IndexedSegment[]>();
  readonly diagonal: IndexedSegment[] = [];
  readonly pointsAt = new Map<string, ConnectionPoint[]>();
  readonly pointsByRow = new Map<number, ConnectionPoint[]>();
  readonly pointsByCol = new Map<number, ConnectionPoint[]>();
  readonly points: ConnectionPoint[];

  constructor(
    g: WorkGraph,
    readonly netOfVertex: (id: Id) => NetId,
    excludeSegments: ReadonlySet<Id> = new Set(),
  ) {
    for (const id of Object.keys(g.segments).sort(compareIds)) {
      if (excludeSegments.has(id)) continue;
      const s = g.segments[id]!;
      this.addSegment(id, g.pos(s.a), g.pos(s.b), netOfVertex(s.a));
    }
    this.points = connectionPoints(g, netOfVertex);
    for (const p of this.points) this.addPoint(p);
  }

  static forGraph(g: WorkGraph): GeometryIndex {
    const nets = computeNets(g.asDocument());
    return new GeometryIndex(g, (id) => nets.netOfVertex.get(id)!);
  }

  addSegment(id: Id, a: Point, b: Point, net: NetId): void {
    if (a.y === b.y && a.x !== b.x) {
      push(this.hSegs, a.y, { id, net, a, b, line: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
    } else if (a.x === b.x && a.y !== b.y) {
      push(this.vSegs, a.x, { id, net, a, b, line: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
    } else if (a.x !== b.x && a.y !== b.y) {
      this.diagonal.push({ id, net, a, b, line: NaN, lo: NaN, hi: NaN });
    }
  }

  addPoint(p: ConnectionPoint): void {
    push(this.pointsAt, `${p.position.x},${p.position.y}`, p);
    push(this.pointsByRow, p.position.y, p);
    push(this.pointsByCol, p.position.x, p);
  }

  /** Puntos de conexión exactamente en `p`. */
  at(p: Point): readonly ConnectionPoint[] {
    return this.pointsAt.get(`${p.x},${p.y}`) ?? [];
  }

  /** Segmentos que contienen `p` estrictamente en su interior. */
  segmentsThrough(p: Point): IndexedSegment[] {
    const out: IndexedSegment[] = [];
    for (const s of this.hSegs.get(p.y) ?? []) if (p.x > s.lo && p.x < s.hi) out.push(s);
    for (const s of this.vSegs.get(p.x) ?? []) if (p.y > s.lo && p.y < s.hi) out.push(s);
    return out;
  }

  /**
   * ¿La cadena `poly` (de la red `net`) introduce alguna ambigüedad con otras redes?
   * Se ignoran sus dos extremos: son vértices ya existentes cuya situación no depende de la ruta.
   */
  chainConflicts(poly: readonly Point[], net: NetId): boolean {
    for (let i = 0; i + 1 < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[i + 1]!;
      if (a.x === b.x && a.y === b.y) continue;
      if (this.segmentConflicts(a, b, net)) return true;
    }
    for (let i = 1; i + 1 < poly.length; i++) {
      const corner = poly[i]!;
      if (this.at(corner).some((p) => p.net !== net)) return true; // V3
      if (this.segmentsThrough(corner).some((s) => s.net !== net)) return true; // V2
    }
    return false;
  }

  /** Conflictos del interior de un tramo a–b de la red `net`: V1 (solape) y V2 (punto ajeno dentro). */
  segmentConflicts(a: Point, b: Point, net: NetId): boolean {
    if (a.y === b.y) {
      const lo = Math.min(a.x, b.x);
      const hi = Math.max(a.x, b.x);
      for (const s of this.hSegs.get(a.y) ?? []) {
        if (s.net !== net && Math.min(hi, s.hi) - Math.max(lo, s.lo) > 0) return true;
      }
      for (const p of this.pointsByRow.get(a.y) ?? []) {
        if (p.net !== net && p.position.x > lo && p.position.x < hi) return true;
      }
      return false;
    }
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    for (const s of this.vSegs.get(a.x) ?? []) {
      if (s.net !== net && Math.min(hi, s.hi) - Math.max(lo, s.lo) > 0) return true;
    }
    for (const p of this.pointsByCol.get(a.x) ?? []) {
      if (p.net !== net && p.position.y > lo && p.position.y < hi) return true;
    }
    return false;
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
