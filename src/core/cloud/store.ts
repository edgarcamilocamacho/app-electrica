/**
 * Almacenamiento de los tableros, sin reglas: las reglas están en `CloudService`.
 *
 * Es síncrono a propósito: `node:sqlite` lo es, y así cada operación del servicio corre entera
 * dentro de una transacción. El servidor usa SQLite; las pruebas y el modo E2E, `MemoryDocStore`.
 */
import type { Lease } from './lease';
import { nameKey, utf8Length } from './names';

export interface DocMeta {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly updatedBy: string | null;
  readonly deletedAt: number | null;
  readonly lease: Lease | null;
  /** Bytes UTF-8 del contenido. */
  readonly size: number;
}

export interface DocRecord extends DocMeta {
  readonly content: string;
}

export type DocPatch = Partial<Omit<DocRecord, 'id' | 'size'>>;

export interface DocStore {
  /** Corre `fn` de forma atómica: si lanza, no queda ningún cambio. */
  transaction<T>(fn: () => T): T;
  get(id: string): DocRecord | undefined;
  getMeta(id: string): DocMeta | undefined;
  /** Activos (`deleted: false`) o en la papelera (`deleted: true`), sin contenido. */
  list(deleted: boolean): readonly DocMeta[];
  insert(record: Omit<DocRecord, 'size'>): void;
  update(id: string, patch: DocPatch): void;
  remove(id: string): void;
  /** ¿Hay un tablero activo, distinto de `exceptId`, con esta clave de nombre? */
  nameTaken(key: string, exceptId?: string): boolean;
  totals(): { readonly count: number; readonly bytes: number };
  /** Ids en la papelera desde antes de `before`. */
  trashedBefore(before: number): readonly string[];
}

/** Almacenamiento en memoria, con las mismas garantías que el de SQLite. */
export class MemoryDocStore implements DocStore {
  private docs = new Map<string, DocRecord>();

  transaction<T>(fn: () => T): T {
    const snapshot = new Map(this.docs);
    try {
      return fn();
    } catch (error) {
      this.docs = snapshot;
      throw error;
    }
  }

  get(id: string): DocRecord | undefined {
    return this.docs.get(id);
  }

  getMeta(id: string): DocMeta | undefined {
    const doc = this.docs.get(id);
    if (!doc) return undefined;
    const { content: _content, ...meta } = doc;
    return meta;
  }

  list(deleted: boolean): readonly DocMeta[] {
    return [...this.docs.values()]
      .filter((doc) => (doc.deletedAt !== null) === deleted)
      .map(({ content: _content, ...meta }) => meta);
  }

  insert(record: Omit<DocRecord, 'size'>): void {
    if (this.docs.has(record.id)) throw new Error(`duplicate id ${record.id}`);
    this.docs.set(record.id, { ...record, size: utf8Length(record.content) });
  }

  update(id: string, patch: DocPatch): void {
    const doc = this.docs.get(id);
    if (!doc) return;
    const next = { ...doc, ...patch };
    this.docs.set(id, { ...next, size: patch.content !== undefined ? utf8Length(patch.content) : doc.size });
  }

  remove(id: string): void {
    this.docs.delete(id);
  }

  nameTaken(key: string, exceptId?: string): boolean {
    for (const doc of this.docs.values()) {
      if (doc.deletedAt === null && doc.id !== exceptId && nameKey(doc.name) === key) return true;
    }
    return false;
  }

  totals(): { count: number; bytes: number } {
    let bytes = 0;
    for (const doc of this.docs.values()) bytes += doc.size;
    return { count: this.docs.size, bytes };
  }

  trashedBefore(before: number): readonly string[] {
    return [...this.docs.values()].filter((doc) => doc.deletedAt !== null && doc.deletedAt < before).map((doc) => doc.id);
  }
}
