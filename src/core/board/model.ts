/**
 * Modelo del documento de tablero (PLAN §22.2).
 *
 * Dos diferencias de fondo con el modelo clásico:
 * - Un **aparato** trae sus bornes y su esquema adentro [R5 §1]; se coloca en una posición y, si
 *   hace falta, girado en pasos de 90° [R5 §19].
 * - Un **cable** une exactamente dos bornes, con codos propios: no hay vértices compartidos,
 *   empalmes ni extremos libres [R5 §4].
 *
 * Serializable, plano, sin estado de runtime. Coordenadas en unidades de grid enteras;
 * y crece hacia abajo.
 */
import type { Dir, DocumentMetadata, Id, Point, Rotation, TextAnnotation, ViewState } from '../model/types';
import { add, rectFromPoints, rotateDir, rotateOffset, type Rect } from '../model/geometry';
import type { DeviceDefinition, DeviceRegistry, TerminalDef } from './registry';

/** Un borne concreto de un aparato colocado. */
export interface TerminalRef {
  readonly deviceId: Id;
  readonly terminalId: string;
}

export interface DeviceInstance {
  readonly id: Id;
  readonly type: string;
  readonly position: Point;
  /** Giro del aparato, en pasos de 90° [R5 §19]. */
  readonly rotation: Rotation;
  readonly props: Readonly<Record<string, unknown>>;
}

/** Colores de cable disponibles [R5 §3]. La app los traduce y les asigna su tono. */
export const WIRE_COLORS = ['red', 'black', 'blue', 'green', 'yellow', 'white', 'brown', 'grey'] as const;
export type WireColor = (typeof WIRE_COLORS)[number];

/** Tres calibres [R5 §5]: 1 delgado, 2 medio, 3 grueso. */
export const WIRE_GAUGES = [1, 2, 3] as const;
export type WireGauge = (typeof WIRE_GAUGES)[number];

export const DEFAULT_WIRE_COLOR: WireColor = 'red';
export const DEFAULT_WIRE_GAUGE: WireGauge = 1;

/**
 * Punta de un cable: un borne o, mientras se arma el tablero, un punto suelto. La punta suelta es
 * válida para poder cablear con libertad, pero queda marcada como error hasta conectarla [R5 §17].
 */
export type WireEnd =
  | { readonly kind: 'terminal'; readonly ref: TerminalRef }
  | { readonly kind: 'free'; readonly at: Point };

export const toTerminal = (ref: TerminalRef): WireEnd => ({ kind: 'terminal', ref });
export const toFree = (at: Point): WireEnd => ({ kind: 'free', at });
export const terminalOf = (end: WireEnd): TerminalRef | undefined =>
  end.kind === 'terminal' ? end.ref : undefined;

export interface Wire {
  readonly id: Id;
  readonly a: WireEnd;
  readonly b: WireEnd;
  /** Codos intermedios; la ruta completa es borne A → codos → borne B, siempre ortogonal. */
  readonly bends: readonly Point[];
  readonly color: WireColor;
  readonly gauge: WireGauge;
}

export const BOARD_SCHEMA_VERSION = 2 as const;

export interface BoardDocument {
  readonly schemaVersion: typeof BOARD_SCHEMA_VERSION;
  readonly metadata: DocumentMetadata;
  readonly devices: Readonly<Record<Id, DeviceInstance>>;
  readonly wires: Readonly<Record<Id, Wire>>;
  readonly annotations: Readonly<Record<Id, TextAnnotation>>;
  readonly view?: ViewState;
}

export const terminalKey = (ref: TerminalRef): string => `${ref.deviceId}.${ref.terminalId}`;

export const sameTerminal = (a: TerminalRef, b: TerminalRef): boolean =>
  a.deviceId === b.deviceId && a.terminalId === b.terminalId;

export function emptyBoard(metadata: DocumentMetadata, view?: ViewState): BoardDocument {
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    metadata,
    devices: {},
    wires: {},
    annotations: {},
    ...(view ? { view } : {}),
  };
}

export function deviceDef(doc: BoardDocument, registry: DeviceRegistry, id: Id): DeviceDefinition {
  const device = doc.devices[id];
  if (!device) throw new Error(`Aparato inexistente: ${id}`);
  return registry.require(device.type);
}

