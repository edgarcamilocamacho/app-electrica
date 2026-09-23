/**
 * `DocStore` sobre SQLite (`node:sqlite`, incluido en Node: sin dependencias nativas) (PLAN §24.1).
 *
 * El nombre único se garantiza dos veces: el servicio busca uno libre y un índice único parcial
 * sobre los activos impide que dos escrituras dejen el mismo nombre.
 */
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Lease } from '../src/core/cloud/lease';
import { nameKey, utf8Length } from '../src/core/cloud/names';
import type { DocMeta, DocPatch, DocRecord, DocStore } from '../src/core/cloud/store';

const SCHEMA_VERSION = 1;

const MIGRATIONS: readonly string[] = [
  `CREATE TABLE documents (
     id            TEXT PRIMARY KEY,
     name          TEXT NOT NULL,
     name_key      TEXT NOT NULL,
     content       TEXT NOT NULL,
     size          INTEGER NOT NULL,
     version       INTEGER NOT NULL,
     created_at    INTEGER NOT NULL,
     updated_at    INTEGER NOT NULL,
     updated_by    TEXT,
     deleted_at    INTEGER,
     lease_session TEXT,
     lease_name    TEXT,
     lease_seen_at INTEGER
   ) STRICT;
   CREATE UNIQUE INDEX documents_active_name ON documents(name_key) WHERE deleted_at IS NULL;
   CREATE INDEX documents_deleted_at ON documents(deleted_at);`,
];

const META_COLUMNS =
  'id, name, version, created_at, updated_at, updated_by, deleted_at, lease_session, lease_name, lease_seen_at, size';

type Row = Record<string, SQLInputValue>;

const leaseOf = (row: Row): Lease | null =>
  typeof row.lease_session === 'string' && typeof row.lease_seen_at === 'number'
    ? { session: row.lease_session, name: (row.lease_name as string | null) ?? null, seenAt: row.lease_seen_at }
    : null;

const metaOf = (row: Row): DocMeta => ({
  id: row.id as string,
  name: row.name as string,
  version: Number(row.version),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  updatedBy: (row.updated_by as string | null) ?? null,
  deletedAt: row.deleted_at === null ? null : Number(row.deleted_at),
  lease: leaseOf(row),
  size: Number(row.size),
});

export class SqliteDocStore implements DocStore {
  private readonly db: DatabaseSync;
  private depth = 0;

  /** `path` es un archivo o `:memory:`. */
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  private migrate(): void {
    const row = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
    for (let v = row.user_version; v < SCHEMA_VERSION; v += 1) {
      this.transaction(() => {
        this.db.exec(MIGRATIONS[v]!);
        this.db.exec(`PRAGMA user_version = ${v + 1}`);
      });
    }
  }

  transaction<T>(fn: () => T): T {
    if (this.depth > 0) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    this.depth += 1;
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.depth -= 1;
    }
  }

  get(id: string): DocRecord | undefined {
    const row = this.db.prepare(`SELECT ${META_COLUMNS}, content FROM documents WHERE id = ?`).get(id) as Row | undefined;
    return row ? { ...metaOf(row), content: row.content as string } : undefined;
  }

  getMeta(id: string): DocMeta | undefined {
    const row = this.db.prepare(`SELECT ${META_COLUMNS} FROM documents WHERE id = ?`).get(id) as Row | undefined;
    return row ? metaOf(row) : undefined;
  }

  list(deleted: boolean): readonly DocMeta[] {
    const where = deleted ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL';
    return (this.db.prepare(`SELECT ${META_COLUMNS} FROM documents WHERE ${where}`).all() as Row[]).map(metaOf);
  }

  insert(record: Omit<DocRecord, 'size'>): void {
    this.db
      .prepare(
        `INSERT INTO documents (id, name, name_key, content, size, version, created_at, updated_at, updated_by,
           deleted_at, lease_session, lease_name, lease_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.name,
        nameKey(record.name),
        record.content,
        utf8Length(record.content),
        record.version,
        record.createdAt,
        record.updatedAt,
        record.updatedBy,
        record.deletedAt,
        record.lease?.session ?? null,
        record.lease?.name ?? null,
        record.lease?.seenAt ?? null,
      );
  }

  update(id: string, patch: DocPatch): void {
    const sets: string[] = [];
    const values: SQLInputValue[] = [];
    const put = (column: string, value: SQLInputValue): void => {
      sets.push(`${column} = ?`);
      values.push(value);
    };
    if (patch.name !== undefined) {
      put('name', patch.name);
      put('name_key', nameKey(patch.name));
    }
    if (patch.content !== undefined) {
      put('content', patch.content);
      put('size', utf8Length(patch.content));
    }
    if (patch.version !== undefined) put('version', patch.version);
    if (patch.createdAt !== undefined) put('created_at', patch.createdAt);
    if (patch.updatedAt !== undefined) put('updated_at', patch.updatedAt);
    if (patch.updatedBy !== undefined) put('updated_by', patch.updatedBy);
    if (patch.deletedAt !== undefined) put('deleted_at', patch.deletedAt);
    if (patch.lease !== undefined) {
      put('lease_session', patch.lease?.session ?? null);
      put('lease_name', patch.lease?.name ?? null);
      put('lease_seen_at', patch.lease?.seenAt ?? null);
    }
    if (sets.length === 0) return;
    this.db.prepare(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  }

  nameTaken(key: string, exceptId?: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM documents WHERE name_key = ? AND deleted_at IS NULL AND id IS NOT ? LIMIT 1')
      .get(key, exceptId ?? null);
    return row !== undefined;
  }

  totals(): { count: number; bytes: number } {
    const row = this.db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM documents').get() as Row;
    return { count: Number(row.count), bytes: Number(row.bytes) };
  }

  trashedBefore(before: number): readonly string[] {
    return (this.db.prepare('SELECT id FROM documents WHERE deleted_at IS NOT NULL AND deleted_at < ?').all(before) as Row[]).map(
      (row) => row.id as string,
    );
  }

  /**
   * Copia consistente de la base (`VACUUM INTO`), aunque haya escrituras en curso. Guarda las
   * últimas `keep` copias del directorio y borra las más viejas.
   */
  backup(dir: string, stamp: string, keep: number): string {
    mkdirSync(dir, { recursive: true });
    const target = join(dir, `tableros-${stamp}.sqlite`);
    rmSync(target, { force: true });
    this.db.prepare('VACUUM INTO ?').run(target);
    const copies = readdirSync(dir)
      .filter((name) => /^tableros-.*\.sqlite$/.test(name))
      .sort();
    for (const old of copies.slice(0, Math.max(0, copies.length - keep))) rmSync(join(dir, old), { force: true });
    return target;
  }

  close(): void {
    this.db.close();
  }
}
