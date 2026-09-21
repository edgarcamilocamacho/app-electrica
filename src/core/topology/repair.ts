import { computeNets, type NetId } from '../connectivity/nets';
import { otherEnd, terminalDirection, type OpContext } from '../model/document';
import { sub, add } from '../model/geometry';
import { sortIds } from '../model/ids';
import type { Dir, Id, Point } from '../model/types';
import { candidateRoutes } from './candidates';
import type { WorkGraph } from './graph';
import { GeometryIndex } from './spatialIndex';

/**
 * Reparación local tras mover (PLAN §5.3). Se aplica a cada segmento que quedó con un extremo
 * desplazado. En orden de preferencia:
 *
 *   1. Si se movió un terminal y el otro extremo es libre → lo acompaña (el cable suelto viaja
 *      con el componente).
 *   2. Si sigue alineado y no genera ambigüedad → se deja (se estira o se acorta).
 *   3. Si el otro extremo es una esquina → se desliza sobre su otro tramo, conservando la forma
 *      (sin agregar codos).
 *   4. Si no → la primera ruta candidata sin ambigüedad (§5.4).
 *   5. Si ninguna sirve → se usa la mejor igual (para la vista previa) y se marca como fallida.
 *
 * Se procesa en orden de id: mismo documento, mismo resultado.
 */
export interface RepairOptions {
  readonly moved: ReadonlySet<Id>;
  /** Posición previa de cada vértice movido. */
  readonly originalPositions: ReadonlyMap<Id, Point>;
}

export interface RepairResult {
  readonly failedSegments: readonly Id[];
}

export function repairAfterMove(g: WorkGraph, ctx: OpContext, options: RepairOptions): RepairResult {
  const nets = computeNets(g.asDocument());
  const chainNets = new Map<Id, NetId>();
  const netOf = (id: Id): NetId => chainNets.get(id) ?? nets.netOfVertex.get(id) ?? `v:${id}`;
  const moved = new Set(options.moved);
  const failed: Id[] = [];

  const todo = sortIds(
    Object.values(g.segments)
      .filter((s) => moved.has(s.a) || moved.has(s.b))
      .map((s) => s.id),
  );

  for (const segId of todo) {
    const seg = g.segments[segId];
    if (!seg) continue;
    const aMoved = moved.has(seg.a);
    const bMoved = moved.has(seg.b);
    const pa = g.pos(seg.a);
    const pb = g.pos(seg.b);
    if (aMoved && bMoved && aligned(pa, pb)) continue; // traslación rígida o estiramiento

    const m = aMoved ? seg.a : seg.b;
    const f = m === seg.a ? seg.b : seg.a;
    const pm = g.pos(m);
    const pf = g.pos(f);
    const net = netOf(m);
    let indexCache: GeometryIndex | undefined;
    const index = () => (indexCache ??= new GeometryIndex(g, netOf, new Set([segId])));

    const fv = g.vertices[f]!;
    const origM = options.originalPositions.get(m) ?? pm;

    // 1. Extremo libre colgado de un componente movido: el cable suelto viaja con él.
    //    (Al mover un segmento, en cambio, los vecinos se estiran: R2 §3.)
    if (fv.kind === 'point' && !moved.has(f) && g.degree(f) === 1 && g.vertices[m]!.kind === 'terminal') {
      g.setVertex({ ...fv, position: add(pf, sub(pm, origM)) });
      moved.add(f);
      continue;
    }

    // 2. Sigue alineado y sin conflictos: se estira o se acorta.
    if (aligned(pm, pf) && naturalDirection(g, m, f, pm, pf, ctx) && !index().chainConflicts([pm, pf], net)) continue;

    if (fv.kind === 'point' && !moved.has(f)) {
      // 3. Esquina: se desliza sobre su otro tramo.
      if (g.degree(f) === 2) {
        const otherId = g.segmentsAt(f).find((id) => id !== segId)!;
        const c = otherEnd(g.segments[otherId]!, f);
        const pc = g.pos(c);
        let slid: Point | undefined;
        if (origM.x === pf.x && pc.y === pf.y && pc.x !== pf.x) slid = { x: pm.x, y: pf.y };
        else if (origM.y === pf.y && pc.x === pf.x && pc.y !== pf.y) slid = { x: pf.x, y: pm.y };
        if (slid && !moved.has(c) && naturalDirection(g, m, f, pm, slid, ctx)) {
          const idx2 = new GeometryIndex(g, netOf, new Set([segId, otherId]));
          if (!idx2.chainConflicts([pm, slid, pc], net)) {
            g.setVertex({ ...fv, position: slid });
            continue;
          }
        }
      }
    }

    // 4–5. Rutas candidatas.
    const routes = candidateRoutes({ from: pm, to: pf, fromDir: dirOf(g, m, ctx), toDir: dirOf(g, f, ctx) });
    let chosen = routes.find((r) => !index().chainConflicts(r, net));
    if (!chosen) {
      chosen = routes[0]!;
      failed.push(segId);
    }
    replaceWithChain(g, ctx, seg.id, m, f, chosen, (id) => chainNets.set(id, net));
  }
  return { failedSegments: failed };
}

const aligned = (a: Point, b: Point): boolean => a.x === b.x || a.y === b.y;

const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

function stepDir(a: Point, b: Point): Dir {
  if (a.x === b.x) return b.y < a.y ? 'N' : 'S';
  return b.x < a.x ? 'W' : 'E';
}

/**
 * ¿Un tramo recto de `m` hacia `f` sale y llega por el lado natural de los terminales?
 * Un cable que sale de un terminal hacia adentro de su propio símbolo se ve como si lo atravesara:
 * en ese caso se prefieren las rutas candidatas, que lo rodean.
 */
function naturalDirection(g: WorkGraph, m: Id, f: Id, pm: Point, pf: Point, ctx: OpContext): boolean {
  if (pm.x === pf.x && pm.y === pf.y) return true;
  const step = stepDir(pm, pf);
  const dm = dirOf(g, m, ctx);
  if (dm && step === OPPOSITE[dm]) return false;
  const df = dirOf(g, f, ctx);
  if (df && step === df) return false;
  return true;
}

function dirOf(g: WorkGraph, vertexId: Id, ctx: OpContext): Dir | undefined {
  const v = g.vertices[vertexId];
  if (!v || v.kind !== 'terminal') return undefined;
  const component = g.components[v.componentId];
  return component ? terminalDirection(component, v.terminalId, ctx.registry) : undefined;
}

/** Reemplaza un segmento por una cadena m → … → f. El primer tramo conserva el id original. */
export function replaceWithChain(
  g: WorkGraph,
  ctx: OpContext,
  segmentId: Id,
  from: Id,
  to: Id,
  poly: readonly Point[],
  onNewVertex: (id: Id) => void = () => {},
): void {
  g.removeSegment(segmentId);
  if (poly.length <= 1) {
    g.addSegment({ id: segmentId, a: from, b: to }); // largo cero: lo resuelve la canonicalización
    return;
  }
  let prev = from;
  for (let i = 1; i < poly.length; i++) {
    const isLast = i === poly.length - 1;
    let next = to;
    if (!isLast) {
      next = ctx.ids.next('v');
      g.addVertex({ id: next, kind: 'point', position: poly[i]! });
      onNewVertex(next);
    }
    g.addSegment({ id: i === 1 ? segmentId : ctx.ids.next('s'), a: prev, b: next });
    prev = next;
  }
}
