import { add, DIR_VECTOR } from '../model/geometry';
import type { Dir, Point } from '../model/types';

/**
 * Rutas ortogonales candidatas entre dos puntos (PLAN §5.4), ordenadas por costo.
 * El router toma la primera que no introduce ambigüedades.
 *
 * Familias: recta · dos L · todas las Z (tramo intermedio en cada coordenada del rango) ·
 * U (el tramo intermedio sale del rectángulo hasta `margin` celdas). Además, variantes que
 * primero salen un paso del terminal en su dirección natural.
 */
export interface RouteRequest {
  readonly from: Point;
  readonly to: Point;
  /** Dirección de salida preferida en `from` (si es un terminal). */
  readonly fromDir?: Dir;
  /** Dirección de salida del terminal en `to`: el cable debería llegar desde ese lado. */
  readonly toDir?: Dir;
}

export const ROUTE_MARGIN = 4;
const BEND_COST = 3;
const WRONG_WAY_COST = 40;
const SIDEWAYS_COST = 2;

export function candidateRoutes(req: RouteRequest, margin = ROUTE_MARGIN): Point[][] {
  const { from, to } = req;
  if (from.x === to.x && from.y === to.y) return [[from]];

  const scored: { poly: Point[]; cost: number; order: number }[] = [];
  const seen = new Set<string>();
  let order = 0;

  const consider = (raw: Point[]) => {
    const poly = simplify(raw);
    const key = poly.map((p) => `${p.x},${p.y}`).join(' ');
    if (seen.has(key) || !isOrthogonalPolyline(poly)) return;
    seen.add(key);
    scored.push({ poly, cost: routeCost(poly, req), order: order++ });
  };

  const starts: { stub: Point[]; p: Point }[] = [{ stub: [], p: from }];
  if (req.fromDir) starts.push({ stub: [from], p: add(from, DIR_VECTOR[req.fromDir]) });
  const ends: { stub: Point[]; p: Point }[] = [{ stub: [], p: to }];
  if (req.toDir) ends.push({ stub: [to], p: add(to, DIR_VECTOR[req.toDir]) });

  for (const s of starts) {
    for (const e of ends) {
      for (const core of coreRoutes(s.p, e.p, margin)) consider([...s.stub, ...core, ...e.stub]);
    }
  }

  scored.sort((a, b) => a.cost - b.cost || a.order - b.order);
  return scored.map((s) => s.poly);
}

function coreRoutes(a: Point, b: Point, margin: number): Point[][] {
  const routes: Point[][] = [];
  if (a.x === b.x || a.y === b.y) routes.push([a, b]);
  routes.push([a, { x: b.x, y: a.y }, b]);
  routes.push([a, { x: a.x, y: b.y }, b]);
  const minX = Math.min(a.x, b.x) - margin;
  const maxX = Math.max(a.x, b.x) + margin;
  const minY = Math.min(a.y, b.y) - margin;
  const maxY = Math.max(a.y, b.y) + margin;
  for (let x = minX; x <= maxX; x++) routes.push([a, { x, y: a.y }, { x, y: b.y }, b]);
  for (let y = minY; y <= maxY; y++) routes.push([a, { x: a.x, y }, { x: b.x, y }, b]);
  return routes;
}

/** Quita puntos repetidos y puntos intermedios colineales (sin perder retrocesos). */
export function simplify(poly: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    out.push(p);
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3) as [Point, Point, Point];
      const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
      const between = collinear && (Math.sign(b.x - a.x) === Math.sign(c.x - b.x) && Math.sign(b.y - a.y) === Math.sign(c.y - b.y));
      if (!between) break;
      out.splice(out.length - 2, 1);
    }
  }
  return out;
}

function isOrthogonalPolyline(poly: readonly Point[]): boolean {
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[i + 1]!;
    if (a.x !== b.x && a.y !== b.y) return false;
  }
  // Un retroceso sobre sí mismo (ida y vuelta por el mismo tramo) no es una ruta útil.
  for (let i = 0; i + 2 < poly.length; i++) {
    const [a, b, c] = [poly[i]!, poly[i + 1]!, poly[i + 2]!];
    const reverses =
      (a.x === b.x && b.x === c.x && Math.sign(b.y - a.y) === -Math.sign(c.y - b.y)) ||
      (a.y === b.y && b.y === c.y && Math.sign(b.x - a.x) === -Math.sign(c.x - b.x));
    if (reverses) return false;
  }
  return true;
}

function stepDir(a: Point, b: Point): Dir {
  if (a.x === b.x) return b.y < a.y ? 'N' : 'S';
  return b.x < a.x ? 'W' : 'E';
}

const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

function routeCost(poly: readonly Point[], req: RouteRequest): number {
  let length = 0;
  for (let i = 0; i + 1 < poly.length; i++) {
    length += Math.abs(poly[i + 1]!.x - poly[i]!.x) + Math.abs(poly[i + 1]!.y - poly[i]!.y);
  }
  const bends = Math.max(0, poly.length - 2);
  let cost = length + BEND_COST * bends;
  if (poly.length >= 2) {
    if (req.fromDir) {
      const first = stepDir(poly[0]!, poly[1]!);
      if (first === OPPOSITE[req.fromDir]) cost += WRONG_WAY_COST;
      else if (first !== req.fromDir) cost += SIDEWAYS_COST;
    }
    if (req.toDir) {
      // Llegar al terminal viniendo desde su lado: el último paso va en sentido opuesto a su dirección.
      const last = stepDir(poly[poly.length - 2]!, poly[poly.length - 1]!);
      if (last === req.toDir) cost += WRONG_WAY_COST;
      else if (last !== OPPOSITE[req.toDir]) cost += SIDEWAYS_COST;
    }
  }
  return cost;
}
