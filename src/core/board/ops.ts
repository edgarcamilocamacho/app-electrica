/**
 * Operaciones de edición del tablero (PLAN §5.1, §22.5).
 *
 * Toda operación es pura: `(doc, args, ctx) → BoardEditResult`. El resultado siempre trae el
 * documento, aunque sea inválido, para mostrarlo como vista previa; solo se confirma si `ok`.
 * Una operación es válida cuando **no agrega** violaciones.
 */
import type { IdGen } from '../model/ids';
import type { Id, Point, TextAnnotation } from '../model/types';
import type { BoardDocument, DeviceInstance, TerminalRef, Wire, WireColor, WireGauge } from './model';
import {
  DEFAULT_WIRE_COLOR,
  DEFAULT_WIRE_GAUGE,
  sameTerminal,
  terminalExists,
  terminalPosition,
} from './model';
import { defaultDeviceProps, findTerminal, type DeviceRegistry } from './registry';
import { addedViolations, type Violation } from './validity';
import { autoRoute, bendsOf, normalizeRoute, repairRoute, translateBends, wireRoute } from './wireGeometry';

export interface OpContext {
  readonly ids: IdGen;
  readonly registry: DeviceRegistry;
}

export type BoardEditFailure = 'INVALID' | 'NOT_FOUND' | 'INVALID_INPUT';

export interface BoardEditResult {
  readonly doc: BoardDocument;
  readonly ok: boolean;
  readonly violations: readonly Violation[];
  readonly reason?: BoardEditFailure;
}

function finalize(before: BoardDocument, next: BoardDocument, ctx: OpContext): BoardEditResult {
  const violations = addedViolations(before, next, ctx.registry);
  return violations.length === 0
    ? { doc: next, ok: true, violations }
    : { doc: next, ok: false, violations, reason: 'INVALID' };
}

const rejected = (doc: BoardDocument, reason: BoardEditFailure): BoardEditResult => ({
  doc,
  ok: false,
  violations: [],
  reason,
});

// ── Aparatos ─────────────────────────────────────────────────────────────────────────────────

export interface PlaceDeviceArgs {
  readonly type: string;
  readonly position: Point;
  readonly props?: Readonly<Record<string, unknown>>;
}

export function placeDevice(doc: BoardDocument, args: PlaceDeviceArgs, ctx: OpContext): BoardEditResult {
  const def = ctx.registry.get(args.type);
  if (!def) return rejected(doc, 'INVALID_INPUT');
  const id = ctx.ids.next('d');
  const device: DeviceInstance = {
    id,
    type: args.type,
    position: args.position,
    props: { ...defaultDeviceProps(def), ...(args.props ?? {}) },
  };
  return finalize(doc, { ...doc, devices: { ...doc.devices, [id]: device } }, ctx);
}

export interface MoveArgs {
  readonly devices: readonly Id[];
  readonly annotations?: readonly Id[];
  readonly delta: Point;
}

/**
 * Mueve aparatos (y textos) reacomodando sus cables: si los dos extremos se mueven, el cable viaja
 * entero; si se mueve uno solo, los codos vecinos se estiran [R2 §2, R5 §4].
 */
export function moveSelection(doc: BoardDocument, args: MoveArgs, ctx: OpContext): BoardEditResult {
  const moved = new Set(args.devices);
  for (const id of moved) if (!doc.devices[id]) return rejected(doc, 'NOT_FOUND');
  const { x: dx, y: dy } = args.delta;

  const devices: Record<Id, DeviceInstance> = { ...doc.devices };
  for (const id of moved) {
    const device = doc.devices[id]!;
    devices[id] = { ...device, position: { x: device.position.x + dx, y: device.position.y + dy } };
  }

  const annotations: Record<Id, TextAnnotation> = { ...doc.annotations };
  for (const id of args.annotations ?? []) {
    const note = doc.annotations[id];
    if (!note) return rejected(doc, 'NOT_FOUND');
    annotations[id] = { ...note, position: { x: note.position.x + dx, y: note.position.y + dy } };
  }

  const withDevices: BoardDocument = { ...doc, devices, annotations };
  const wires: Record<Id, Wire> = { ...doc.wires };
  for (const wire of Object.values(doc.wires)) {
    const movedA = moved.has(wire.a.deviceId);
    const movedB = moved.has(wire.b.deviceId);
    if (!movedA && !movedB) continue;
    if (movedA && movedB) {
      wires[wire.id] = { ...wire, bends: translateBends(wire.bends, dx, dy) };
      continue;
    }
    const route = wireRoute(doc, ctx.registry, wire);
    const a = terminalPosition(withDevices, ctx.registry, wire.a);
    const b = terminalPosition(withDevices, ctx.registry, wire.b);
    wires[wire.id] = { ...wire, bends: repairRoute(route, a, b, dirOf(withDevices, ctx, wire.a), dirOf(withDevices, ctx, wire.b)).slice(1, -1) };
  }

  return finalize(doc, { ...withDevices, wires }, ctx);
}

