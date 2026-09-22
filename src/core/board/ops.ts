/**
 * Operaciones de edición del tablero (PLAN §5.1, §22.5).
 *
 * Toda operación es pura: `(doc, args, ctx) → BoardEditResult`. El resultado siempre trae el
 * documento, aunque sea inválido, para mostrarlo como vista previa; solo se confirma si `ok`.
 * Una operación es válida cuando **no agrega** violaciones.
 */
import type { IdGen } from '../model/ids';
import type { Id, Point, TextAnnotation } from '../model/types';
import type { BoardDocument, DeviceInstance, Wire, WireColor, WireEnd, WireGauge } from './model';
import {
  DEFAULT_WIRE_COLOR,
  DEFAULT_WIRE_GAUGE,
  endPosition,
  sameEnd,
  terminalExists,
  terminalOf,
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
    const movedA = isMoved(wire.a, moved);
    const movedB = isMoved(wire.b, moved);
    if (!movedA && !movedB) continue;
    if (movedA && movedB) {
      wires[wire.id] = { ...wire, bends: translateBends(wire.bends, dx, dy) };
      continue;
    }
    const route = wireRoute(doc, ctx.registry, wire);
    const a = endPosition(withDevices, ctx.registry, wire.a);
    const b = endPosition(withDevices, ctx.registry, wire.b);
    wires[wire.id] = {
      ...wire,
      bends: repairRoute(route, a, b, dirOf(withDevices, ctx, wire.a), dirOf(withDevices, ctx, wire.b)).slice(1, -1),
    };
  }

  return finalize(doc, { ...withDevices, wires }, ctx);
}

const isMoved = (end: WireEnd, moved: ReadonlySet<Id>): boolean => {
  const ref = terminalOf(end);
  return ref ? moved.has(ref.deviceId) : false;
};

/** Dirección por la que sale el cable de una punta; una punta suelta no impone dirección. */
function dirOf(doc: BoardDocument, ctx: OpContext, end: WireEnd): 'N' | 'E' | 'S' | 'W' {
  const ref = terminalOf(end);
  if (!ref) return 'N';
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
  readonly a: WireEnd;
  readonly b: WireEnd;
  /** Codos dibujados por el usuario. Sin ellos se usa la ruta automática. */
  readonly bends?: readonly Point[];
  readonly color?: WireColor;
  readonly gauge?: WireGauge;
}

/**
 * Un cable nuevo. Cada punta puede ser un borne o quedar suelta: así se puede cablear con libertad
 * y la punta suelta se marca como error hasta conectarla [R5 §4, §17].
 */
