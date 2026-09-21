import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { defaultRegistry } from '../../core/registry/catalog';
import type { Registry } from '../../core/registry/types';
import type { EditorState, EditorStore } from './editorStore';

const EditorContext = createContext<EditorStore | null>(null);

export function EditorProvider({ store, children }: { store: EditorStore; children: ReactNode }) {
  return <EditorContext.Provider value={store}>{children}</EditorContext.Provider>;
}

export function useEditorStore(): EditorStore {
  const store = useContext(EditorContext);
  if (!store) throw new Error('useEditorStore fuera de EditorProvider');
  return store;
}

/** Selecciona una parte del estado. El selector debe devolver valores estables (no objetos nuevos). */
export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useStore(useEditorStore(), selector);
}

export function useRegistry(): Registry {
  return defaultRegistry;
}
