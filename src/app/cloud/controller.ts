/**
 * Sincronización del tablero abierto con el servidor [R6] (PLAN §24.3 y §24.5).
 *
 * - Guardado automático: cada cambio confirmado en la tienda del tablero se sube con antirrebote.
 * - Turno de edición: al abrir se pide; quien edita late; quien mira consulta el estado y recarga
 *   el documento cuando sube la versión. «Editar» toma el turno al instante.
 * - Si a quien edita le toman el turno con cambios sin subir, esos cambios quedan en una copia.
 * - Sin conexión, lo pendiente queda también en el navegador y se sube (o se copia) al volver.
 *
 * La tienda del tablero no sabe nada de esto: el controlador solo carga documentos, la pone en
 * solo lectura y escucha sus cambios.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { BoardDocument } from '../../core/board/model';
import { emptyBoard } from '../../core/board/model';
import { parseBoard, serializeBoard, type BoardLoadErrorCode } from '../../core/board/persistence';
import {
  LEASE_HEARTBEAT_MS,
  VIEWER_POLL_MS,
  type CloudApi,
  type CloudErrorCode,
  type DocFull,
  type DocSummary,
  type EditorInfo,
  type TrashSummary,
} from '../../core/cloud/types';
import { toFileName } from '../../platform/files';
import type { KeyValueStorage } from '../../platform/storage';
import { docOf, type BoardStore } from '../board/store';

export type SaveStatus = 'idle' | 'saved' | 'pending' | 'saving' | 'offline' | 'error';

export type CloudNotice =
  /** Otra persona tomó la edición. */
  | { readonly kind: 'tookOver'; readonly editor: string | null }
  /** Lo que no se alcanzó a guardar quedó en una copia [R6 §10]. */
  | { readonly kind: 'copySaved'; readonly name: string }
  /** El tablero abierto fue a la papelera. */
  | { readonly kind: 'deleted' }
  /** Se subieron cambios que habían quedado pendientes de una sesión anterior. */
  | { readonly kind: 'recovered'; readonly name: string }
  | { readonly kind: 'importFailed'; readonly code: BoardLoadErrorCode | CloudErrorCode }
  | { readonly kind: 'error'; readonly code: CloudErrorCode };

export interface CurrentDoc {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly role: 'editor' | 'viewer';
  /** Quién tiene el turno, si alguien lo tiene. */
  readonly editor: EditorInfo | null;
  readonly deleted: boolean;
}

export interface CloudUiState {
  /** Terminó el primer arranque: hay lista y, si existe alguno, un tablero abierto. */
  readonly ready: boolean;
  /** No se pudo hablar con el servidor al arrancar; se reintenta solo. */
  readonly unreachable: boolean;
  /** Nombre que da la red (Tailscale). Si existe, no hace falta apodo [R6 §6]. */
  readonly identity: string | null;
  readonly nickname: string;
  readonly docs: readonly DocSummary[];
  readonly trash: readonly TrashSummary[];
  readonly current: CurrentDoc | null;
  readonly save: SaveStatus;
  readonly notice: CloudNotice | null;
  readonly sidebarOpen: boolean;
  /** Llegó una versión nueva mientras se simulaba: se carga al detener. */
  readonly remotePending: boolean;
  /** Operaciones en curso (abrir, crear, importar…), para la interfaz y los E2E. */
  readonly busy: number;
}

export type ExampleKey = 'arranque' | 'temporizador' | 'selector' | 'catalogo';

export interface CloudControllerDeps {
  readonly api: CloudApi;
  readonly board: BoardStore;
  readonly storage: KeyValueStorage;
  /** Tablero de ejemplo por clave, recién construido. */
  readonly example: (key: ExampleKey) => BoardDocument;
  /** Nombre para un tablero nuevo, ya traducido. */
  readonly names: { readonly untitled: string; readonly copyOf: (name: string) => string };
  /** Ejemplo con el que se arranca un servidor vacío. */
  readonly initialExample?: ExampleKey;
  readonly session?: string;
  readonly download?: (text: string, fileName: string) => void;
}

