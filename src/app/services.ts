import { createRandomIdGen } from '../core/model/ids';
import { parseDocument, serializeDocument } from '../core/persistence/serialize';
import { defaultRegistry } from '../core/registry/catalog';
import type { CircuitDocument } from '../core/model/types';
import type { Clock } from '../platform/clock';
import { openText, saveText, type FileHandle } from '../platform/files';
import { readAutosave, writeAutosave, type KeyValueStorage, AUTOSAVE_KEY } from '../platform/storage';
import { VersionChecker, type FetchLike } from '../platform/version';
import { createEditorStore, docOf, type EditorStore } from './store/editorStore';

export interface AppServicesOptions {
  readonly clock: Clock;
  readonly storage: KeyValueStorage;
  readonly confirm: (message: string) => boolean;
  readonly fetch?: FetchLike;
  readonly buildId: string;
  readonly checkVersion: boolean;
  readonly now?: () => number;
}

export interface AppServices {
  readonly store: EditorStore;
  /** Escribe el autoguardado pendiente ya mismo (antes de recargar). */
  flushAutosave(): void;
  dispose(): void;
}

export const AUTOSAVE_DELAY_MS = 1500;

/**
 * Arma la tienda con sus dependencias reales y los servicios de fondo:
 *   · autoguardado local con recuperación automática al abrir (R2 §28, I16);
 *   · detección de versión nueva (PLAN §16.2).
 */
export function createAppServices(opts: AppServicesOptions): AppServices {
  const now = opts.now ?? (() => Date.now());
  const ctx = { ids: createRandomIdGen(), registry: defaultRegistry };

  let initial: CircuitDocument | undefined;
  let restoredName = '';
  const saved = readAutosave(opts.storage);
  if (saved) {
    const r = parseDocument(saved.text, ctx);
    if (r.ok && (Object.keys(r.doc.components).length > 0 || Object.keys(r.doc.segments).length > 0 || Object.keys(r.doc.annotations).length > 0)) {
      initial = r.doc;
      restoredName = saved.fileName;
    }
  }

  const store = createEditorStore(
    {
      ctx,
      clock: opts.clock,
      now,
      confirm: opts.confirm,
      files: {
        open: () => openText(),
        save: (text, name, handle, forcePicker) => saveText(text, name, handle as FileHandle | undefined, forcePicker),
      },
    },
    initial,
  );

  if (initial) {
    store.setState({ file: { name: restoredName, dirty: true } });
    store.getState().pushToast('toasts.restored', [{ key: 'toasts.startNew', run: () => store.getState().newDocument() }]);
  }

  // Autoguardado con antirrebote.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  const write = () => {
    pending = false;
    const s = store.getState();
    const doc = docOf(s);
    const empty = Object.keys(doc.components).length + Object.keys(doc.segments).length + Object.keys(doc.annotations).length === 0;
    if (empty) opts.storage.remove(AUTOSAVE_KEY);
    else writeAutosave(opts.storage, { savedAt: new Date(now()).toISOString(), fileName: s.file.name, text: serializeDocument(doc) });
  };
  const unsubscribe = store.subscribe((s, prev) => {
    if (docOf(s) === docOf(prev)) return;
    pending = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, AUTOSAVE_DELAY_MS);
  });

  let checker: VersionChecker | undefined;
  if (opts.checkVersion && opts.fetch) {
    checker = new VersionChecker({
      currentBuildId: opts.buildId,
      fetch: opts.fetch,
      onNewVersion: () =>
        store.getState().pushToast('toasts.newVersion', [
          {
            key: 'toasts.reload',
            run: () => {
              if (pending) write();
              window.location.reload();
            },
          },
        ]),
    });
    checker.start();
  }

  return {
    store,
    flushAutosave: () => {
      if (timer) clearTimeout(timer);
      if (pending) write();
    },
    dispose: () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      checker?.stop();
    },
  };
}