function dirOf(doc: BoardDocument, ctx: OpContext, ref: TerminalRef): 'N' | 'E' | 'S' | 'W' {
  const device = doc.devices[ref.deviceId]!;
  const def = ctx.registry.require(device.type);
  return findTerminal(def, ref.terminalId)?.dir ?? 'N';
}

export interface SetPropsArgs {
  readonly deviceId: Id;
  readonly props: Readonly<Record<string, unknown>>;
}

export function setDeviceProps(doc: BoardDocument, args: SetPropsArgs, ctx: OpContext): BoardEditResult {
  const device = doc.devices[args.deviceId];
  if (!device) return rejected(doc, 'NOT_FOUND');
  const next: BoardDocument = {
    ...doc,
    devices: { ...doc.devices, [device.id]: { ...device, props: { ...device.props, ...args.props } } },
  };
  return finalize(doc, next, ctx);
}

// ── Cables ───────────────────────────────────────────────────────────────────────────────────

export interface ConnectArgs {
  readonly a: TerminalRef;
  readonly b: TerminalRef;
  /** Codos dibujados por el usuario. Sin ellos se usa la ruta automática. */
  readonly bends?: readonly Point[];
  readonly color?: WireColor;
  readonly gauge?: WireGauge;
}

/** Un cable nuevo entre dos bornes [R5 §4]. */
export function connect(doc: BoardDocument, args: ConnectArgs, ctx: OpContext): BoardEditResult {
  if (sameTerminal(args.a, args.b)) return rejected(doc, 'INVALID_INPUT');
  if (!terminalExists(doc, ctx.registry, args.a) || !terminalExists(doc, ctx.registry, args.b)) {
    return rejected(doc, 'NOT_FOUND');
  }
  const duplicated = Object.values(doc.wires).some(
    (w) =>
      (sameTerminal(w.a, args.a) && sameTerminal(w.b, args.b)) ||
      (sameTerminal(w.a, args.b) && sameTerminal(w.b, args.a)),
  );
  if (duplicated) return rejected(doc, 'INVALID_INPUT');

  const from = terminalPosition(doc, ctx.registry, args.a);
  const to = terminalPosition(doc, ctx.registry, args.b);
  const route = args.bends
    ? normalizeRoute([from, ...args.bends, to])
    : autoRoute(from, dirOf(doc, ctx, args.a), to, dirOf(doc, ctx, args.b));
  const id = ctx.ids.next('w');
  const wire: Wire = {
    id,
    a: args.a,
    b: args.b,
    bends: route.slice(1, -1),
    color: args.color ?? DEFAULT_WIRE_COLOR,
    gauge: args.gauge ?? DEFAULT_WIRE_GAUGE,
  };
  return finalize(doc, { ...doc, wires: { ...doc.wires, [id]: wire } }, ctx);
}

export interface SetWireStyleArgs {
  readonly wireIds: readonly Id[];
  readonly color?: WireColor;
  readonly gauge?: WireGauge;
}

/** Color y calibre del cable [R5 §3, §5]. */
export function setWireStyle(doc: BoardDocument, args: SetWireStyleArgs, ctx: OpContext): BoardEditResult {
  const wires: Record<Id, Wire> = { ...doc.wires };
  for (const id of args.wireIds) {
    const wire = doc.wires[id];
    if (!wire) return rejected(doc, 'NOT_FOUND');
    wires[id] = {
      ...wire,
      ...(args.color ? { color: args.color } : {}),
      ...(args.gauge ? { gauge: args.gauge } : {}),
    };
  }
  return finalize(doc, { ...doc, wires }, ctx);
}

export interface MoveWireSegmentArgs {
  readonly wireId: Id;
  /** Índice del tramo dentro de la ruta (0 es el que sale del borne A). */
  readonly segmentIndex: number;
  readonly delta: Point;
}

