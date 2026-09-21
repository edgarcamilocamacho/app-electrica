import type { Id } from './types';

/** Selección de objetos editables. Forma parte del snapshot del historial (PLAN §13). */
export interface Selection {
  readonly components: readonly Id[];
  readonly segments: readonly Id[];
  readonly annotations: readonly Id[];
}

export const EMPTY_SELECTION: Selection = { components: [], segments: [], annotations: [] };

export function selectionSize(sel: Selection): number {
  return sel.components.length + sel.segments.length + sel.annotations.length;
}

export function isSelectionEmpty(sel: Selection): boolean {
  return selectionSize(sel) === 0;
}

export function selectionOf(partial: Partial<Selection>): Selection {
  return {
    components: partial.components ?? [],
    segments: partial.segments ?? [],
    annotations: partial.annotations ?? [],
  };
}
