import { SCHEMA_VERSION } from '../model/types';

/**
 * Migraciones en cadena (PLAN §14.1): `migrations[n]` transforma un documento de la versión n a la
 * n+1. Cuando exista la versión 2, se agrega `1: (doc) => …` y un fixture v1 en los tests.
 */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export type MigrationResult =
  | { ok: true; raw: Record<string, unknown>; fromVersion: number }
  | { ok: false; error: { code: 'NOT_OBJECT' | 'NO_VERSION' | 'FUTURE_VERSION' | 'MISSING_MIGRATION'; version?: number } };

export function migrate(
  input: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): MigrationResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: { code: 'NOT_OBJECT' } };
  }
  let raw = input as Record<string, unknown>;
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return { ok: false, error: { code: 'NO_VERSION' } };
  }
  if (version > target) return { ok: false, error: { code: 'FUTURE_VERSION', version } };

  for (let v = version; v < target; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, error: { code: 'MISSING_MIGRATION', version: v } };
    raw = { ...step(raw), schemaVersion: v + 1 };
  }
  return { ok: true, raw, fromVersion: version };
}