/** Mueve un tramo en perpendicular; los vecinos se estiran o generan codos [R2 §3]. */
export function moveWireSegment(doc: BoardDocument, args: MoveWireSegmentArgs, ctx: OpContext): BoardEditResult {
  const wire = doc.wires[args.wireId];
  if (!wire) return rejected(doc, 'NOT_FOUND');
  const route = wireRoute(doc, ctx.registry, wire);
  const i = args.segmentIndex;
  if (i < 0 || i + 1 >= route.length) return rejected(doc, 'INVALID_INPUT');

  const p = route[i]!;
  const q = route[i + 1]!;
  const vertical = p.x === q.x;
  const shift = vertical ? { x: args.delta.x, y: 0 } : { x: 0, y: args.delta.y };
  if (shift.x === 0 && shift.y === 0) return rejected(doc, 'INVALID_INPUT');

  const moved = [
    { x: p.x + shift.x, y: p.y + shift.y },
    { x: q.x + shift.x, y: q.y + shift.y },
  ];
  const head = route.slice(0, i);
  const tail = route.slice(i + 2);
  const next = normalizeRoute([
    ...(head.length > 0 ? head : [route[0]!]),
    ...moved,
    ...(tail.length > 0 ? tail : [route[route.length - 1]!]),
  ]);
  const wires = { ...doc.wires, [wire.id]: { ...wire, bends: next.slice(1, -1) } };
  return finalize(doc, { ...doc, wires }, ctx);
}

/** Ajusta los codos de un cable tal como quedaron en pantalla. */
export function setWireBends(doc: BoardDocument, wireId: Id, bends: readonly Point[], ctx: OpContext): BoardEditResult {
  const wire = doc.wires[wireId];
  if (!wire) return rejected(doc, 'NOT_FOUND');
  const from = terminalPosition(doc, ctx.registry, wire.a);
  const to = terminalPosition(doc, ctx.registry, wire.b);
  const route = normalizeRoute([from, ...bends, to]);
  const wires = { ...doc.wires, [wireId]: { ...wire, bends: route.slice(1, -1) } };
  return finalize(doc, { ...doc, wires }, ctx);
}

// ── Borrado ──────────────────────────────────────────────────────────────────────────────────

export interface DeleteArgs {
  readonly devices?: readonly Id[];
  readonly wires?: readonly Id[];
  readonly annotations?: readonly Id[];
}

/** Borrar un aparato borra también los cables que llegan a sus bornes [R5 §4]. */
export function remove(doc: BoardDocument, args: DeleteArgs, ctx: OpContext): BoardEditResult {
  const deviceIds = new Set(args.devices ?? []);
  const wireIds = new Set(args.wires ?? []);
  const annotationIds = new Set(args.annotations ?? []);
  if (deviceIds.size === 0 && wireIds.size === 0 && annotationIds.size === 0) {
    return rejected(doc, 'INVALID_INPUT');
  }

  const devices: Record<Id, DeviceInstance> = {};
  for (const [id, device] of Object.entries(doc.devices)) if (!deviceIds.has(id)) devices[id] = device;
  const wires: Record<Id, Wire> = {};
  for (const [id, wire] of Object.entries(doc.wires)) {
    if (wireIds.has(id) || deviceIds.has(wire.a.deviceId) || deviceIds.has(wire.b.deviceId)) continue;
    wires[id] = wire;
  }
  const annotations: Record<Id, TextAnnotation> = {};
  for (const [id, note] of Object.entries(doc.annotations)) if (!annotationIds.has(id)) annotations[id] = note;

  return finalize(doc, { ...doc, devices, wires, annotations }, ctx);
}

// ── Anotaciones ──────────────────────────────────────────────────────────────────────────────

export function addAnnotation(doc: BoardDocument, position: Point, text: string, ctx: OpContext): BoardEditResult {
  const id = ctx.ids.next('n');
  const note: TextAnnotation = { id, position, text };
  return finalize(doc, { ...doc, annotations: { ...doc.annotations, [id]: note } }, ctx);
}

export function setAnnotationText(doc: BoardDocument, id: Id, text: string, ctx: OpContext): BoardEditResult {
  const note = doc.annotations[id];
  if (!note) return rejected(doc, 'NOT_FOUND');
  return finalize(doc, { ...doc, annotations: { ...doc.annotations, [id]: { ...note, text } } }, ctx);
}

/** Codos de un cable ya normalizados, para comparar en los tests. */
export const wireBends = (doc: BoardDocument, registry: DeviceRegistry, id: Id): readonly Point[] =>
  bendsOf(wireRoute(doc, registry, doc.wires[id]!));