const SAVE_DEBOUNCE_MS = 700;
const SAVE_MAX_WAIT_MS = 4000;
const LIST_REFRESH_MS = 10_000;
const RETRY_MAX_MS = 15_000;
/** Lo pendiente de otra pestaña solo se recupera si nadie lo tocó en este tiempo. */
const PENDING_STALE_MS = 30_000;

export const STORAGE_KEYS = {
  lastDoc: 'simulador:ultimo',
  nickname: 'simulador:apodo',
  sidebar: 'simulador:barra',
  pendingPrefix: 'simulador:pendiente:',
} as const;

interface PendingEntry {
  readonly baseVersion: number;
  readonly content: string;
  readonly name: string;
  readonly savedAt: number;
}

export function newSession(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `s_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** El JSON exportado lleva el nombre de la lista, que es el que manda [R6 §4]. */
export function withName(doc: BoardDocument, name: string): BoardDocument {
  return { ...doc, metadata: { ...doc.metadata, name } };
}

export class CloudController {
  readonly ui: StoreApi<CloudUiState>;
  readonly session: string;
  private readonly api: CloudApi;
  private readonly board: BoardStore;
  private readonly storage: KeyValueStorage;

  /** Cargando un documento del servidor: ese cambio no es una edición. */
  private applying = false;
  private dirty = false;
  private saving = false;
  private saveAgain = false;
  private retries = 0;
  private disposed = false;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private listTimer: ReturnType<typeof setInterval> | undefined;
  private startTimer: ReturnType<typeof setTimeout> | undefined;
  private ticking = false;
  private readonly unsubscribe: () => void;
  private readonly cleanups: (() => void)[] = [];

  constructor(private readonly deps: CloudControllerDeps) {
    this.api = deps.api;
    this.board = deps.board;
    this.storage = deps.storage;
    this.session = deps.session ?? newSession();
    this.ui = createStore<CloudUiState>(() => ({
      ready: false,
      unreachable: false,
      identity: null,
      nickname: deps.storage.get(STORAGE_KEYS.nickname) ?? '',
      docs: [],
      trash: [],
      current: null,
      save: 'idle',
      notice: null,
      sidebarOpen: deps.storage.get(STORAGE_KEYS.sidebar) !== '0',
      remotePending: false,
      busy: 0,
    }));

    this.unsubscribe = this.board.subscribe((state, prev) => {
      if (docOf(state) !== docOf(prev) && !this.applying && this.current()?.role === 'editor') this.markDirty();
      // Al detener la simulación se carga lo que llegó mientras tanto.
      if (state.mode === 'edit' && prev.mode !== 'edit' && this.ui.getState().remotePending) void this.pullLatest();
    });
  }

  // ─── Arranque y cierre ────────────────────────────────────────────────────────────────────────

  /** Arranca: identidad, pendientes de otra sesión, lista y el último tablero abierto. */
  async start(): Promise<void> {
    await this.track(async () => {
      const me = await this.api.me();
      if (!me.ok) {
        this.ui.setState({ unreachable: true });
        this.startTimer = setTimeout(() => void this.start(), 3000);
        return;
      }
      this.ui.setState({ unreachable: false, identity: me.value.name });
      await this.recoverPending();
      await this.refreshList();
      const docs = this.ui.getState().docs;
      const last = this.storage.get(STORAGE_KEYS.lastDoc);
      const target = docs.find((d) => d.id === last) ?? docs[0];
      if (target) await this.openDoc(target.id);
      else await this.createFrom(this.deps.example(this.deps.initialExample ?? 'arranque'));
      this.listTimer = setInterval(() => void this.refreshList(), LIST_REFRESH_MS);
      this.ui.setState({ ready: true });
    });
  }

  /** Enchufa los eventos de la página: guardar al ocultarse y soltar el turno al cerrarse. */
  attachToWindow(target: Window): void {
    const onHidden = (): void => {
      if (target.document.visibilityState === 'hidden') {
        this.writePending();
        void this.flush();
      }
    };
    const onPageHide = (): void => {
      this.writePending();
      void this.flush();
      const current = this.current();
      if (current?.role === 'editor') void this.api.release(current.id, this.session);
    };
    const onFocus = (): void => void this.refreshList();
    target.document.addEventListener('visibilitychange', onHidden);
    target.addEventListener('pagehide', onPageHide);
    target.addEventListener('focus', onFocus);
    this.cleanups.push(() => {
      target.document.removeEventListener('visibilitychange', onHidden);
      target.removeEventListener('pagehide', onPageHide);
      target.removeEventListener('focus', onFocus);
    });
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    for (const cleanup of this.cleanups) cleanup();
    this.stopTimers();
    clearTimeout(this.saveTimer);
    clearTimeout(this.maxWaitTimer);
    clearTimeout(this.retryTimer);
    clearInterval(this.listTimer);
    clearTimeout(this.startTimer);
  }

  // ─── Lista ────────────────────────────────────────────────────────────────────────────────────

  async refreshList(): Promise<void> {
    const [docs, trash] = await Promise.all([this.api.list(), this.api.trash()]);
    if (docs.ok) {
      this.ui.setState({ docs: docs.value });
      const current = this.current();
      const mine = current && docs.value.find((d) => d.id === current.id);
      if (mine && mine.name !== current.name) this.setCurrent({ name: mine.name });
    }
    if (trash.ok) this.ui.setState({ trash: trash.value });
  }

  toggleSidebar(open = !this.ui.getState().sidebarOpen): void {
    this.storage.set(STORAGE_KEYS.sidebar, open ? '1' : '0');
    this.ui.setState({ sidebarOpen: open });
  }

  setNickname(raw: string): void {
    const nickname = raw.slice(0, 60);
    if (nickname.trim()) this.storage.set(STORAGE_KEYS.nickname, nickname.trim());
    else this.storage.remove(STORAGE_KEYS.nickname);
    this.ui.setState({ nickname });
    // Que el nombre nuevo se vea enseguida en las otras pestañas.
    if (this.current()?.role === 'editor') void this.heartbeat();
  }

  dismissNotice(): void {
    this.ui.setState({ notice: null });
  }

  // ─── Abrir, crear y demás acciones de la lista ────────────────────────────────────────────────

  open(id: string): Promise<void> {
    return this.track(async () => {
      if (this.current()?.id === id) return;
      await this.openDoc(id);
    });
  }

  createNew(): Promise<boolean> {
    return this.track(() => {
      const now = new Date().toISOString();
      return this.createFrom(emptyBoard({ name: this.deps.names.untitled, createdAt: now, modifiedAt: now }));
    });
  }

  createFromExample(key: ExampleKey): Promise<boolean> {
    return this.track(() => this.createFrom(this.deps.example(key)));
  }

  clone(id: string): Promise<void> {
    return this.track(async () => {
      const source = this.ui.getState().docs.find((d) => d.id === id);
      if (!source) return;
      // Si se clona el que se está editando, primero se sube lo último.
      if (this.current()?.id === id) await this.flush();
      const created = await this.api.create({ name: this.deps.names.copyOf(source.name), cloneOf: id, by: this.by() });
      if (!created.ok) return this.fail(created.code);
      await this.refreshList();
      await this.openDoc(created.value.id);
    });
  }

  rename(id: string, name: string): Promise<void> {
    return this.track(async () => {
      if (!name.trim()) return;
      const result = await this.api.rename(id, name);
      if (!result.ok) return this.fail(result.code);
      if (this.current()?.id === id) this.setCurrent({ name: result.value.name });
      await this.refreshList();
    });
  }

  /** A la papelera [R6 §8]. Si era el abierto, se pasa al siguiente de la lista. */
  remove(id: string): Promise<void> {
    return this.track(async () => {
      const isCurrent = this.current()?.id === id;
      if (isCurrent) await this.leaveCurrent();
      const result = await this.api.remove(id);
      if (!result.ok) return this.fail(result.code);
      await this.refreshList();
      if (!isCurrent) return;
      this.storage.remove(STORAGE_KEYS.lastDoc);
      const next = this.ui.getState().docs[0];
      if (next) await this.openDoc(next.id);
      else this.showNothing();
    });
  }

  restore(id: string): Promise<void> {
    return this.track(async () => {
      const result = await this.api.restore(id);
      if (!result.ok) return this.fail(result.code);
      await this.refreshList();
      await this.openDoc(id);
    });
  }

  /** Importar: el JSON entra a la lista como tablero nuevo [R6 §4]. */
  importJson(text: string, fileName: string): Promise<boolean> {
    return this.track(async () => {
      const parsed = parseBoard(text, this.board.getState().registry);
      if (!parsed.ok) {
        this.ui.setState({ notice: { kind: 'importFailed', code: parsed.error.code } });
        return false;
      }
      const fromFile = fileName.replace(/\.json$/i, '').trim();
      const name = fromFile || parsed.doc.metadata.name || this.deps.names.untitled;
      const created = await this.createFrom(withName(parsed.doc, name));
      return created;
    });
  }

  /** Exportar: descarga el JSON del tablero abierto, con su nombre de la lista. */
  exportJson(): string | undefined {
    const current = this.current();
    if (!current || !this.deps.download) return undefined;
    const text = serializeBoard(withName(docOf(this.board.getState()), current.name));
    const fileName = toFileName(current.name, 'json');
    this.deps.download(text, fileName);
    return fileName;
  }

  /** Exporta un tablero de la lista sin abrirlo (el abierto, tal como está en pantalla). */
  exportDoc(id: string): Promise<void> {
    return this.track(async () => {
      if (this.current()?.id === id) {
        this.exportJson();
        return;
      }
      const doc = await this.api.get(id);
      if (!doc.ok) return this.fail(doc.code);
      const parsed = parseBoard(doc.value.content, this.board.getState().registry);
      if (!parsed.ok) return this.fail('INVALID_DOCUMENT');
      this.deps.download?.(serializeBoard(withName(parsed.doc, doc.value.name)), toFileName(doc.value.name, 'json'));
    });
  }

  /** «Editar»: toma el turno al instante; quien editaba pasa a solo lectura [R6 §5]. */
  takeEdit(): Promise<void> {
    return this.track(async () => {
      const current = this.current();
      if (!current || current.deleted || current.role === 'editor') return;
      const result = await this.api.lease(current.id, { session: this.session, name: this.by(), take: true });
      if (!result.ok) return this.fail(result.code);
      await this.becomeEditor(result.value.version);
    });
  }

  /** Sube lo pendiente y consulta el servidor ya, sin esperar a los relojes (E2E). */
  async syncNow(): Promise<void> {
    await this.flush();
    if (this.current()?.role === 'editor') await this.heartbeat();
    else await this.poll();
    await this.refreshList();
  }

  // ─── Guardado ─────────────────────────────────────────────────────────────────────────────────

  /** Sube ya lo pendiente (si hay y si este es el editor). */
  async flush(): Promise<void> {
    clearTimeout(this.saveTimer);
    clearTimeout(this.maxWaitTimer);
    clearTimeout(this.retryTimer);
    this.saveTimer = this.maxWaitTimer = this.retryTimer = undefined;
    if (this.saving) {
      this.saveAgain = true;
      return;
    }
    const current = this.current();
    if (!current || current.role !== 'editor' || !this.dirty) return;
    const doc = docOf(this.board.getState());
    const content = serializeBoard(withName(doc, current.name));
    this.saving = true;
    this.ui.setState({ save: 'saving' });
    const result = await this.api.save(current.id, {
      content,
      baseVersion: current.version,
      session: this.session,
      by: this.by(),
    });
    this.saving = false;
    if (this.disposed || this.current()?.id !== current.id) return;

    if (result.ok) {
      this.retries = 0;
      this.setCurrent({ version: result.value.version });
      this.touchSummary(current.id, result.value.updatedAt);
      if (docOf(this.board.getState()) === doc) {
        this.dirty = false;
        this.storage.remove(this.pendingKey(current.id));
        this.ui.setState({ save: 'saved' });
      } else {
        this.scheduleSave();
      }
    } else if (result.code === 'NETWORK' || result.code === 'SERVER') {
      this.writePending();
      this.ui.setState({ save: 'offline' });
      const delay = Math.min(RETRY_MAX_MS, 1000 * 2 ** this.retries);
      this.retries += 1;
      this.retryTimer = setTimeout(() => void this.flush(), delay);
    } else if (['NOT_EDITOR', 'STALE', 'IN_TRASH', 'NOT_FOUND'].includes(result.code)) {
      await this.lostEdit(result.code);
    } else {
      this.writePending();
      this.ui.setState({ save: 'error', notice: { kind: 'error', code: result.code } });
    }

    if (this.saveAgain) {
      this.saveAgain = false;
      void this.flush();
    }
  }

  private markDirty(): void {
    this.dirty = true;
    this.ui.setState({ save: 'pending' });
    this.scheduleSave();
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), SAVE_DEBOUNCE_MS);
    this.maxWaitTimer ??= setTimeout(() => void this.flush(), SAVE_MAX_WAIT_MS);
  }

  /** Copia en el navegador de lo que todavía no llegó al servidor. */
  private writePending(): void {
    const current = this.current();
    if (!current || current.role !== 'editor' || !this.dirty) return;
    const entry: PendingEntry = {
      baseVersion: current.version,
      content: serializeBoard(withName(docOf(this.board.getState()), current.name)),
      name: current.name,
      savedAt: Date.now(),
    };
    this.storage.set(this.pendingKey(current.id), JSON.stringify(entry));
  }

  private pendingKey(id: string): string {
    return `${STORAGE_KEYS.pendingPrefix}${id}`;
  }

  /**
   * Lo que quedó sin subir de otra sesión (por ejemplo, se cerró sin conexión). Si el tablero no
   * cambió desde entonces, se sube; si cambió, queda como copia para no pisar el trabajo de otro.
   */
  private async recoverPending(): Promise<void> {
    for (const key of this.storage.keys(STORAGE_KEYS.pendingPrefix)) {
      let entry: PendingEntry;
      try {
        entry = JSON.parse(this.storage.get(key) ?? '') as PendingEntry;
      } catch {
        this.storage.remove(key);
        continue;
      }
      if (Date.now() - entry.savedAt < PENDING_STALE_MS) continue;
      const id = key.slice(STORAGE_KEYS.pendingPrefix.length);
      const doc = await this.api.get(id);
      if (!doc.ok && doc.code === 'NETWORK') return;
      if (doc.ok && doc.value.deletedAt === null && doc.value.version === entry.baseVersion) {
        const lease = await this.api.lease(id, { session: this.session, name: this.by(), take: false });
        if (lease.ok && lease.value.granted) {
          const saved = await this.api.save(id, {
            content: entry.content,
            baseVersion: entry.baseVersion,
            session: this.session,
            by: this.by(),
          });
          await this.api.release(id, this.session);
          if (saved.ok) {
            this.storage.remove(key);
            this.ui.setState({ notice: { kind: 'recovered', name: doc.value.name } });
            continue;
          }
        }
      }
      const copy = await this.api.create({ name: entry.name, content: entry.content, by: this.by() });
      if (copy.ok) {
        this.storage.remove(key);
        this.ui.setState({ notice: { kind: 'copySaved', name: copy.value.name } });
      } else if (copy.code !== 'NETWORK') {
        this.storage.remove(key);
      }
    }
  }

  // ─── Turno de edición ─────────────────────────────────────────────────────────────────────────

  private async openDoc(id: string): Promise<void> {
    await this.leaveCurrent();
    const doc = await this.api.get(id);
    if (!doc.ok) {
      this.fail(doc.code);
      await this.refreshList();
      return;
    }
    if (!this.load(doc.value)) return;
    this.board.getState().fitToContent();
    this.storage.set(STORAGE_KEYS.lastDoc, id);
    this.ui.setState({ remotePending: false });
    if (doc.value.deletedAt !== null) {
      this.board.getState().setReadOnly(true);
      return;
    }
    const lease = await this.api.lease(id, { session: this.session, name: this.by(), take: false });
    if (lease.ok && lease.value.granted) await this.becomeEditor(lease.value.version);
    else this.becomeViewer(lease.ok ? lease.value.editor : null);
    // Un rechazo que no es falta de red no se debe tragar: se queda mirando, pero avisa.
    if (!lease.ok && lease.code !== 'NETWORK') this.fail(lease.code);
  }

  /** Carga un documento del servidor en el tablero. No es una edición: no se vuelve a subir. */
  private load(doc: DocFull): boolean {
    const parsed = parseBoard(doc.content, this.board.getState().registry);
    if (!parsed.ok) {
      this.showNothing();
      this.fail('INVALID_DOCUMENT');
      return false;
    }
    this.applying = true;
    try {
      this.board.getState().loadDocument(parsed.doc);
    } finally {
      this.applying = false;
    }
    this.dirty = false;
    this.ui.setState({
      current: {
        id: doc.id,
        name: doc.name,
        version: doc.version,
        role: this.current()?.id === doc.id ? this.current()!.role : 'viewer',
        editor: doc.editor,
        deleted: doc.deletedAt !== null,
      },
      save: 'saved',
    });
    return true;
  }

  private async becomeEditor(version: number): Promise<void> {
    const current = this.current();
    if (!current) return;
    if (version !== current.version) {
      const latest = await this.api.get(current.id);
      if (latest.ok) this.load(latest.value);
    } else {
      // El deshacer empieza vacío: no se deshace lo que hizo otro [R6 §5].
      this.board.getState().clearHistory();
    }
    this.setCurrent({ role: 'editor', editor: { name: this.by() } });
    this.board.getState().setReadOnly(false);
    this.stopTimers();
    this.heartbeatTimer = setInterval(() => void this.heartbeat(), LEASE_HEARTBEAT_MS);
  }

  private becomeViewer(editor: EditorInfo | null): void {
    this.setCurrent({ role: 'viewer', editor });
    this.board.getState().setReadOnly(true);
    this.stopTimers();
    this.pollTimer = setInterval(() => void this.poll(), VIEWER_POLL_MS);
  }

  private async heartbeat(): Promise<void> {
    const current = this.current();
    if (!current || current.role !== 'editor' || this.ticking) return;
    this.ticking = true;
    const result = await this.api.lease(current.id, { session: this.session, name: this.by(), take: false });
    this.ticking = false;
    if (this.current()?.id !== current.id || this.current()?.role !== 'editor') return;
    if (result.ok && !result.value.granted) await this.lostEdit('NOT_EDITOR', result.value.editor);
    else if (!result.ok && (result.code === 'IN_TRASH' || result.code === 'NOT_FOUND')) await this.lostEdit(result.code);
  }

  private async poll(): Promise<void> {
    const current = this.current();
    if (!current || current.role !== 'viewer' || this.ticking) return;
    this.ticking = true;
    try {
      const state = await this.api.state(current.id, this.session);
      if (this.current()?.id !== current.id || this.current()?.role !== 'viewer') return;
      if (!state.ok) {
        if (state.code === 'NOT_FOUND') {
          this.stopTimers();
          this.setCurrent({ deleted: true, editor: null });
          this.ui.setState({ notice: { kind: 'deleted' } });
        } else if (state.code === 'NETWORK') this.ui.setState({ save: 'offline' });
        return;
      }
      const { value } = state;
      if (this.ui.getState().save === 'offline') this.ui.setState({ save: 'saved' });
      if (value.deletedAt !== null) {
        if (!current.deleted) {
          this.setCurrent({ deleted: true, editor: null });
          this.ui.setState({ notice: { kind: 'deleted' } });
        }
        return;
      }
      this.setCurrent({ name: value.name, editor: value.editor, deleted: false });
      const simulating = this.board.getState().mode !== 'edit';
      if (value.version !== current.version) {
        if (simulating) this.ui.setState({ remotePending: true });
        else await this.pullLatest();
      }
      // Si nadie edita, el turno queda para quien mira (salvo que esté simulando).
      if (value.editor === null && !simulating) {
        const lease = await this.api.lease(current.id, { session: this.session, name: this.by(), take: false });
        if (lease.ok && lease.value.granted) await this.becomeEditor(lease.value.version);
      }
    } finally {
      this.ticking = false;
    }
  }

  /** Trae la última versión del tablero abierto, sin tocar la vista. */
  private async pullLatest(): Promise<void> {
    const current = this.current();
    if (!current) return;
    const latest = await this.api.get(current.id);
    if (!latest.ok || this.current()?.id !== current.id) return;
    this.load(latest.value);
    this.ui.setState({ remotePending: false });
  }

  /**
   * Se perdió el turno (o el tablero ya no se puede guardar). Lo que no se alcanzó a subir va a
   * una copia; después se pasa a mirar la versión del servidor [R6 §10].
   */
  private async lostEdit(reason: CloudErrorCode, editor: EditorInfo | null = null): Promise<void> {
    const current = this.current();
    if (!current) return;
    const unsaved = this.dirty ? serializeBoard(withName(docOf(this.board.getState()), current.name)) : null;
    this.dirty = false;
    clearTimeout(this.saveTimer);
    clearTimeout(this.maxWaitTimer);
    clearTimeout(this.retryTimer);
    this.saveTimer = this.maxWaitTimer = this.retryTimer = undefined;
    const deleted = reason === 'IN_TRASH' || reason === 'NOT_FOUND';
    this.becomeViewer(editor);
    let notice: CloudNotice = deleted ? { kind: 'deleted' } : { kind: 'tookOver', editor: editor?.name ?? null };
    if (unsaved) {
      const copy = await this.api.create({ name: current.name, content: unsaved, by: this.by() });
      if (copy.ok) {
        this.storage.remove(this.pendingKey(current.id));
        notice = { kind: 'copySaved', name: copy.value.name };
        void this.refreshList();
      }
    }
    this.ui.setState({ notice });
    if (deleted) {
      this.stopTimers();
      this.setCurrent({ deleted: true, editor: null });
    } else {
      await this.pullLatest();
      this.board.getState().setReadOnly(true);
    }
  }

  /** Antes de abrir otro: se sube lo pendiente y se suelta el turno. */
  private async leaveCurrent(): Promise<void> {
    const current = this.current();
    if (!current) return;
    await this.flush();
    this.stopTimers();
    if (this.current()?.role === 'editor') await this.api.release(current.id, this.session);
    this.ui.setState({ current: null });
  }

  /** No hay ningún tablero: lienzo vacío y quieto hasta que se cree o se elija uno. */
  private showNothing(): void {
    const now = new Date().toISOString();
    this.applying = true;
    this.board.getState().loadDocument(emptyBoard({ name: '', createdAt: now, modifiedAt: now }));
    this.applying = false;
    this.board.getState().setReadOnly(true);
    this.ui.setState({ current: null, save: 'idle' });
  }

  private async createFrom(doc: BoardDocument): Promise<boolean> {
    const created = await this.api.create({
      name: doc.metadata.name || this.deps.names.untitled,
      content: serializeBoard(doc),
      by: this.by(),
    });
    if (!created.ok) {
      this.fail(created.code);
      return false;
    }
    await this.refreshList();
    await this.openDoc(created.value.id);
    return true;
  }

  // ─── Utilidades ───────────────────────────────────────────────────────────────────────────────

  current(): CurrentDoc | null {
    return this.ui.getState().current;
  }

  /** Nombre con el que se firma: el de la red o, si no hay, el apodo. */
  by(): string | null {
    const { identity, nickname } = this.ui.getState();
    return identity ?? (nickname.trim() || null);
  }

  private setCurrent(patch: Partial<CurrentDoc>): void {
    const current = this.current();
    if (current) this.ui.setState({ current: { ...current, ...patch } });
  }

  private touchSummary(id: string, updatedAt: number): void {
    const docs = this.ui.getState().docs;
    const found = docs.find((d) => d.id === id);
    if (!found) return;
    const updated: DocSummary = { ...found, updatedAt, updatedBy: this.by(), version: this.current()?.version ?? found.version };
    this.ui.setState({ docs: [updated, ...docs.filter((d) => d.id !== id)] });
  }

  private fail(code: CloudErrorCode): void {
    this.ui.setState({ notice: { kind: 'error', code } });
  }

  private stopTimers(): void {
    clearInterval(this.heartbeatTimer);
    clearInterval(this.pollTimer);
    this.heartbeatTimer = this.pollTimer = undefined;
  }

  private async track<T>(fn: () => Promise<T>): Promise<T> {
    this.ui.setState((s) => ({ busy: s.busy + 1 }));
    try {
      return await fn();
    } finally {
      this.ui.setState((s) => ({ busy: s.busy - 1 }));
    }
  }
}
