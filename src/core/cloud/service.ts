/**
 * Reglas de los tableros guardados en el servidor [R6] (PLAN §24): nombres únicos, turno de
 * edición, versiones, papelera y límites.
 *
 * Puro y síncrono sobre un `DocStore`: el servidor lo usa con SQLite y las pruebas y el modo E2E,
 * con el almacenamiento en memoria. Cada método corre entero dentro de una transacción.
 */
import { boardRegistry } from '../board/catalog';
import { parseBoard, serializeBoard } from '../board/persistence';
import type { DeviceRegistry } from '../board/registry';
import { customAlphabet } from 'nanoid';
import { decideLease, editorOf, leaseAlive, leaseHeldBy } from './lease';
import { cleanName, uniqueName, utf8Length } from './names';
import type { DocMeta, DocStore } from './store';
import {
  CLOUD_LIMITS,
  TRASH_RETENTION_MS,
  type CloudErrorCode,
  type CloudLimits,
  type CloudResult,
  type CreateInput,
  type DocFull,
  type DocState,
  type DocSummary,
  type LeaseInput,
  type LeaseResult,
  type SaveInput,
  type SaveResult,
  type TrashSummary,
} from './types';

export interface CloudServiceDeps {
  readonly now: () => number;
  readonly newId?: () => string;
  /** Forma canónica del JSON del tablero, o null si no es un tablero válido. */
  readonly canonicalize?: (content: string) => string | null;
  readonly limits?: Partial<CloudLimits>;
}

const docIdPart = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);
export const newDocId = (): string => `t_${docIdPart()}`;

/** Valida un tablero con el mismo parser que usa la app y lo devuelve en su forma canónica. */
export function canonicalBoard(content: string, registry: DeviceRegistry = boardRegistry): string | null {
  const parsed = parseBoard(content, registry);
  return parsed.ok ? serializeBoard(parsed.doc) : null;
}

const ok = <T>(value: T): CloudResult<T> => ({ ok: true, value });
const fail = <T>(code: CloudErrorCode): CloudResult<T> => ({ ok: false, code });

export class CloudService {
  private readonly now: () => number;
  private readonly newId: () => string;
  private readonly canonicalize: (content: string) => string | null;
  readonly limits: CloudLimits;

  constructor(
    private readonly store: DocStore,
    deps: CloudServiceDeps,
  ) {
    this.now = deps.now;
    this.newId = deps.newId ?? newDocId;
    this.canonicalize = deps.canonicalize ?? ((content) => canonicalBoard(content));
    this.limits = { ...CLOUD_LIMITS, ...deps.limits };
  }

  list(): readonly DocSummary[] {
    const now = this.now();
    return this.store
      .list(false)
      .map((meta) => this.summary(meta, now))
      .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
  }

  trash(): readonly TrashSummary[] {
    const now = this.now();
    return this.store
      .list(true)
      .map((meta) => ({
        ...this.summary(meta, now),
        deletedAt: meta.deletedAt!,
        purgeAt: meta.deletedAt! + TRASH_RETENTION_MS,
      }))
      .sort((a, b) => b.deletedAt - a.deletedAt);
  }

  get(id: string): CloudResult<DocFull> {
    const doc = this.store.get(id);
    if (!doc) return fail('NOT_FOUND');
    return ok({ ...this.summary(doc, this.now()), content: doc.content, deletedAt: doc.deletedAt });
  }

  create(input: CreateInput): CloudResult<DocFull> {
    return this.store.transaction(() => {
      const name = cleanName(input.name, this.limits.maxNameLength);
      if (!name) return fail('INVALID_NAME');
      let content: string;
      if (input.cloneOf !== undefined) {
        const source = this.store.get(input.cloneOf);
        if (!source || source.deletedAt !== null) return fail('NOT_FOUND');
        content = source.content;
      } else if (input.content !== undefined) {
        const checked = this.checkContent(input.content);
        if (!checked.ok) return checked;
        content = checked.value;
      } else {
        return fail('INVALID_INPUT');
      }
      const totals = this.store.totals();
      if (totals.count >= this.limits.maxDocs) return fail('QUOTA');
      if (totals.bytes + utf8Length(content) > this.limits.maxTotalBytes) return fail('QUOTA');

      const now = this.now();
      const id = this.newId();
      this.store.insert({
        id,
        name: this.freeName(name),
        content,
        version: 1,
        createdAt: now,
        updatedAt: now,
        updatedBy: this.editorName(input.by),
        deletedAt: null,
        lease: null,
      });
      return this.get(id);
    });
  }

