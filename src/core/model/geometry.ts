import type { Dir, Point, Rotation } from './types';

export const pt = (x: number, y: number): Point => ({ x, y });

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });

export const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

export const pointKey = (p: Point): string => `${p.x},${p.y}`;

export const manhattan = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Rota un desplazamiento en sentido horario (y hacia abajo): (x, y) → (−y, x) por cada 90°. */
export function rotateOffset(p: Point, rotation: Rotation): Point {
  switch (rotation) {
    case 0:
      return p;
    case 90:
      return { x: -p.y || 0, y: p.x };
    case 180:
      return { x: -p.x || 0, y: -p.y || 0 };
    case 270:
      return { x: p.y, y: -p.x || 0 };
  }
}

const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

export function rotateDir(dir: Dir, rotation: Rotation): Dir {
  const steps = rotation / 90;
  return DIRS[(DIRS.indexOf(dir) + steps) % 4]!;
}

export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

export const DIR_VECTOR: Readonly<Record<Dir, Point>> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

/** Dirección del paso de `from` a `to` (deben estar alineados y ser distintos). */
export function dirBetween(from: Point, to: Point): Dir {
  if (from.x === to.x) return to.y < from.y ? 'N' : 'S';
  return to.x < from.x ? 'W' : 'E';
}

export type Axis = 'H' | 'V';

/** Eje de un tramo; undefined si es diagonal o de largo cero. */
export function axisOf(a: Point, b: Point): Axis | undefined {
  if (a.y === b.y && a.x !== b.x) return 'H';
  if (a.x === b.x && a.y !== b.y) return 'V';
  return undefined;
}

export const isOrthogonal = (a: Point, b: Point): boolean => a.x === b.x || a.y === b.y;

/** ¿`p` está estrictamente dentro del tramo a–b (sin contar extremos)? Tramo ortogonal. */
export function strictlyInside(p: Point, a: Point, b: Point): boolean {
  if (a.y === b.y && p.y === a.y) return p.x > Math.min(a.x, b.x) && p.x < Math.max(a.x, b.x);
  if (a.x === b.x && p.x === a.x) return p.y > Math.min(a.y, b.y) && p.y < Math.max(a.y, b.y);
  return false;
}

/** ¿`p` está sobre el tramo cerrado a–b (extremos incluidos)? */
export function onSegment(p: Point, a: Point, b: Point): boolean {
  return samePoint(p, a) || samePoint(p, b) || strictlyInside(p, a, b);
}

export interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function rectContains(r: Rect, p: Point): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
}

export function rectFromPoints(points: readonly Point[]): Rect | undefined {
  if (points.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function rectUnion(a: Rect, b: Rect): Rect {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Rota un rectángulo relativo al origen del componente. */
export function rotateRect(r: Rect, rotation: Rotation): Rect {
  const corners = [
    rotateOffset({ x: r.minX, y: r.minY }, rotation),
    rotateOffset({ x: r.maxX, y: r.maxY }, rotation),
  ];
  return rectFromPoints(corners)!;
}

/** Distancia de un punto a un tramo ortogonal (en unidades de grid, admite decimales). */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const cx = Math.max(minX, Math.min(p.x, maxX));
  const cy = Math.max(minY, Math.min(p.y, maxY));
  return Math.hypot(p.x - cx, p.y - cy);
}
