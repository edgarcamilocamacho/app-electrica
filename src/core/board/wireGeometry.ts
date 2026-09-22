/**
 * Geometría del cable (PLAN §22.2). Un cable es una polilínea ortogonal entre dos bornes; sus codos
 * le pertenecen solo a él, así que acá no hay nada compartido con otros cables.
 */
import { DIR_VECTOR, samePoint } from '../model/geometry';
import type { Dir, Point } from '../model/types';
import type { BoardDocument, Wire } from './model';
import { terminalPosition } from './model';
import type { DeviceRegistry } from './registry';

export type Segment = readonly [Point, Point];

/** Distancia que el cable sale recto del tornillo antes de doblar. */
export const STUB = 2;

export function wireRoute(doc: BoardDocument, registry: DeviceRegistry, wire: Wire): readonly Point[] {
  return [terminalPosition(doc, registry, wire.a), ...wire.bends, terminalPosition(doc, registry, wire.b)];
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

/** Traslada los codos de un cable, para cuando se mueve todo el conjunto. */
export function translateBends(bends: readonly Point[], dx: number, dy: number): Point[] {
  return bends.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}
