/**
 * Archivo del tablero: JSON legible y versionado (esquema v2).
 *
 * Los archivos de la versión clásica (esquema v1) **no se abren** [R5 §15]: se detectan y se
 * informan con un código propio, sin intentar migrarlos.
 */
import { z } from 'zod';
import { compareIds } from '../model/ids';
import type { BoardDocument, DeviceInstance, Wire } from './model';
import { BOARD_SCHEMA_VERSION, terminalExists, terminalOf, toFree, toTerminal, type WireEnd } from './model';
import type { DeviceRegistry } from './registry';
import { isOrthogonalRoute, wireRoute } from './wireGeometry';
import { WIRE_COLORS, WIRE_GAUGES } from './model';

const IntPoint = z
  .object({ x: z.number().int(), y: z.number().int() })
  .strict();

const FileDevice = z
  .object({
    type: z.string().min(1),
    position: IntPoint,
    // Los archivos anteriores al giro no la traen: sin girar.
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
    props: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const TerminalReference = z
  .object({ deviceId: z.string().min(1), terminalId: z.string().min(1) })
  .strict();

/** Punta del cable: un borne o un punto suelto. La forma vieja (solo el borne) se sigue leyendo. */
const FileWireEnd = z.union([
  z.object({ kind: z.literal('terminal'), ref: TerminalReference }).strict(),
  z.object({ kind: z.literal('free'), at: IntPoint }).strict(),
  TerminalReference,
]);

const FileWire = z
  .object({
    a: FileWireEnd,
    b: FileWireEnd,
    bends: z.array(IntPoint).default([]),
    color: z.enum(WIRE_COLORS),
    gauge: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();

const FileAnnotation = z.object({ position: IntPoint, text: z.string() }).strict();

export const FileBoardV2 = z
  .object({
    schemaVersion: z.literal(BOARD_SCHEMA_VERSION),
    metadata: z
      .object({ name: z.string(), createdAt: z.string(), modifiedAt: z.string() })
      .strict(),
    devices: z.record(z.string(), FileDevice),
    wires: z.record(z.string(), FileWire).default({}),
    annotations: z.record(z.string(), FileAnnotation).default({}),
    view: z
      .object({ pan: z.object({ x: z.number(), y: z.number() }).strict(), zoom: z.number().positive() })
      .strict()
      .optional(),
  })
  .strict();

type FileEnd = z.infer<typeof FileWireEnd>;

const readEnd = (end: FileEnd): WireEnd => {
  if ('kind' in end) return end.kind === 'free' ? toFree(end.at) : toTerminal(end.ref);
  return toTerminal(end);
};

/** Serializa a JSON legible, con claves ordenadas por id (diffs estables). */
export function serializeBoard(doc: BoardDocument): string {
  const sorted = <T>(record: Readonly<Record<string, T>>, strip: (v: T) => unknown): Record<string, unknown> =>
    Object.fromEntries(
      Object.keys(record)
        .sort(compareIds)
        .map((id) => [id, strip(record[id]!)]),
    );

  const file = {
    schemaVersion: doc.schemaVersion,
    metadata: doc.metadata,
    devices: sorted(doc.devices, ({ id: _id, ...rest }: DeviceInstance) => rest),
    wires: sorted(doc.wires, ({ id: _id, ...rest }: Wire) => rest),
    annotations: sorted(doc.annotations, ({ id: _id, ...rest }) => rest),
    ...(doc.view ? { view: doc.view } : {}),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export type BoardLoadErrorCode =
  | 'INVALID_JSON'
  | 'NOT_OBJECT'
  | 'NO_VERSION'
  | 'CLASSIC_FILE'
  | 'FUTURE_VERSION'
  | 'SCHEMA'
  | 'UNKNOWN_TYPE'
  | 'UNKNOWN_TERMINAL'
  | 'NOT_ORTHOGONAL';

export interface BoardLoadError {
  readonly code: BoardLoadErrorCode;
  readonly detail?: string;
}

export type BoardLoadResult =
  | { readonly ok: true; readonly doc: BoardDocument }
  | { readonly ok: false; readonly error: BoardLoadError };

export function parseBoard(text: string, registry: DeviceRegistry): BoardLoadResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: { code: 'INVALID_JSON', detail: String(error) } };
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { ok: false, error: { code: 'NOT_OBJECT' } };
  }
  const version = (json as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'number') return { ok: false, error: { code: 'NO_VERSION' } };
  if (version < BOARD_SCHEMA_VERSION) return { ok: false, error: { code: 'CLASSIC_FILE' } };
  if (version > BOARD_SCHEMA_VERSION) return { ok: false, error: { code: 'FUTURE_VERSION' } };

  const parsed = FileBoardV2.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: { code: 'SCHEMA', detail: parsed.error.issues[0]?.message } };
  }

  const file = parsed.data;
  const devices: Record<string, DeviceInstance> = {};
  for (const [id, device] of Object.entries(file.devices)) {
    if (!registry.get(device.type)) {
      return { ok: false, error: { code: 'UNKNOWN_TYPE', detail: device.type } };
    }
    devices[id] = { id, type: device.type, position: device.position, rotation: device.rotation, props: device.props };
  }

  const doc: BoardDocument = {
    schemaVersion: BOARD_SCHEMA_VERSION,
    metadata: file.metadata,
    devices,
    wires: Object.fromEntries(
      Object.entries(file.wires).map(([id, wire]) => [
        id,
        {
          id,
          a: readEnd(wire.a),
          b: readEnd(wire.b),
          bends: wire.bends,
          color: wire.color,
          gauge: wire.gauge,
        },
      ]),
    ),
    annotations: Object.fromEntries(
      Object.entries(file.annotations).map(([id, note]) => [id, { id, position: note.position, text: note.text }]),
    ),
    ...(file.view ? { view: file.view } : {}),
  };

  for (const wire of Object.values(doc.wires)) {
    for (const end of [wire.a, wire.b]) {
      const ref = terminalOf(end);
      if (ref && !terminalExists(doc, registry, ref)) {
        return { ok: false, error: { code: 'UNKNOWN_TERMINAL', detail: `${ref.deviceId}.${ref.terminalId}` } };
      }
    }
    if (!isOrthogonalRoute(wireRoute(doc, registry, wire))) {
      return { ok: false, error: { code: 'NOT_ORTHOGONAL', detail: wire.id } };
    }
  }

  return { ok: true, doc };
}

/** Calibres válidos, expuestos para la interfaz y las pruebas. */
export const GAUGES = WIRE_GAUGES;