export function connect(doc: BoardDocument, args: ConnectArgs, ctx: OpContext): BoardEditResult {
  if (sameEnd(args.a, args.b)) return rejected(doc, 'INVALID_INPUT');
  for (const end of [args.a, args.b]) {
    const ref = terminalOf(end);
    if (ref && !terminalExists(doc, ctx.registry, ref)) return rejected(doc, 'NOT_FOUND');
  }
  const duplicated = Object.values(doc.wires).some(
    (w) => (sameEnd(w.a, args.a) && sameEnd(w.b, args.b)) || (sameEnd(w.a, args.b) && sameEnd(w.b, args.a)),
  );
  if (duplicated) return rejected(doc, 'INVALID_INPUT');

  const from = endPosition(doc, ctx.registry, args.a);
  const to = endPosition(doc, ctx.registry, args.b);
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
  const from = endPosition(doc, ctx.registry, wire.a);
  const to = endPosition(doc, ctx.registry, wire.b);
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
    if (wireIds.has(id) || isMoved(wire.a, deviceIds) || isMoved(wire.b, deviceIds)) continue;
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

// ── Copiar y pegar ───────────────────────────────────────────────────────────────────────────

export interface BoardClip {
  readonly devices: readonly DeviceInstance[];
  /** Solo los cables cuyos dos extremos están dentro de lo copiado. */
  readonly wires: readonly Wire[];
  readonly annotations: readonly TextAnnotation[];
}

export interface CopyArgs {
  readonly devices: readonly Id[];
  readonly wires?: readonly Id[];
  readonly annotations?: readonly Id[];
}

/** Recorta del documento lo seleccionado, con su cableado interno [R2 §13]. */
export function copyClip(doc: BoardDocument, args: CopyArgs): BoardClip {
  const devices = args.devices.map((id) => doc.devices[id]).filter((d): d is DeviceInstance => d !== undefined);
  const inside = new Set(devices.map((d) => d.id));
  const insideEnd = (end: WireEnd): boolean => {
    const ref = terminalOf(end);
    return ref ? inside.has(ref.deviceId) : true;
  };
  const wires = Object.values(doc.wires).filter((w) => insideEnd(w.a) && insideEnd(w.b) && (terminalOf(w.a) || terminalOf(w.b)));
  const annotations = (args.annotations ?? [])
    .map((id) => doc.annotations[id])
    .filter((n): n is TextAnnotation => n !== undefined);
  return { devices, wires, annotations };
}

/** Siguiente etiqueta libre con el mismo prefijo: `K1` → `K2` [I5]. */
function nextRef(doc: BoardDocument, ref: string): string {
  const match = /^([A-Za-zÁÉÍÓÚÑ]+)(\d+)$/.exec(ref);
  if (!match) return ref;
  const [, prefix] = match;
  const used = new Set(
    Object.values(doc.devices)
      .map((d) => (typeof d.props.ref === 'string' ? d.props.ref : ''))
      .filter((r) => r.startsWith(prefix!)),
  );
  for (let n = 1; n < 1000; n += 1) {
    const candidate = `${prefix}${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return ref;
}

export interface PasteResult extends BoardEditResult {
  readonly devices: readonly Id[];
  readonly wires: readonly Id[];
  readonly annotations: readonly Id[];
}

/** Pega lo copiado desplazado, con ids y etiquetas nuevas. */
export function pasteClip(doc: BoardDocument, clip: BoardClip, delta: Point, ctx: OpContext): PasteResult {
  if (clip.devices.length === 0 && clip.annotations.length === 0) {
    return { ...rejected(doc, 'INVALID_INPUT'), devices: [], wires: [], annotations: [] };
  }
  const devices: Record<Id, DeviceInstance> = { ...doc.devices };
  const idMap = new Map<Id, Id>();
  let next = doc;
  for (const device of clip.devices) {
    const id = ctx.ids.next('d');
    idMap.set(device.id, id);
    const ref = typeof device.props.ref === 'string' && device.props.ref ? nextRef(next, device.props.ref) : '';
    const placed: DeviceInstance = {
      id,
      type: device.type,
      position: { x: device.position.x + delta.x, y: device.position.y + delta.y },
      props: { ...device.props, ...(ref ? { ref } : {}) },
    };
    devices[id] = placed;
    next = { ...next, devices };
  }

  const remap = (end: WireEnd): WireEnd => {
    const ref = terminalOf(end);
    if (!ref) return { kind: 'free', at: { x: (end as { at: Point }).at.x + delta.x, y: (end as { at: Point }).at.y + delta.y } };
    const deviceId = idMap.get(ref.deviceId);
    return deviceId ? { kind: 'terminal', ref: { deviceId, terminalId: ref.terminalId } } : end;
  };

  const wires: Record<Id, Wire> = { ...doc.wires };
  const wireIds: Id[] = [];
  for (const wire of clip.wires) {
    const id = ctx.ids.next('w');
    wireIds.push(id);
    wires[id] = { ...wire, id, a: remap(wire.a), b: remap(wire.b), bends: translateBends(wire.bends, delta.x, delta.y) };
  }

  const annotations: Record<Id, TextAnnotation> = { ...doc.annotations };
  const noteIds: Id[] = [];
  for (const note of clip.annotations) {
    const id = ctx.ids.next('n');
    noteIds.push(id);
    annotations[id] = { id, text: note.text, position: { x: note.position.x + delta.x, y: note.position.y + delta.y } };
  }

  const result = finalize(doc, { ...doc, devices, wires, annotations }, ctx);
  return { ...result, devices: [...idMap.values()], wires: wireIds, annotations: noteIds };
}