  save(id: string, input: SaveInput): CloudResult<SaveResult> {
    return this.store.transaction(() => {
      if (!this.validSession(input.session)) return fail('INVALID_INPUT');
      const meta = this.store.getMeta(id);
      if (!meta) return fail('NOT_FOUND');
      if (meta.deletedAt !== null) return fail('IN_TRASH');
      const now = this.now();
      // Con el turno vigente de otra sesión no se guarda nada [R6 §5].
      if (leaseAlive(meta.lease, now) && meta.lease.session !== input.session) return fail('NOT_EDITOR');
      if (input.baseVersion !== meta.version) return fail('STALE');
      const checked = this.checkContent(input.content);
      if (!checked.ok) return checked;
      const bytes = this.store.totals().bytes - meta.size + utf8Length(checked.value);
      if (bytes > this.limits.maxTotalBytes) return fail('QUOTA');

      const by = this.editorName(input.by);
      const version = meta.version + 1;
      this.store.update(id, {
        content: checked.value,
        version,
        updatedAt: now,
        updatedBy: by,
        lease: { session: input.session, name: by, seenAt: now },
      });
      return ok({ version, updatedAt: now });
    });
  }

  rename(id: string, rawName: string): CloudResult<DocSummary> {
    return this.store.transaction(() => {
      const meta = this.store.getMeta(id);
      if (!meta) return fail('NOT_FOUND');
      if (meta.deletedAt !== null) return fail('IN_TRASH');
      const name = cleanName(rawName, this.limits.maxNameLength);
      if (!name) return fail('INVALID_NAME');
      if (name !== meta.name) this.store.update(id, { name: this.freeName(name, id) });
      return ok(this.summary(this.store.getMeta(id)!, this.now()));
    });
  }

  /** A la papelera [R6 §8]. Quien lo estaba editando pierde el turno. */
  remove(id: string): CloudResult<null> {
    return this.store.transaction(() => {
      const meta = this.store.getMeta(id);
      if (!meta) return fail('NOT_FOUND');
      if (meta.deletedAt === null) this.store.update(id, { deletedAt: this.now(), lease: null });
      return ok(null);
    });
  }

  restore(id: string): CloudResult<DocSummary> {
    return this.store.transaction(() => {
      const meta = this.store.getMeta(id);
      if (!meta) return fail('NOT_FOUND');
      // Mientras estuvo en la papelera, otro pudo usar el mismo nombre.
      if (meta.deletedAt !== null) this.store.update(id, { deletedAt: null, name: this.freeName(meta.name, id) });
      return ok(this.summary(this.store.getMeta(id)!, this.now()));
    });
  }

  lease(id: string, input: LeaseInput): CloudResult<LeaseResult> {
    return this.store.transaction(() => {
      if (!this.validSession(input.session)) return fail('INVALID_INPUT');
      const meta = this.store.getMeta(id);
      if (!meta) return fail('NOT_FOUND');
      if (meta.deletedAt !== null) return fail('IN_TRASH');
      const now = this.now();
      const decision = decideLease(meta.lease, { ...input, name: this.editorName(input.name) }, now);
      if (decision.granted) this.store.update(id, { lease: decision.lease });
      return ok({ granted: decision.granted, version: meta.version, editor: editorOf(decision.lease, now) });
    });
  }

  release(id: string, session: string): CloudResult<null> {
    return this.store.transaction(() => {
      const meta = this.store.getMeta(id);
      if (!meta) return fail('NOT_FOUND');
      if (meta.lease?.session === session) this.store.update(id, { lease: null });
      return ok(null);
    });
  }

  state(id: string, session: string): CloudResult<DocState> {
    const meta = this.store.getMeta(id);
    if (!meta) return fail('NOT_FOUND');
    const now = this.now();
    return ok({
      id,
      name: meta.name,
      version: meta.version,
      deletedAt: meta.deletedAt,
      editor: meta.deletedAt === null ? editorOf(meta.lease, now) : null,
      editing: meta.deletedAt === null && leaseHeldBy(meta.lease, session, now),
    });
  }

  /** Elimina lo que lleva más de 30 días en la papelera. Devuelve cuántos borró. */
  purgeTrash(): number {
    return this.store.transaction(() => {
      const expired = this.store.trashedBefore(this.now() - TRASH_RETENTION_MS);
      for (const id of expired) this.store.remove(id);
      return expired.length;
    });
  }

  private summary(meta: DocMeta, now: number): DocSummary {
    return {
      id: meta.id,
      name: meta.name,
      version: meta.version,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      updatedBy: meta.updatedBy,
      editor: meta.deletedAt === null ? editorOf(meta.lease, now) : null,
    };
  }

  private freeName(name: string, exceptId?: string): string {
    return uniqueName(name, (key) => this.store.nameTaken(key, exceptId), this.limits.maxNameLength);
  }

  private checkContent(content: string): CloudResult<string> {
    if (typeof content !== 'string') return fail('INVALID_INPUT');
    if (utf8Length(content) > this.limits.maxContentBytes) return fail('TOO_LARGE');
    const canonical = this.canonicalize(content);
    if (canonical === null) return fail('INVALID_DOCUMENT');
    if (utf8Length(canonical) > this.limits.maxContentBytes) return fail('TOO_LARGE');
    return ok(canonical);
  }

  private editorName(name: string | null): string | null {
    if (name === null) return null;
    return cleanName(name, this.limits.maxEditorNameLength) || null;
  }

  private validSession(session: string): boolean {
    return typeof session === 'string' && /^[A-Za-z0-9_-]{8,}$/.test(session) && session.length <= this.limits.maxSessionLength;
  }
}