/** Posición de una punta de cable: la del borne, o el punto suelto. */
export function endPosition(doc: BoardDocument, registry: DeviceRegistry, end: WireEnd): Point {
  return end.kind === 'free' ? end.at : terminalPosition(doc, registry, end.ref);
}

export const sameEnd = (a: WireEnd, b: WireEnd): boolean =>
  a.kind === 'free' || b.kind === 'free'
    ? a.kind === 'free' && b.kind === 'free' && a.at.x === b.at.x && a.at.y === b.at.y
    : sameTerminal(a.ref, b.ref);

/** Desplazamiento de un borne ya girado según el aparato. */
export const terminalOffset = (device: DeviceInstance, terminal: TerminalDef): Point =>
  rotateOffset(terminal.offset, device.rotation);

/** Hacia dónde sale el cable de un borne, ya girado. */
export const terminalDir = (device: DeviceInstance, terminal: TerminalDef): Dir =>
  rotateDir(terminal.dir, device.rotation);

/** Posición absoluta de un borne. */
export function terminalPosition(doc: BoardDocument, registry: DeviceRegistry, ref: TerminalRef): Point {
  const device = doc.devices[ref.deviceId];
  if (!device) throw new Error(`Aparato inexistente: ${ref.deviceId}`);
  const def = registry.require(device.type);
  const terminal = def.terminals.find((t) => t.id === ref.terminalId);
  if (!terminal) throw new Error(`Borne inexistente: ${ref.deviceId}.${ref.terminalId}`);
  return add(device.position, terminalOffset(device, terminal));
}

/** Dirección por la que sale el cable de una punta; una punta suelta no impone dirección. */
export function endDir(doc: BoardDocument, registry: DeviceRegistry, end: WireEnd): Dir {
  const ref = terminalOf(end);
  if (!ref) return 'N';
  const device = doc.devices[ref.deviceId];
  const def = device ? registry.get(device.type) : undefined;
  const terminal = def?.terminals.find((t) => t.id === ref.terminalId);
  return device && terminal ? terminalDir(device, terminal) : 'N';
}

/** ¿Existe el aparato y el borne? Útil para validar documentos importados. */
export function terminalExists(doc: BoardDocument, registry: DeviceRegistry, ref: TerminalRef): boolean {
  const device = doc.devices[ref.deviceId];
  if (!device) return false;
  const def = registry.get(device.type);
  return def ? def.terminals.some((t) => t.id === ref.terminalId) : false;
}

/** Caja del cuerpo del aparato en coordenadas absolutas, ya girada. */
export function deviceRect(device: DeviceInstance, def: DeviceDefinition): Rect {
  const { bounds } = def;
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ].map((corner) => add(device.position, rotateOffset(corner, device.rotation)));
  return rectFromPoints(corners)!;
}

/** Caja que abarca el cuerpo y todos los bornes (para selección y exportación). */
export function deviceOuterRect(device: DeviceInstance, def: DeviceDefinition): Rect {
  const body = deviceRect(device, def);
  const terminals = def.terminals.map((t) => add(device.position, terminalOffset(device, t)));
  const withTerminals = rectFromPoints([
    { x: body.minX, y: body.minY },
    { x: body.maxX, y: body.maxY },
    ...terminals,
  ]);
  return withTerminals ?? body;
}

/** Todos los bornes de un aparato colocado, con su posición absoluta. */
export function deviceTerminals(
  device: DeviceInstance,
  def: DeviceDefinition,
): readonly { readonly ref: TerminalRef; readonly position: Point }[] {
  return def.terminals.map((t) => ({
    ref: { deviceId: device.id, terminalId: t.id },
    position: add(device.position, terminalOffset(device, t)),
  }));
}

/** Cables que llegan a un aparato. */
export function wiresOfDevice(doc: BoardDocument, deviceId: Id): readonly Wire[] {
  return Object.values(doc.wires).filter(
    (w) => terminalOf(w.a)?.deviceId === deviceId || terminalOf(w.b)?.deviceId === deviceId,
  );
}

/** Cuántos cables llegan a cada borne: el número que se dibuja junto al tornillo [R5 §6]. */
export function wireCountByTerminal(doc: BoardDocument): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const wire of Object.values(doc.wires)) {
    for (const end of [wire.a, wire.b]) {
      const ref = terminalOf(end);
      if (!ref) continue;
      const key = terminalKey(ref);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}
