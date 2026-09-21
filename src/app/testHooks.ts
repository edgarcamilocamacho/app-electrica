import { serializeDocument } from '../core/persistence/serialize';
import type { ManualClock } from '../platform/clock';
import { docOf, worldToScreen, type EditorStore } from './store/editorStore';

/**
 * Ganchos para E2E (PLAN §18.4): solo se instalan con `?e2e=1`. Permiten avanzar el reloj de
 * simulación de forma determinista (sin `sleep`) y convertir coordenadas del mundo a pantalla.
 * Las acciones bajo prueba siempre se hacen por la UI real.
 */
export interface E2EHooks {
  advance(ms: number): void;
  worldToScreen(x: number, y: number): { x: number; y: number };
  documentJson(): string;
  loadJson(text: string): boolean;
  state(): { mode: string; tool: string; zoom: number; dirty: boolean };
  componentIdByRef(ref: string): string | undefined;
}

declare global {
  interface Window {
    __e2e?: E2EHooks;
  }
}

export function installE2EHooks(store: EditorStore, clock: ManualClock): void {
  window.__e2e = {
    advance(ms) {
      clock.advance(ms);
      store.getState().simTick();
      // Publicar el estado aunque no hayan pasado 100 ms de pared.
      store.getState().simTick();
    },
    worldToScreen(x, y) {
      const canvas = document.querySelector('[data-testid="canvas"]')!.getBoundingClientRect();
      const p = worldToScreen(store.getState().viewport, { x, y });
      return { x: canvas.left + p.x, y: canvas.top + p.y };
    },
    documentJson: () => serializeDocument(docOf(store.getState())),
    loadJson: (text) => store.getState().loadText(text, 'e2e.json'),
    state() {
      const s = store.getState();
      return { mode: s.mode, tool: s.tool.kind, zoom: s.viewport.zoom, dirty: s.file.dirty };
    },
    componentIdByRef(ref) {
      return Object.values(docOf(store.getState()).components).find((c) => c.props.ref === ref)?.id;
    },
  };
}
