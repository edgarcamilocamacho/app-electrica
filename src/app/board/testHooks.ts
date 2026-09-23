/**
 * Ganchos para E2E (PLAN §18.4): solo se instalan con `?e2e=1`. Permiten avanzar el tiempo de
 * simulación de forma determinista (sin `sleep`) y convertir coordenadas del mundo a pantalla.
 * Las acciones bajo prueba siempre se hacen por la interfaz real.
 */
import { serializeBoard, parseBoard } from '../../core/board/persistence';
import { createCounterIdGen } from '../../core/model/ids';
import { catalogBoard, selectorBoard, starterBoard, timerBoard } from '../../examples/board';
import type { CloudController } from '../cloud/controller';
import { docOf, worldToScreen, type BoardStore } from './store';

export interface BoardE2EHooks {
  advance(ms: number): void;
  worldToScreen(x: number, y: number): { x: number; y: number };
  documentJson(): string;
  loadJson(text: string): boolean;
  state(): { mode: string; tool: string; zoom: number; devices: number; wires: number };
  deviceIdByRef(ref: string): string | undefined;
  /** Carga un circuito de ejemplo por nombre, para no repetir coordenadas en las pruebas. */
  loadExample(name: 'arranque' | 'temporizador' | 'selector' | 'catalogo'): void;
  /** Zoom 100 % con el origen del mundo cerca del borde superior izquierdo del lienzo. */
  resetView(): void;
  /** Estado del tablero abierto en el servidor [R6]. */
  cloud(): { ready: boolean; busy: number; id: string | null; name: string | null; role: string | null; save: string };
  /** Hace ya lo que el controlador haría con sus relojes: subir, latir o consultar. */
  syncNow(): Promise<void>;
}

declare global {
  interface Window {
    __e2e?: BoardE2EHooks;
  }
}

export function installBoardE2EHooks(store: BoardStore, cloud: CloudController): void {
  let simMs = 0;
  window.__e2e = {
    advance(ms) {
      simMs += ms;
      store.getState().advance(simMs);
    },
    worldToScreen(x, y) {
      const host = document.querySelector('[data-testid="board-canvas"]')!.getBoundingClientRect();
      const p = worldToScreen(store.getState().viewport, { x, y });
      return { x: host.left + p.x, y: host.top + p.y };
    },
    documentJson: () => serializeBoard(docOf(store.getState())),
    loadJson(text) {
      const result = parseBoard(text, store.getState().registry);
      if (!result.ok) return false;
      store.getState().loadDocument(result.doc);
      return true;
    },
    state() {
      const s = store.getState();
      const doc = docOf(s);
      return {
        mode: s.mode,
        tool: s.tool,
        zoom: s.viewport.zoom,
        devices: Object.keys(doc.devices).length,
        wires: Object.keys(doc.wires).length,
      };
    },
    loadExample(name) {
      const ids = createCounterIdGen();
      const ctx = { ids, registry: store.getState().registry };
      const doc =
        name === 'temporizador'
          ? timerBoard(ctx)
          : name === 'selector'
            ? selectorBoard(ctx)
            : name === 'catalogo'
              ? catalogBoard(ctx)
              : starterBoard(ctx);
      store.getState().loadDocument(doc);
    },
    deviceIdByRef(ref) {
      return Object.values(docOf(store.getState()).devices).find((d) => d.props.ref === ref)?.id;
    },
    resetView() {
      store.getState().setViewport({ zoom: 1, pan: { x: 120, y: 120 } });
    },
    cloud() {
      const s = cloud.ui.getState();
      return {
        ready: s.ready,
        busy: s.busy,
        id: s.current?.id ?? null,
        name: s.current?.name ?? null,
        role: s.current?.role ?? null,
        save: s.save,
      };
    },
    syncNow: () => cloud.syncNow(),
  };
}
