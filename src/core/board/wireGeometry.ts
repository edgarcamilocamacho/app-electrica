/**
 * Geometría del cable (PLAN §22.2). Un cable es una polilínea ortogonal entre dos bornes; sus codos
 * le pertenecen solo a él, así que acá no hay nada compartido con otros cables.
 */
import { DIR_VECTOR, samePoint } from '../model/geometry';
import type { Dir, Point } from '../model/types';
import type { BoardDocument, Wire } from './model';
import { endPosition } from './model';
import type { DeviceRegistry } from './registry';

export type Segment = readonly [Point, Point];

/** Distancia que el cable sale recto del tornillo antes de doblar. */
export const STUB = 2;

export function wireRoute(doc: BoardDocument, registry: DeviceRegistry, wire: Wire): readonly Point[] {
  return [endPosition(doc, registry, wire.a), ...wire.bends, endPosition(doc, registry, wire.b)];
}

/** Quita puntos repetidos y codos que no cambian de dirección. */
export function normalizeRoute(route: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of route) {
    const last = out[out.length - 1];
    if (last && samePoint(last, p)) continue;
    out.push(p);
  }
  for (let i = 1; i < out.length - 1; ) {
    const prev = out[i - 1]!;
    const cur = out[i]!;
    const next = out[i + 1]!;
    const collinear = (prev.x === cur.x && cur.x === next.x) || (prev.y === cur.y && cur.y === next.y);
    if (collinear) out.splice(i, 1);
    else i += 1;
  }
  return out;
}

/** Codos de una ruta: la ruta sin sus dos extremos, ya normalizada. */
export function bendsOf(route: readonly Point[]): Point[] {
  const normalized = normalizeRoute(route);
  return normalized.slice(1, -1);
}

export function isOrthogonalRoute(route: readonly Point[]): boolean {
  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1]!;
    const b = route[i]!;
    if (a.x !== b.x && a.y !== b.y) return false;
  }
  return true;
}

export function routeSegments(route: readonly Point[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1]!;
    const b = route[i]!;
    if (!samePoint(a, b)) segments.push([a, b]);
  }
  return segments;
}

export function routeLength(route: readonly Point[]): number {
  let total = 0;
  for (const [a, b] of routeSegments(route)) total += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  return total;
}

const isVertical = (dir: Dir): boolean => dir === 'N' || dir === 'S';

const step = (p: Point, dir: Dir, distance: number): Point => ({
  x: p.x + DIR_VECTOR[dir].x * distance,
  y: p.y + DIR_VECTOR[dir].y * distance,
});

/**
 * Ruta por defecto entre dos bornes: sale recto de cada tornillo y llega con uno o dos codos.
 * Devuelve la ruta completa, extremos incluidos.
 */
export function autoRoute(from: Point, fromDir: Dir, to: Point, toDir: Dir, stub = STUB): Point[] {
  const p = step(from, fromDir, stub);
  const q = step(to, toDir, stub);
  const fv = isVertical(fromDir);
  const tv = isVertical(toDir);
  const middle: Point[] = [];
  if (fv && tv) {
    if (p.x !== q.x) {
      const y = Math.round((p.y + q.y) / 2);
      middle.push({ x: p.x, y }, { x: q.x, y });
    }
  } else if (!fv && !tv) {
    if (p.y !== q.y) {
      const x = Math.round((p.x + q.x) / 2);
      middle.push({ x, y: p.y }, { x, y: q.y });
    }
  } else if (fv) {
    middle.push({ x: p.x, y: q.y });
  } else {
    middle.push({ x: q.x, y: p.y });
  }
  return normalizeRoute([from, p, ...middle, q, to]);
}

/**
 * Reacomoda una ruta cuando se movió uno de sus bornes: los codos vecinos se estiran para mantener
 * la forma. Si no queda ortogonal, se vuelve a rutear desde cero [PLAN §22.5].
 */
export function repairRoute(
  route: readonly Point[],
  a: Point,
  b: Point,
  aDir: Dir,
  bDir: Dir,
): Point[] {
  const bends = route.slice(1, -1).map((p) => ({ ...p }));
  if (bends.length === 0) {
    return a.x === b.x || a.y === b.y ? normalizeRoute([a, b]) : autoRoute(a, aDir, b, bDir);
  }
  const oldA = route[0]!;
  const oldB = route[route.length - 1]!;
  const first = bends[0]!;
  if (oldA.x === first.x) first.x = a.x;
  else if (oldA.y === first.y) first.y = a.y;
  const last = bends[bends.length - 1]!;
  if (oldB.x === last.x) last.x = b.x;
  else if (oldB.y === last.y) last.y = b.y;
  const repaired = normalizeRoute([a, ...bends, b]);
  return isOrthogonalRoute(repaired) ? repaired : autoRoute(a, aDir, b, bDir);
}

/**
 * Llegada a un borne: el cable entra por el lado por el que sale el tornillo y **nunca vuelve sobre
 * sí mismo**. Si viene de otra columna, rodea; si viene por la columna equivocada, se corre al
 * costado; y si ya viene bien encarado, entra derecho.
 */
export function approachTerminal(last: Point, end: Point, dir: Dir, stub = STUB): Point[] {
  const vertical = isVertical(dir);
  const out = step(end, dir, stub);
  const towards = vertical ? DIR_VECTOR[dir].y : DIR_VECTOR[dir].x;
  const lastMain = vertical ? last.y : last.x;
  const endMain = vertical ? end.y : end.x;
  const lastSide = vertical ? last.x : last.y;
  const endSide = vertical ? end.x : end.y;

  if (lastSide !== endSide) {
    // Viene de otra columna: baja (o sube) hasta la altura de salida y entra de costado.
    const corner = vertical ? { x: last.x, y: out.y } : { x: out.x, y: last.y };
    return normalizeRoute([corner, out, end]);
  }
  // Misma columna: si ya está del lado de la salida, entra derecho.
  if (Math.sign(lastMain - endMain) === towards) return normalizeRoute([end]);
  // Misma columna pero del lado de adentro: se corre al costado para rodear.
  const detour = endSide + 3;
  const first = vertical ? { x: detour, y: last.y } : { x: last.x, y: detour };
  const corner = vertical ? { x: detour, y: out.y } : { x: out.x, y: detour };
  return normalizeRoute([first, corner, out, end]);
}

/** Tramo en L del último punto fijo al destino, continuando por el eje en el que se venía. */
export function wirePathFrom(previous: Point | undefined, last: Point, to: Point): Point[] {
  if (last.x === to.x || last.y === to.y) return [to];
  if (previous) {
    if (previous.x === last.x) return [{ x: last.x, y: to.y }, to];
    if (previous.y === last.y) return [{ x: to.x, y: last.y }, to];
  }
  return wirePath(last, to);
}

/** Tramo en L: primero el eje de mayor desplazamiento. */
export function wirePath(from: Point, to: Point): Point[] {
  if (from.x === to.x || from.y === to.y) return [to];
  return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
    ? [{ x: to.x, y: from.y }, to]
    : [{ x: from.x, y: to.y }, to];
}

/** Traslada los codos de un cable, para cuando se mueve todo el conjunto. */
export function translateBends(bends: readonly Point[], dx: number, dy: number): Point[] {
  return bends.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}
