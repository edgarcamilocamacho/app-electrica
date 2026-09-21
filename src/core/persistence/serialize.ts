import { compareIds } from '../model/ids';
import { terminalKey, type OpContext } from '../model/document';
import type { CircuitDocument, ComponentInstance, TextAnnotation, WireSegment, WireVertex } from '../model/types';
import { canonicalize } from '../topology/canonicalize';
import { migrate, type Migration, MIGRATIONS } from './migrations';
import { FileDocumentV1 } from './schema';

/** Serializa a JSON legible, con claves ordenadas por id (diffs estables). */
export function serializeDocument(doc: CircuitDocument): string {
  const sorted = <T>(record: Readonly<Record<string, T>>, strip: (v: T) => unknown) =>
    Object.fromEntries(
      Object.keys(record)
        .sort(compareIds)
        .map((id) => [id, strip(record[id]!)]),
    );

  const file = {
    schemaVersion: doc.schemaVersion,
    metadata: doc.metadata,
    components: sorted(doc.components, ({ id: _id, ...rest }: ComponentInstance) => rest),
    vertices: sorted(doc.vertices, ({ id: _id, ...rest }: WireVertex) => rest),
    segments: sorted(doc.segments, ({ id: _id, ...rest }: WireSegment) => rest),
    annotations: sorted(doc.annotations, ({ id: _id, ...rest }: TextAnnotation) => rest),
    ...(doc.view ? { view: doc.view } : {}),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export type LoadErrorCode =
  | 'INVALID_JSON'
  | 'NOT_OBJECT'
  | 'NO_VERSION'
  | 'FUTURE_VERSION'
  | 'MISSING_MIGRATION'
  | 'SCHEMA'
  | 'UNKNOWN_TYPE'
  | 'UNKNOWN_TERMINAL'
  | 'DANGLING_REFERENCE'
  | 'DUPLICATE_TERMINAL_VERTEX';

export interface LoadError {
  readonly code: LoadErrorCode;
  readonly detail?: string;
}

export type LoadResult =
  | { ok: true; doc: CircuitDocument; migratedFrom: number; normalized: boolean }
  | { ok: false; error: LoadError };

/**
 * Carga un documento: parsea, migra, valida el esquema y la consistencia interna, y lo lleva a
 * forma normal. Problemas de ambigüedad geométrica NO impiden cargar: quedan como diagnósticos
 * bloqueantes para que el usuario pueda corregirlos (PLAN §14.1).
 */
export function parseDocument(
  text: string,
  ctx: OpContext,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): LoadResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: { code: 'INVALID_JSON', detail: e instanceof Error ? e.message : String(e) } };
  }
  return loadDocument(json, ctx, migrations);
}

export function loadDocument(
  json: unknown,
  ctx: OpContext,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): LoadResult {
  const migrated = migrate(json, migrations);
  if (!migrated.ok) {
    return { ok: false, error: { code: migrated.error.code, detail: migrated.error.version?.toString() } };
  }

  const parsed = FileDocumentV1.safeParse(migrated.raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: { code: 'SCHEMA', detail: issue ? `${issue.path.join('.')}: ${issue.message}` : undefined } };
  }
  const file = parsed.data;

  const withIds = <T extends object>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).map(([id, v]) => [id, { id, ...v }]));

  const doc: CircuitDocument = {
    schemaVersion: 1,
    metadata: file.metadata,
    components: withIds(file.components) as Record<string, ComponentInstance>,
    vertices: withIds(file.vertices) as Record<string, WireVertex>,
    segments: withIds(file.segments) as Record<string, WireSegment>,
    annotations: withIds(file.annotations) as Record<string, TextAnnotation>,
    ...(file.view ? { view: file.view } : {}),
  };

  const consistency = checkConsistency(doc, ctx);
  if (consistency) return { ok: false, error: consistency };

  const normal = canonicalize(doc, ctx);
  const normalized = serializeDocument(normal) !== serializeDocument(doc);
  return { ok: true, doc: normal, migratedFrom: migrated.fromVersion, normalized };
}

/** Consistencia de referencias internas: lo que haría imposible interpretar el documento. */
function checkConsistency(doc: CircuitDocument, ctx: OpContext): LoadError | undefined {
  for (const c of Object.values(doc.components)) {
    if (!ctx.registry.get(c.type)) return { code: 'UNKNOWN_TYPE', detail: `${c.id}: ${c.type}` };
  }
  const materialized = new Set<string>();
  for (const v of Object.values(doc.vertices)) {
    if (v.kind !== 'terminal') continue;
    const component = doc.components[v.componentId];
    if (!component) return { code: 'DANGLING_REFERENCE', detail: `vértice ${v.id} → componente ${v.componentId}` };
    const def = ctx.registry.require(component.type);
    if (!def.terminals.some((t) => t.id === v.terminalId)) {
      return { code: 'UNKNOWN_TERMINAL', detail: `${component.type}.${v.terminalId}` };
    }
    const key = terminalKey(v.componentId, v.terminalId);
    if (materialized.has(key)) return { code: 'DUPLICATE_TERMINAL_VERTEX', detail: key };
    materialized.add(key);
  }
  for (const s of Object.values(doc.segments)) {
    if (!doc.vertices[s.a] || !doc.vertices[s.b]) {
      return { code: 'DANGLING_REFERENCE', detail: `segmento ${s.id}` };
    }
  }
  return undefined;
}
