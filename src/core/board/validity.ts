/**
 * Validador del tablero (PLAN §22.5). Reemplaza a V1–V5 del modelo clásico.
 *
 * | # | Regla |
 * |---|---|
 * | W1 | Dos cables de **redes distintas** no pueden solaparse en colineal; los de la misma red sí |
 * | W2 | Un cable no puede pasar exactamente por un **borne ajeno** |
 * | W3 | Un codo de un cable no puede caer dentro de un tramo de otro cable de otra red |
 * | W4 | Dos **aparatos** no pueden superponerse |
 *
 * Una operación es válida si **no agrega** violaciones: se comparan por clave geométrica, igual que
 * en el modelo clásico, así que un documento que ya venía con un problema se puede seguir editando.
 */
import { pointKey, strictlyInside, type Rect } from '../model/geometry';
import type { Id, Point } from '../model/types';
import type { BoardDocument, TerminalRef } from './model';
import { deviceRect, terminalKey, terminalPosition } from './model';
import { computeNets, type NetId } from './nets';
import type { DeviceRegistry } from './registry';
import { routeSegments, wireRoute, type Segment } from './wireGeometry';

export type ViolationCode = 'W1' | 'W2' | 'W3' | 'W4';

export interface Violation {
  readonly code: ViolationCode;
  /** Clave geométrica estable: dos corridas del mismo problema dan la misma clave. */
  readonly key: string;
  readonly at: Point;
  readonly wires?: readonly Id[];
  readonly devices?: readonly Id[];
}

interface WireGeom {
  readonly id: Id;
  readonly net: NetId;
  readonly route: readonly Point[];
  readonly segments: readonly Segment[];
}

const sortKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

const spanKey = (s: Segment): string => {
  const [a, b] = s;
  return a.x < b.x || (a.x === b.x && a.y < b.y)
    ? `${a.x},${a.y}-${b.x},${b.y}`
    : `${b.x},${b.y}-${a.x},${a.y}`;
};

/** Solapamiento colineal de dos tramos ortogonales: devuelve el punto medio del tramo común. */
function overlap(s: Segment, t: Segment): Point | undefined {
  const [a, b] = s;
  const [c, d] = t;
  const sHorizontal = a.y === b.y;
  const tHorizontal = c.y === d.y;
  if (sHorizontal !== tHorizontal) return undefined;
  if (sHorizontal) {
    if (a.y !== c.y) return undefined;
    const lo = Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
    const hi = Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x));
    return hi > lo ? { x: (lo + hi) / 2, y: a.y } : undefined;
  }
  if (a.x !== c.x) return undefined;
  const lo = Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
  const hi = Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y));
  return hi > lo ? { x: a.x, y: (lo + hi) / 2 } : undefined;
}

const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

function wireGeometry(doc: BoardDocument, registry: DeviceRegistry): WireGeom[] {
  const nets = computeNets(doc, registry);
  const out: WireGeom[] = [];
  for (const wire of Object.values(doc.wires)) {
    const route = wireRoute(doc, registry, wire);
    out.push({ id: wire.id, net: nets.netOf(wire.a), route, segments: routeSegments(route) });
  }
  return out.sort((x, y) => (x.id < y.id ? -1 : 1));
}

/** Bornes que no son extremo de este cable, con su posición. */
function foreignTerminals(
  doc: BoardDocument,
  registry: DeviceRegistry,
): readonly { readonly ref: TerminalRef; readonly position: Point }[] {
  const out: { ref: TerminalRef; position: Point }[] = [];
  for (const device of Object.values(doc.devices)) {
    const def = registry.get(device.type);
    if (!def) continue;
    for (const terminal of def.terminals) {
      const ref = { deviceId: device.id, terminalId: terminal.id };
      out.push({ ref, position: terminalPosition(doc, registry, ref) });
    }
  }
  return out;
}

export function violations(doc: BoardDocument, registry: DeviceRegistry): Violation[] {
  const found = new Map<string, Violation>();
  const add = (v: Violation): void => {
    if (!found.has(v.key)) found.set(v.key, v);
  };

  const wires = wireGeometry(doc, registry);

  // W1 y W3 — entre pares de cables de redes distintas.
  for (let i = 0; i < wires.length; i += 1) {
    for (let j = i + 1; j < wires.length; j += 1) {
      const a = wires[i]!;
      const b = wires[j]!;
      if (a.net === b.net) continue;
      for (const s of a.segments) {
        for (const t of b.segments) {
          const at = overlap(s, t);
          if (at) {
            add({ code: 'W1', key: `W1:${sortKey(spanKey(s), spanKey(t))}`, at, wires: [a.id, b.id] });
          }
        }
      }
      for (const [source, target] of [
        [a, b],
        [b, a],
      ] as const) {
        for (const bend of source.route.slice(1, -1)) {
          for (const t of target.segments) {
            if (strictlyInside(bend, t[0], t[1])) {
              add({ code: 'W3', key: `W3:${pointKey(bend)}:${sortKey(source.id, target.id)}`, at: bend, wires: [source.id, target.id] });
            }
          }
        }
      }
    }
  }

  // W2 — un cable que pasa por un borne que no es suyo.
  const terminals = foreignTerminals(doc, registry);
  for (const wire of wires) {
    const own = new Set<string>();
    const w = doc.wires[wire.id]!;
    own.add(terminalKey(w.a));
    own.add(terminalKey(w.b));
    for (const terminal of terminals) {
      if (own.has(terminalKey(terminal.ref))) continue;
      for (const s of wire.segments) {
        if (strictlyInside(terminal.position, s[0], s[1])) {
          add({
            code: 'W2',
            key: `W2:${terminalKey(terminal.ref)}:${wire.id}`,
            at: terminal.position,
            wires: [wire.id],
            devices: [terminal.ref.deviceId],
          });
        }
      }
    }
  }

  // W4 — aparatos superpuestos.
  const devices = Object.values(doc.devices)
    .map((device) => {
      const def = registry.get(device.type);
      return def ? { id: device.id, rect: deviceRect(device, def) } : undefined;
    })
    .filter((d): d is { id: Id; rect: Rect } => d !== undefined)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  for (let i = 0; i < devices.length; i += 1) {
    for (let j = i + 1; j < devices.length; j += 1) {
      const a = devices[i]!;
      const b = devices[j]!;
      if (rectsOverlap(a.rect, b.rect)) {
        add({
          code: 'W4',
          key: `W4:${sortKey(a.id, b.id)}`,
          at: { x: Math.max(a.rect.minX, b.rect.minX), y: Math.max(a.rect.minY, b.rect.minY) },
          devices: [a.id, b.id],
        });
      }
    }
  }

  return [...found.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** Violaciones que `next` agrega respecto de `previous`, comparadas por clave. */
export function addedViolations(
  previous: BoardDocument,
  next: BoardDocument,
  registry: DeviceRegistry,
): Violation[] {
  const before = new Set(violations(previous, registry).map((v) => v.key));
  return violations(next, registry).filter((v) => !before.has(v.key));
}
