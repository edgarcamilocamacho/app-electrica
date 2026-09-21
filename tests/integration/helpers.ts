import { createCounterIdGen } from '../../src/core/model/ids';
import { defaultRegistry } from '../../src/core/registry/catalog';
import type { CircuitDocument } from '../../src/core/model/types';
import { createEditorStore, docOf, GRID_PX, type EditorStore } from '../../src/app/store/editorStore';
import { ManualClock } from '../../src/platform/clock';

export function createTestStore(initial?: CircuitDocument) {
  const clock = new ManualClock();
  let wall = 1_000_000;
  const store = createEditorStore(
    {
      ctx: { ids: createCounterIdGen(), registry: defaultRegistry },
      clock,
      now: () => (wall += 1000), // cada acción, un segundo después: sin coalescencia accidental
      confirm: () => true,
    },
    initial,
  );
  // Lienzo virtual de 1000×800 con el origen del mundo en (0,0) y zoom 1.
  store.setState({ canvasSize: { width: 1000, height: 800 }, viewport: { panX: 0, panY: 0, zoom: 1 } });
  return { store, clock };
}

/** Simula un clic en coordenadas de grid. */
export function click(store: EditorStore, x: number, y: number, shift = false): void {
  store.getState().pointerMove({ x, y });
  store.getState().pointerDown({ x, y }, { shift });
  store.getState().pointerUp({ x, y });
}

export function move(store: EditorStore, x: number, y: number): void {
  store.getState().pointerMove({ x, y });
}

export const doc = (store: EditorStore) => docOf(store.getState());
export const px = (units: number) => units * GRID_PX;
