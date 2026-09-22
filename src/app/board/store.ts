/**
 * Tienda del editor de tablero (PLAN §22.7, hito G2).
 *
 * Toda mutación del documento pasa por `commitDoc`, que valida con la operación del núcleo y
 * empuja una entrada de historial. Las operaciones inválidas quedan como vista previa en rojo.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { boardRegistry } from '../../core/board/catalog';
import { blockingDiagnostics, computeDiagnostics, type BoardDiagnostic } from '../../core/board/diagnostics';
import type { BoardDocument, TerminalRef, WireColor, WireEnd, WireGauge } from '../../core/board/model';
import {
  DEFAULT_WIRE_COLOR,
  DEFAULT_WIRE_GAUGE,
  deviceOuterRect,
  emptyBoard,
  endPosition,
  sameEnd,
  terminalOf,
  terminalPosition,
  toFree,
  toTerminal,
} from '../../core/board/model';
import {
  addAnnotation,
  connect,
  copyClip,
  pasteClip,
  type BoardClip,
  moveSelection,
  moveWireSegment,
  placeDevice,
  remove,
  setAnnotationText,
  setDeviceProps,
  setWireStyle,
  type BoardEditResult,
  type OpContext,
} from '../../core/board/ops';
import { findTerminal, type DeviceRegistry } from '../../core/board/registry';
import { BoardSimEngine, type SimSnapshot } from '../../core/board/sim/engine';
import {
  approachTerminal,
  autoRoute,
  normalizeRoute,
  STUB,
  wirePathFrom,
  wireRoute,
} from '../../core/board/wireGeometry';
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  undo,
  type History,
} from '../../core/history/history';
import { DIR_VECTOR, rectFromPoints, rectUnion, type Rect } from '../../core/model/geometry';
import { createRandomIdGen, type IdGen } from '../../core/model/ids';
import type { Dir, Id, Point } from '../../core/model/types';

export const GRID_PX = 10;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const DEFAULT_ZOOM = 1;
export const SPEEDS = [0.25, 1, 4] as const;
/** Desplazamiento de lo pegado, en unidades de grid. */
export const PASTE_OFFSET = 6;
export type Speed = (typeof SPEEDS)[number];

export type BoardToolKind = 'select' | 'wire' | 'erase' | 'text';
export type Mode = 'edit' | 'simulating' | 'error';

export interface BoardSelection {
  readonly devices: readonly Id[];
  readonly wires: readonly Id[];
  readonly annotations: readonly Id[];
}

export const EMPTY_SELECTION: BoardSelection = { devices: [], wires: [], annotations: [] };

export interface BoardSnapshotState {
  readonly doc: BoardDocument;
  readonly selection: BoardSelection;
}

export interface Viewport {
  readonly pan: Point;
  readonly zoom: number;
}

/** Aparato que sigue al cursor hasta que se coloca. */
export interface Placing {
  readonly type: string;
  readonly at: Point;
}

/** Cable en curso: arranca en un borne y termina en otro [I8]. */
export interface WiringDraft {
  readonly from: WireEnd;
  /** Puntos ya fijados, empezando por el tornillo de origen. Siempre ortogonales entre sí. */
  readonly points: readonly Point[];
  /** Punto libre bajo el cursor, ya ajustado a la grilla o al borne apuntado. */
  readonly cursor: Point;
  /** Borne bajo el cursor, si lo hay: ahí termina el cable. */
  readonly over?: TerminalRef;
}

/** Punto justo afuera del tornillo, en la dirección por la que sale su cable. */
export function stubOf(doc: BoardDocument, registry: DeviceRegistry, end: WireEnd): Point {
  const at = endPosition(doc, registry, end);
  const dir = dirOf(doc, registry, end);
  return { x: at.x + DIR_VECTOR[dir].x * STUB, y: at.y + DIR_VECTOR[dir].y * STUB };
}

/**
 * Ruta del trazado en curso hasta un borne. Sin codos propios se usa el ruteo automático, que sale
 * y entra perpendicular a cada tornillo y cruza por el medio; con codos del usuario, se continúa
 * con un tramo en L hasta la salida del tornillo de destino.
 */
