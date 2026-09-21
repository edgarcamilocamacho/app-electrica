import { computeNets, type NetId } from '../connectivity/nets';
import { otherEnd, type OpContext } from '../model/document';
import { pointKey, samePoint } from '../model/geometry';
import { compareIds, sortIds } from '../model/ids';
import type { CircuitDocument, Id, Point } from '../model/types';
import { WorkGraph } from './graph';

/**
 * Canonicalización (PLAN §4.5): reescribe el grafo de cableado a su forma normal única, sin
 * cambiar nunca la partición en redes ni la geometría que cubre cada red. Opera solo dentro de
 * una misma red; las coincidencias entre redes distintas son trabajo del validador.
 *
 * Pasos, en orden fijo y hasta punto fijo:
 *   1. segmentos de largo cero → se fusionan sus vértices (salvo terminal+terminal);
 *   2. segmentos duplicados y lazos → se eliminan;
 *   3a. vértices de la misma red en la misma posición → se fusionan;
 *   3b. vértice de la misma red en el interior de un segmento → se parte el segmento;
 *   4. esquinas redundantes (point, grado 2, colineal, estrictamente entre vecinos) → se fusionan;
 *   5. vértices sin segmentos → se eliminan (un terminal sin cables se desmaterializa).
 */
export function canonicalize(doc: CircuitDocument, ctx: OpContext): CircuitDocument {
  const g = new WorkGraph(doc, ctx.registry);
  canonicalizeGraph(g, ctx);
  return g.toDocument();
}

const MAX_PASSES = 10_000;

export function canonicalizeGraph(g: WorkGraph, ctx: OpContext): void {
  // La partición no cambia durante la canonicalización: basta calcularla una vez.
  const nets = computeNets(g.asDocument());
  const netOf = (vertexId: Id): NetId => nets.netOfVertex.get(vertexId)!;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    changed = dropZeroLength(g) || changed;
    changed = dropDuplicates(g) || changed;
    changed = mergeCoincident(g, netOf) || changed;
    changed = splitAtInteriorVertices(g, netOf, ctx) || changed;
    changed = mergeCollinear(g) || changed;
    changed = dropOrphans(g) || changed;
    if (!changed) return;
  }
  throw new Error('La canonicalización no convergió');
}

/** Paso 1. */
function dropZeroLength(g: WorkGraph): boolean {
  let changed = false;
  for (const segId of sortIds(Object.keys(g.segments))) {
    const seg = g.segments[segId];
    if (!seg) continue;
    if (seg.a === seg.b) {
      g.removeSegment(segId);
      changed = true;
      continue;
    }
    if (!samePoint(g.pos(seg.a), g.pos(seg.b))) continue;
    const va = g.vertices[seg.a]!;
    const vb = g.vertices[seg.b]!;
    if (va.kind === 'terminal' && vb.kind === 'terminal') continue; // terminal sobre terminal
    const keep = va.kind === 'terminal' ? va.id : vb.kind === 'terminal' ? vb.id : minId(va.id, vb.id);
    const drop = keep === va.id ? vb.id : va.id;
    g.removeSegment(segId);
    g.replaceVertex(drop, keep);
    changed = true;
  }
  return changed;
}

/** Paso 2. */
function dropDuplicates(g: WorkGraph): boolean {
  let changed = false;
  const seen = new Set<string>();
  for (const segId of sortIds(Object.keys(g.segments))) {
    const seg = g.segments[segId]!;
    if (seg.a === seg.b) {
      g.removeSegment(segId);
      changed = true;
      continue;
    }
    const key = compareIds(seg.a, seg.b) < 0 ? `${seg.a}|${seg.b}` : `${seg.b}|${seg.a}`;
    if (seen.has(key)) {
      g.removeSegment(segId);
      changed = true;
    } else {
      seen.add(key);
    }
  }
  return changed;
}

/** Paso 3a. */
function mergeCoincident(g: WorkGraph, netOf: (id: Id) => NetId): boolean {
  let changed = false;
  const groups = new Map<string, Id[]>();
  for (const id of sortIds(Object.keys(g.vertices))) {
    const key = `${pointKey(g.pos(id))}|${netOf(id)}`;
    const list = groups.get(key) ?? [];
    list.push(id);
    groups.set(key, list);
  }
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const terminal = ids.find((id) => g.vertices[id]!.kind === 'terminal');
    const keep = terminal ?? ids[0]!;
    for (const id of ids) {
      if (id === keep || g.vertices[id]!.kind === 'terminal') continue;
      g.replaceVertex(id, keep);
      changed = true;
    }
  }
  return changed;
}

