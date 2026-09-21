/**
 * Historial de deshacer/rehacer por snapshots inmutables (PLAN §13, T-04). Cada entrada es el
 * estado completo; como las operaciones comparten los objetos no modificados, el costo es bajo.
 *
 * Genérico sobre el estado: la app guarda { documento, selección }.
 */
export interface History<S> {
  readonly past: readonly S[];
  readonly present: S;
  readonly future: readonly S[];
  /** Clave de la última entrada, para agrupar ediciones continuas (p. ej. tipear en un campo). */
  readonly coalesceKey?: string;
  readonly lastCommitAt?: number;
}

export interface CommitOptions {
  /** Commits consecutivos con la misma clave, dentro de la ventana, se funden en una entrada. */
  readonly coalesceKey?: string;
  readonly now?: number;
  readonly coalesceWindowMs?: number;
  readonly limit?: number;
}

export const HISTORY_LIMIT = 200;
export const COALESCE_WINDOW_MS = 500;

export function createHistory<S>(initial: S): History<S> {
  return { past: [], present: initial, future: [] };
}

export function commit<S>(history: History<S>, next: S, options: CommitOptions = {}): History<S> {
  if (Object.is(next, history.present)) return history;
  const now = options.now ?? 0;
  const windowMs = options.coalesceWindowMs ?? COALESCE_WINDOW_MS;
  const limit = options.limit ?? HISTORY_LIMIT;

  const coalesce =
    options.coalesceKey !== undefined &&
    options.coalesceKey === history.coalesceKey &&
    history.lastCommitAt !== undefined &&
    now - history.lastCommitAt <= windowMs;

  if (coalesce) {
    return { ...history, present: next, future: [], lastCommitAt: now };
  }

  const past = [...history.past, history.present];
  if (past.length > limit) past.splice(0, past.length - limit);
  return {
    past,
    present: next,
    future: [],
    ...(options.coalesceKey !== undefined ? { coalesceKey: options.coalesceKey } : {}),
    lastCommitAt: now,
  };
}

/** Reemplaza el presente sin crear entrada (p. ej. selección que no debe deshacerse sola). */
export function replacePresent<S>(history: History<S>, next: S): History<S> {
  return { past: history.past, present: next, future: history.future };
}

export function undo<S>(history: History<S>): History<S> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1]!;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<S>(history: History<S>): History<S> {
  if (history.future.length === 0) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next!,
    future: rest,
  };
}

export const canUndo = <S>(history: History<S>): boolean => history.past.length > 0;
export const canRedo = <S>(history: History<S>): boolean => history.future.length > 0;