function routeTo(doc: BoardDocument, registry: DeviceRegistry, wiring: WiringDraft, to: WireEnd): Point[] {
  const from = endPosition(doc, registry, wiring.from);
  const end = endPosition(doc, registry, to);
  if (wiring.points.length <= 2 && wiring.from.kind === 'terminal') {
    return autoRoute(from, dirOf(doc, registry, wiring.from), end, dirOf(doc, registry, to));
  }
  const last = wiring.points[wiring.points.length - 1]!;
  const previous = wiring.points[wiring.points.length - 2];
  const dir = dirOf(doc, registry, to);
  const ref = terminalOf(to);
  const tail = ref
    ? approachTerminal(last, end, dir)
    : normalizeRoute([...wirePathFrom(previous, last, end)]);
  return normalizeRoute([...wiring.points, ...tail], true);
}

const dirOf = (doc: BoardDocument, registry: DeviceRegistry, end: WireEnd): Dir => {
  const ref = terminalOf(end);
  if (!ref) return 'N';
  const def = registry.get(doc.devices[ref.deviceId]!.type);
  return def ? (findTerminal(def, ref.terminalId)?.dir ?? 'N') : 'N';
};

export interface DragState {
  readonly devices: readonly Id[];
  readonly annotations: readonly Id[];
  readonly origin: Point;
  readonly delta: Point;
}

export interface Preview {
  readonly doc: BoardDocument;
  readonly ok: boolean;
  readonly invalid: readonly Id[];
}

export interface BoardStatus {
  readonly text: string;
  readonly tone: 'info' | 'warning' | 'error';
}

export interface BoardState {
  readonly registry: DeviceRegistry;
  readonly history: History<BoardSnapshotState>;
  readonly tool: BoardToolKind;
  readonly placing?: Placing;
  readonly wiring?: WiringDraft;
  readonly drag?: DragState;
  readonly marquee?: { readonly from: Point; readonly to: Point };
  readonly viewport: Viewport;
  readonly wireStyle: { readonly color: WireColor; readonly gauge: WireGauge };
  readonly preview?: Preview;
  readonly mode: Mode;
  readonly sim: SimSnapshot | null;
  readonly speed: Speed;
  readonly status?: BoardStatus;

  // Herramientas y selección
  setTool(tool: BoardToolKind): void;
  startPlacing(type: string, at: Point): void;
  movePlacing(at: Point): void;
  place(at: Point): void;
  cancel(): void;
  setSelection(selection: BoardSelection): void;
  selectDevice(id: Id, additive?: boolean): void;
  selectWire(id: Id, additive?: boolean): void;

  // Cableado
  beginWire(from: TerminalRef): void;
  /** Empieza un cable en un punto vacío: la punta queda suelta hasta que se conecte [R5 §17]. */
  beginWireAt(at: Point): void;
  /** Termina el cable en el aire: la punta suelta queda marcada como error. */
  finishFree(): void;
  moveWireCursor(at: Point, over?: TerminalRef): void;
  addBend(at: Point): void;
  finishWire(to: TerminalRef): void;
  undoBend(): void;
  /** Ruta completa del trazado en curso, con el tramo que sigue al cursor. */
  draftRoute(): readonly Point[];

  // Mover, borrar, propiedades
  beginDrag(origin: Point): void;
  updateDrag(at: Point): void;
  endDrag(): void;
  nudge(dx: number, dy: number): void;
  eraseAt(target: { kind: 'device' | 'wire' | 'annotation'; id: Id }): void;
  deleteSelection(): void;
  setProps(deviceId: Id, props: Record<string, unknown>): void;
  copySelection(): void;
  paste(): void;
  duplicateSelection(): void;
  setWireLook(color?: WireColor, gauge?: WireGauge): void;
  dragWireSegment(wireId: Id, segmentIndex: number, delta: Point): void;
  /** Vista previa del tramo mientras se arrastra, sin tocar el historial. */
  previewWireSegment(wireId: Id, segmentIndex: number, delta: Point): void;
  addText(at: Point, text: string): void;
  editText(id: Id, text: string): void;

  // Historial y vista
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  setViewport(viewport: Partial<Viewport>): void;
  fitView(size: { width: number; height: number }): void;
  loadDocument(doc: BoardDocument): void;

  /** Diagnósticos del documento actual; simular exige cero bloqueantes. */
  diagnostics(): readonly BoardDiagnostic[];