/** Paso 3b. */
function splitAtInteriorVertices(g: WorkGraph, netOf: (id: Id) => NetId, ctx: OpContext): boolean {
  // Vértices indexados por fila (y) y por columna (x).
  const byRow = new Map<number, { id: Id; p: Point }[]>();
  const byCol = new Map<number, { id: Id; p: Point }[]>();
  for (const id of sortIds(Object.keys(g.vertices))) {
    const p = g.pos(id);
    (byRow.get(p.y) ?? byRow.set(p.y, []).get(p.y)!).push({ id, p });
    (byCol.get(p.x) ?? byCol.set(p.x, []).get(p.x)!).push({ id, p });
  }

  let changed = false;
  for (const segId of sortIds(Object.keys(g.segments))) {
    const seg = g.segments[segId];
    if (!seg) continue;
    const a = g.pos(seg.a);
    const b = g.pos(seg.b);
    const net = netOf(seg.a);
    let inside: { id: Id; t: number }[] = [];
    if (a.y === b.y && a.x !== b.x) {
      const [lo, hi] = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
      inside = (byRow.get(a.y) ?? [])
        .filter((v) => v.p.x > lo && v.p.x < hi && netOf(v.id) === net)
        .map((v) => ({ id: v.id, t: Math.abs(v.p.x - a.x) }));
    } else if (a.x === b.x && a.y !== b.y) {
      const [lo, hi] = a.y < b.y ? [a.y, b.y] : [b.y, a.y];
      inside = (byCol.get(a.x) ?? [])
        .filter((v) => v.p.y > lo && v.p.y < hi && netOf(v.id) === net)
        .map((v) => ({ id: v.id, t: Math.abs(v.p.y - a.y) }));
    }
    if (inside.length === 0) continue;

    // Parte el segmento en cadena a → v1 → v2 → … → b. El primer tramo conserva el id original.
    inside.sort((x, y) => x.t - y.t || compareIds(x.id, y.id));
    g.removeSegment(segId);
    let prev = seg.a;
    let first = true;
    for (const { id } of [...inside, { id: seg.b, t: Infinity }]) {
      g.addSegment({ id: first ? seg.id : ctx.ids.next('s'), a: prev, b: id });
      first = false;
      prev = id;
    }
    changed = true;
  }
  return changed;
}

/** Paso 4. */
function mergeCollinear(g: WorkGraph): boolean {
  let changed = false;
  for (const vid of sortIds(Object.keys(g.vertices))) {
    const v = g.vertices[vid];
    if (!v || v.kind !== 'point' || g.degree(vid) !== 2) continue;
    const [s1Id, s2Id] = g.segmentsAt(vid) as [Id, Id];
    const s1 = g.segments[s1Id]!;
    const s2 = g.segments[s2Id]!;
    const aId = otherEnd(s1, vid);
    const bId = otherEnd(s2, vid);
    if (aId === bId) continue;
    const p = v.position;
    const a = g.pos(aId);
    const b = g.pos(bId);
    const horizontal = a.y === p.y && b.y === p.y;
    const vertical = a.x === p.x && b.x === p.x;
    if (!horizontal && !vertical) continue; // esquina real
    const between = horizontal
      ? (a.x < p.x && p.x < b.x) || (b.x < p.x && p.x < a.x)
      : (a.y < p.y && p.y < b.y) || (b.y < p.y && p.y < a.y);
    if (!between) continue; // solapamiento degenerado: fusionar perdería geometría
    g.removeSegment(s1Id);
    g.removeSegment(s2Id);
    g.removeVertex(vid);
    g.addSegment({ id: minId(s1Id, s2Id), a: aId, b: bId });
    changed = true;
  }
  return changed;
}

/** Paso 5. */
function dropOrphans(g: WorkGraph): boolean {
  let changed = false;
  for (const vid of sortIds(Object.keys(g.vertices))) {
    if (g.degree(vid) === 0) {
      g.removeVertex(vid);
      changed = true;
    }
  }
  return changed;
}

const minId = (a: Id, b: Id): Id => (compareIds(a, b) <= 0 ? a : b);