  // Simulación
  startSim(): void;
  stopSim(): void;
  backToEdit(): void;
  setSpeed(speed: Speed): void;
  advance(elapsedMs: number): void;
  pressDevice(id: Id): void;
  releaseDevice(id: Id): void;
  toggleDevice(id: Id): void;
}

export type BoardStore = StoreApi<BoardState>;

export const snap = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

export const docOf = (s: BoardState): BoardDocument => s.history.present.doc;
export const selectionOf = (s: BoardState): BoardSelection => s.history.present.selection;

export const screenToWorld = (v: Viewport, p: Point): Point => ({
  x: (p.x - v.pan.x) / (GRID_PX * v.zoom),
  y: (p.y - v.pan.y) / (GRID_PX * v.zoom),
});

export const worldToScreen = (v: Viewport, p: Point): Point => ({
  x: p.x * GRID_PX * v.zoom + v.pan.x,
  y: p.y * GRID_PX * v.zoom + v.pan.y,
});

export function contentBounds(doc: BoardDocument, registry: DeviceRegistry): Rect | undefined {
  let box: Rect | undefined;
  for (const device of Object.values(doc.devices)) {
    const def = registry.get(device.type);
    if (!def) continue;
    const rect = deviceOuterRect(device, def);
    box = box ? rectUnion(box, rect) : rect;
  }
  for (const wire of Object.values(doc.wires)) {
    const rect = rectFromPoints([...wireRoute(doc, registry, wire)]);
    if (rect) box = box ? rectUnion(box, rect) : rect;
  }
  for (const note of Object.values(doc.annotations)) {
    const rect = rectFromPoints([note.position]);
    if (rect) box = box ? rectUnion(box, rect) : rect;
  }
  return box;
}

export interface BoardDeps {
  readonly ids?: IdGen;
  readonly registry?: DeviceRegistry;
  readonly now?: () => number;
}

const META = (): BoardDocument['metadata'] => ({
  name: '',
  createdAt: new Date().toISOString(),
  modifiedAt: new Date().toISOString(),
});

export function createBoardStore(deps: BoardDeps = {}, initial?: BoardDocument): BoardStore {
  const registry = deps.registry ?? boardRegistry;
  const ids = deps.ids ?? createRandomIdGen();
  const now = deps.now ?? (() => Date.now());
  const ctx: OpContext = { ids, registry };
  let engine: BoardSimEngine | null = null;
  let clipboard: BoardClip | undefined;

  return createStore<BoardState>((set, get) => {
    /** Confirma una operación: si es válida entra al historial; si no, queda como vista previa. */
    const apply = (result: BoardEditResult, options: { selection?: BoardSelection; coalesceKey?: string } = {}): boolean => {
      const state = get();
      if (!result.ok) {
        set({
          preview: {
            doc: result.doc,
            ok: false,
            invalid: [...new Set(result.violations.flatMap((v) => [...(v.devices ?? []), ...(v.wires ?? [])]))],
          },
          status: { text: result.violations[0]?.code ?? result.reason ?? '', tone: 'warning' },
        });
        return false;
      }
      const selection = options.selection ?? state.history.present.selection;
      const next: BoardSnapshotState = { doc: result.doc, selection };
      set({
        history: commit(state.history, next, {
          ...(options.coalesceKey ? { coalesceKey: options.coalesceKey } : {}),
          now: now(),
        }),
        preview: undefined,
        status: undefined,
      });
      return true;
    };

    /** Pega buscando un hueco: si cae encima de algo, se prueba un poco más lejos. */
    const pasteAt = (clip: BoardClip, delta: Point): void => {
      for (let step = 1; step <= 6; step += 1) {
        const at = { x: delta.x * step, y: delta.y * step };
        const result = pasteClip(docOf(get()), clip, at, ctx);
        if (result.ok || step === 6) {
          apply(result, {
            selection: { devices: result.devices, wires: result.wires, annotations: result.annotations },
          });
          return;
        }
      }
    };

    const clearTransient = (): void => set({ placing: undefined, wiring: undefined, drag: undefined, marquee: undefined, preview: undefined });

    return {
      registry,
      history: createHistory<BoardSnapshotState>({
        doc: initial ?? emptyBoard(META()),
        selection: EMPTY_SELECTION,
      }),
      tool: 'select',
      viewport: { pan: { x: 60, y: 60 }, zoom: DEFAULT_ZOOM },
      wireStyle: { color: DEFAULT_WIRE_COLOR, gauge: DEFAULT_WIRE_GAUGE },
      mode: 'edit',
      sim: null,
      speed: 1,

      setTool(tool) {
        clearTransient();
        set({ tool });
      },

      startPlacing(type, at) {
        set({ tool: 'select', placing: { type, at: snap(at) }, wiring: undefined, drag: undefined });
      },

      movePlacing(at) {
        const placing = get().placing;
        if (placing) set({ placing: { ...placing, at: snap(at) } });
      },

      place(at) {
        const placing = get().placing;
        if (!placing) return;
        const position = snap(at);
        const result = placeDevice(docOf(get()), { type: placing.type, position }, ctx);
        const placedId = Object.keys(result.doc.devices).find((id) => !docOf(get()).devices[id]);
        if (apply(result, { selection: placedId ? { ...EMPTY_SELECTION, devices: [placedId] } : EMPTY_SELECTION })) {
          set({ placing: undefined });
        }
      },

      cancel() {
        clearTransient();
      },

      setSelection(selection) {
        const state = get();
        set({ history: { ...state.history, present: { ...state.history.present, selection } } });
      },

      selectDevice(id, additive) {
        const current = selectionOf(get());
        const devices = additive ? [...new Set([...current.devices, id])] : [id];
        get().setSelection({ ...(additive ? current : EMPTY_SELECTION), devices });
      },

      selectWire(id, additive) {
        const current = selectionOf(get());
        const wires = additive ? [...new Set([...current.wires, id])] : [id];
        get().setSelection({ ...(additive ? current : EMPTY_SELECTION), wires });
      },

      beginWire(from) {
        // El cable sale perpendicular al tornillo antes de doblar, como en un tablero real.
        const end = toTerminal(from);
        const start = terminalPosition(docOf(get()), registry, from);
        const stub = stubOf(docOf(get()), registry, end);
        set({ tool: 'wire', wiring: { from: end, points: [start, stub], cursor: stub } });
      },

      beginWireAt(at) {
        const start = snap(at);
        set({ tool: 'wire', wiring: { from: toFree(start), points: [start], cursor: start } });
      },

      finishFree() {
        const wiring = get().wiring;
        if (!wiring || wiring.points.length < 2) {
          set({ wiring: undefined, preview: undefined });
          return;
        }
        const route = get().draftRoute();
        const end = route[route.length - 1]!;
        const { color, gauge } = get().wireStyle;
        const result = connect(
          docOf(get()),
          { a: wiring.from, b: toFree(end), color, gauge, bends: route.slice(1, -1) },
          ctx,
        );
        if (apply(result)) set({ wiring: undefined });
      },

      moveWireCursor(at, over) {
        const wiring = get().wiring;
        if (!wiring) return;
        const cursor = over ? terminalPosition(docOf(get()), registry, over) : snap(at);
        if (cursor.x === wiring.cursor.x && cursor.y === wiring.cursor.y && over === wiring.over) return;
        set({ wiring: { ...wiring, cursor, ...(over ? { over } : {}) } });
      },

      addBend(at) {
        const wiring = get().wiring;
        if (!wiring) return;
        const last = wiring.points[wiring.points.length - 1]!;
        const previous = wiring.points[wiring.points.length - 2];
        const target = snap(at);
        if (target.x === last.x && target.y === last.y) return;
        set({ wiring: { ...wiring, points: [...wiring.points, ...wirePathFrom(previous, last, target)] } });
      },

      undoBend() {
        const wiring = get().wiring;
        if (!wiring) return;
        if (wiring.points.length <= 1) {
          set({ wiring: undefined });
          return;
        }
        set({ wiring: { ...wiring, points: wiring.points.slice(0, -1) } });
      },

      draftRoute() {
        const wiring = get().wiring;
        if (!wiring) return [];
        const last = wiring.points[wiring.points.length - 1]!;
        const previous = wiring.points[wiring.points.length - 2];
        if (!wiring.over) return normalizeRoute([...wiring.points, ...wirePathFrom(previous, last, wiring.cursor)]);
        return routeTo(docOf(get()), registry, wiring, toTerminal(wiring.over));
      },

      finishWire(to) {
        const wiring = get().wiring;
        if (!wiring) return;
        const end = toTerminal(to);
        if (sameEnd(wiring.from, end)) {
          set({ wiring: undefined, preview: undefined });
          return;
        }
        const route = routeTo(docOf(get()), registry, wiring, end);
        const { color, gauge } = get().wireStyle;
        const bends = route.slice(1, -1);
        const result = connect(
          docOf(get()),
          { a: wiring.from, b: end, color, gauge, ...(bends.length > 0 ? { bends } : {}) },
          ctx,
        );
        if (apply(result)) set({ wiring: undefined });
      },

      beginDrag(origin) {
        const selection = selectionOf(get());
        if (selection.devices.length === 0 && selection.annotations.length === 0) return;
        set({
          drag: {
            devices: selection.devices,
            annotations: selection.annotations,
            origin: snap(origin),
            delta: { x: 0, y: 0 },
          },
        });
      },

      updateDrag(at) {
        const drag = get().drag;
        if (!drag) return;
        const p = snap(at);
        const delta = { x: p.x - drag.origin.x, y: p.y - drag.origin.y };
        if (delta.x === drag.delta.x && delta.y === drag.delta.y) return;
        const result = moveSelection(docOf(get()), { devices: drag.devices, annotations: drag.annotations, delta }, ctx);
        set({
          drag: { ...drag, delta },
          preview: {
            doc: result.doc,
            ok: result.ok,
            invalid: [...new Set(result.violations.flatMap((v) => [...(v.devices ?? []), ...(v.wires ?? [])]))],
          },
        });
      },

      endDrag() {
        const drag = get().drag;
        if (!drag) return;
        if (drag.delta.x === 0 && drag.delta.y === 0) {
          set({ drag: undefined, preview: undefined });
          return;
        }
        const result = moveSelection(
          docOf(get()),
          { devices: drag.devices, annotations: drag.annotations, delta: drag.delta },
          ctx,
        );
        if (!apply(result)) {
          // Soltar en una posición inválida devuelve todo a su lugar [R4 §1].
          set({ preview: undefined, status: { text: result.violations[0]?.code ?? 'INVALID', tone: 'warning' } });
        }
        set({ drag: undefined });
      },

      nudge(dx, dy) {
        const selection = selectionOf(get());
        if (selection.devices.length === 0 && selection.annotations.length === 0) return;
        apply(
          moveSelection(docOf(get()), { devices: selection.devices, annotations: selection.annotations, delta: { x: dx, y: dy } }, ctx),
        );
      },

      eraseAt(target) {
        const args =
          target.kind === 'device'
            ? { devices: [target.id] }
            : target.kind === 'wire'
              ? { wires: [target.id] }
              : { annotations: [target.id] };
        apply(remove(docOf(get()), args, ctx), { selection: EMPTY_SELECTION });
      },

      deleteSelection() {
        const selection = selectionOf(get());
        if (selection.devices.length === 0 && selection.wires.length === 0 && selection.annotations.length === 0) return;
        apply(
          remove(docOf(get()), { devices: selection.devices, wires: selection.wires, annotations: selection.annotations }, ctx),
          { selection: EMPTY_SELECTION },
        );
      },

      setProps(deviceId, props) {
        apply(setDeviceProps(docOf(get()), { deviceId, props }, ctx), { coalesceKey: `props:${deviceId}` });
      },

      copySelection() {
        const selection = selectionOf(get());
        if (selection.devices.length === 0 && selection.annotations.length === 0) return;
        clipboard = copyClip(docOf(get()), {
          devices: selection.devices,
          annotations: selection.annotations,
        });
      },

      paste() {
        if (!clipboard) return;
        pasteAt(clipboard, { x: PASTE_OFFSET, y: PASTE_OFFSET });
      },

      duplicateSelection() {
        const selection = selectionOf(get());
        if (selection.devices.length === 0 && selection.annotations.length === 0) return;
        const clip = copyClip(docOf(get()), { devices: selection.devices, annotations: selection.annotations });
        pasteAt(clip, { x: PASTE_OFFSET, y: PASTE_OFFSET });
      },

      setWireLook(color, gauge) {
        const selection = selectionOf(get());
        set({
          wireStyle: {
            color: color ?? get().wireStyle.color,
            gauge: gauge ?? get().wireStyle.gauge,
          },
        });
        if (selection.wires.length > 0) {
          apply(
            setWireStyle(docOf(get()), { wireIds: selection.wires, ...(color ? { color } : {}), ...(gauge ? { gauge } : {}) }, ctx),
          );
        }
      },

      dragWireSegment(wireId, segmentIndex, delta) {
        apply(moveWireSegment(docOf(get()), { wireId, segmentIndex, delta }, ctx));
      },

      previewWireSegment(wireId, segmentIndex, delta) {
        if (delta.x === 0 && delta.y === 0) {
          set({ preview: undefined });
          return;
        }
        const result = moveWireSegment(docOf(get()), { wireId, segmentIndex, delta }, ctx);
        set({
          preview: {
            doc: result.doc,
            ok: result.ok,
            invalid: [...new Set(result.violations.flatMap((v) => [...(v.devices ?? []), ...(v.wires ?? [])]))],
          },
        });
      },

      addText(at, text) {
        apply(addAnnotation(docOf(get()), snap(at), text, ctx));
      },

      editText(id, text) {
        apply(setAnnotationText(docOf(get()), id, text, ctx), { coalesceKey: `text:${id}` });
      },

      undo() {
        clearTransient();
        set({ history: undo(get().history) });
      },

      redo() {
        clearTransient();
        set({ history: redo(get().history) });
      },

      canUndo: () => canUndo(get().history),
      canRedo: () => canRedo(get().history),

      setViewport(viewport) {
        set({ viewport: { ...get().viewport, ...viewport } });
      },

      fitView(size) {
        const box = contentBounds(docOf(get()), registry);
        if (!box) {
          set({ viewport: { pan: { x: size.width / 2, y: size.height / 2 }, zoom: DEFAULT_ZOOM } });
          return;
        }
        const margin = 4;
        const w = box.maxX - box.minX + margin * 2;
        const h = box.maxY - box.minY + margin * 2;
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(size.width / (w * GRID_PX), size.height / (h * GRID_PX))));
        set({
          viewport: {
            zoom,
            pan: {
              x: size.width / 2 - ((box.minX + box.maxX) / 2) * GRID_PX * zoom,
              y: size.height / 2 - ((box.minY + box.maxY) / 2) * GRID_PX * zoom,
            },
          },
        });
      },

      loadDocument(doc) {
        clearTransient();
        engine = null;
        set({
          history: createHistory<BoardSnapshotState>({ doc, selection: EMPTY_SELECTION }),
          mode: 'edit',
          sim: null,
        });
      },

      diagnostics: () => computeDiagnostics(docOf(get()), registry),

      startSim() {
        clearTransient();
        const blocking = blockingDiagnostics(computeDiagnostics(docOf(get()), registry));
        if (blocking.length > 0) {
          set({ status: { text: String(blocking.length), tone: 'error' } });
          return;
        }
        engine = new BoardSimEngine(docOf(get()), registry);
        const snapshot = engine.start();
        set({ mode: snapshot.mode === 'error' ? 'error' : 'simulating', sim: snapshot });
      },

      stopSim() {
        engine = null;
        set({ mode: 'edit', sim: null });
      },

      backToEdit() {
        engine = null;
        set({ mode: 'edit', sim: null });
      },

      setSpeed(speed) {
        set({ speed });
      },

      advance(elapsedMs) {
        if (!engine || get().mode !== 'simulating') return;
        engine.advanceTo(elapsedMs);
        const snapshot = engine.snapshot();
        set({ sim: snapshot, ...(snapshot.mode === 'error' ? { mode: 'error' as Mode } : {}) });
      },

      pressDevice(id) {
        if (!engine) return;
        engine.press(id);
        const snapshot = engine.snapshot();
        set({ sim: snapshot, ...(snapshot.mode === 'error' ? { mode: 'error' as Mode } : {}) });
      },

      releaseDevice(id) {
        if (!engine) return;
        engine.release(id);
        set({ sim: engine.snapshot() });
      },

      toggleDevice(id) {
        if (!engine) return;
        engine.toggle(id);
        const snapshot = engine.snapshot();
        set({ sim: snapshot, ...(snapshot.mode === 'error' ? { mode: 'error' as Mode } : {}) });
      },
    };
  });
}
