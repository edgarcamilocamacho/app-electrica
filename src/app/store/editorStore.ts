import { createStore, type StoreApi } from 'zustand/vanilla';
import { computeDiagnostics, type Diagnostic } from '../../core/diagnostics/diagnostics';
import { canRedo, canUndo, commit, createHistory, redo, replacePresent, undo, type History } from '../../core/history/history';
import { componentBounds, createEmptyDocument, vertexPosition, type OpContext } from '../../core/model/document';
import { rotateOffset } from '../../core/model/geometry';
import { nextContactRef, usedRefs } from '../../core/model/refs';
import { EMPTY_SELECTION, selectionSize, type Selection } from '../../core/model/selection';
import type { CircuitDocument, Id, Point, Rotation } from '../../core/model/types';
import { parseDocument, serializeDocument } from '../../core/persistence/serialize';
import { SimEngine, type SimSnapshot } from '../../core/sim/engine';
import { classifyVertices, type VertexClass } from '../../core/topology/classify';
import { copyFragment, pasteFragment, type Fragment } from '../../core/topology/clipboard';
import {
  addAnnotation,
  deleteSelection,
  drawWire,
  eraseTarget,
  moveSegment,
  moveSelection,
  placeComponent,
  rotateComponent,
  updateAnnotationText,
  updateComponentProps,
  type EditResult,
} from '../../core/topology/ops';
import { hasConnectionTargetAt } from '../../core/topology/query';
import type { Violation } from '../../core/topology/validity';
import { buildExample, type ExampleId } from '../../examples';
import type { Clock } from '../../platform/clock';
import type { MessageKey, MessageParams } from '../i18n/t';
import { t } from '../i18n/t';
import { annotationBounds, hitTest, pickComponent, pickForErase, pickForSelect } from '../input/hitTest';

// ── Constantes de vista ─────────────────────────────────────────────────────────────────────

export const GRID_PX = 10;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const DEFAULT_ZOOM = 1.5;
export const SPEEDS = [0.25, 1, 4] as const;
export type Speed = (typeof SPEEDS)[number];

// ── Tipos de estado ─────────────────────────────────────────────────────────────────────────

export interface Snapshot {
  readonly doc: CircuitDocument;
  readonly selection: Selection;
}

export interface Carry {
  readonly selection: Selection;
  readonly anchor: Point;
  readonly delta: Point;
  readonly rotationSteps: number;
  /** Mover un único segmento: solo en su eje perpendicular (R2 §3). */
  readonly segment?: { readonly id: Id; readonly axis: 'H' | 'V' };
  /** Pegar / duplicar: el fragmento todavía no está en el documento. */
  readonly fragment?: Fragment;
}

export type Tool =
  | { readonly kind: 'select' }
  | { readonly kind: 'place'; readonly type: string; readonly rotation: Rotation }
  | { readonly kind: 'move'; readonly carry?: Carry }
  | { readonly kind: 'wire'; readonly points: readonly Point[] }
  | { readonly kind: 'erase' }
  | { readonly kind: 'text' };

export type ToolKind = Tool['kind'];

export interface Preview {
  readonly doc: CircuitDocument;
  readonly ok: boolean;
  readonly violations: readonly Violation[];
  readonly reason?: string;
  /** Componentes que se están colocando o moviendo (se dibujan resaltados). */
  readonly active: readonly Id[];
}

export interface Viewport {
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}

export type Tone = 'info' | 'warning' | 'error';

export interface StatusMessage {
  readonly key: MessageKey;
  readonly params?: MessageParams;
  readonly tone: Tone;
}

export interface ToastAction {
  readonly key: MessageKey;
  readonly run: () => void;
}

export interface Toast {
  readonly id: number;
  readonly key: MessageKey;
  readonly params?: MessageParams;
  readonly actions: readonly ToastAction[];
}

interface SimRuntime {
  readonly engine: SimEngine;
  baseSim: number;
  baseWall: number;
  pressed: Id | null;
  lastUiUpdate: number;
  lagging: boolean;
}

export interface FileState {
  readonly name: string;
  readonly handle?: unknown;
  readonly dirty: boolean;
}

export type Mode = 'edit' | 'simulating' | 'error';

export interface EditorDeps {
  readonly ctx: OpContext;
  readonly clock: Clock;
  /** Reloj de pared para metadatos y coalescencia. */
  readonly now: () => number;
  readonly confirm: (message: string) => boolean;
  /** Integración con archivos (se inyecta para poder probar sin DOM). */
  readonly files?: {
    open(): Promise<{ text: string; fileName: string; handle?: unknown } | null>;
    save(text: string, name: string, handle: unknown, forcePicker: boolean): Promise<{ fileName: string; handle?: unknown } | null>;
  };
}

export interface EditorState {
  readonly history: History<Snapshot>;
  readonly diagnostics: readonly Diagnostic[];
  readonly vertexClasses: ReadonlyMap<Id, VertexClass>;
  readonly mode: Mode;
  readonly tool: Tool;
  readonly viewport: Viewport;
  readonly canvasSize: { readonly width: number; readonly height: number };
  readonly pointer: Point | null;
  readonly preview: Preview | null;
  readonly rubberBand: { readonly a: Point; readonly b: Point } | null;
  readonly simSnapshot: SimSnapshot | null;
  readonly simLagging: boolean;
  readonly speed: Speed;
  readonly message: StatusMessage | null;
  readonly file: FileState;
  readonly clipboard: Fragment | null;
  readonly toasts: readonly Toast[];
  readonly focusDiagnostics: number;
  readonly focusText: number;

  // Herramientas y edición
  setTool(kind: ToolKind): void;
  startPlacing(type: string): void;
  cancel(): void;
  pointerMove(p: Point): void;
  pointerDown(p: Point, opts: { shift: boolean }): void;
  pointerUp(p: Point): void;
  pointerLeave(): void;
  wireFinish(): void;
  wireBack(): void;
  rotate(): void;
  deleteSelection(): void;
  selectAll(): void;
  setSelection(sel: Selection): void;
  undo(): void;
  redo(): void;
  copy(): void;
  paste(): void;
  duplicate(): void;
  updateProps(componentId: Id, patch: Record<string, unknown>): void;
  updateAnnotation(annotationId: Id, text: string): void;

  // Vista
  setCanvasSize(width: number, height: number): void;
  zoomAt(screen: Point, factor: number): void;
  panBy(dx: number, dy: number): void;
  fitView(): void;
  resetZoom(): void;
  focusOn(p: Point): void;

  // Simulación
  toggleSimulation(): void;
  startSimulation(): void;
  stopSimulation(): void;
  exitError(): void;
  setSpeed(speed: Speed): void;
  simTick(): void;
  simPointerDown(p: Point): void;
  simPointerUp(): void;

  // Archivos
  newDocument(): void;
  loadDocument(doc: CircuitDocument, fileName: string, handle?: unknown): void;
  loadText(text: string, fileName: string, handle?: unknown): boolean;
  loadExample(id: ExampleId): void;
  openFile(): Promise<void>;
  save(forcePicker?: boolean): Promise<void>;

  // Avisos
  showMessage(key: MessageKey, params?: MessageParams, tone?: Tone): void;
  pushToast(key: MessageKey, actions?: readonly ToastAction[], params?: MessageParams): void;
  dismissToast(id: number): void;
}

export type EditorStore = StoreApi<EditorState>;

// ── Utilidades ──────────────────────────────────────────────────────────────────────────────

export const snap = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });
const sameP = (a: Point | undefined, b: Point | undefined) => !!a && !!b && a.x === b.x && a.y === b.y;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const docOf = (s: EditorState): CircuitDocument => s.history.present.doc;
export const selectionOfState = (s: EditorState): Selection => s.history.present.selection;

export function screenToWorld(v: Viewport, p: Point): Point {
  const k = GRID_PX * v.zoom;
  return { x: (p.x - v.panX) / k, y: (p.y - v.panY) / k };
}

export function worldToScreen(v: Viewport, p: Point): Point {
  const k = GRID_PX * v.zoom;
  return { x: p.x * k + v.panX, y: p.y * k + v.panY };
}

/** Tramo en L del último punto fijo al cursor (primero en el eje de mayor desplazamiento). */
export function wirePath(from: Point, to: Point): Point[] {
  if (from.x === to.x || from.y === to.y) return [to];
  return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? [{ x: to.x, y: from.y }, to] : [{ x: from.x, y: to.y }, to];
}

export function contentBounds(doc: CircuitDocument, ctx: Pick<OpContext, 'registry'>) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of Object.values(doc.components)) {
    const b = componentBounds(c, ctx.registry);
    xs.push(b.minX, b.maxX);
    ys.push(b.minY, b.maxY);
  }
  for (const v of Object.values(doc.vertices)) {
    const p = vertexPosition(doc, v, ctx.registry);
    xs.push(p.x);
    ys.push(p.y);
  }
  for (const n of Object.values(doc.annotations)) {
    const b = annotationBounds(n);
    xs.push(b.minX, b.maxX);
    ys.push(b.minY, b.maxY);
  }
  if (xs.length === 0) return undefined;
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function reasonKey(result: EditResult): MessageKey {
  return result.reason === 'NO_ROUTE' ? 'messages.invalidNoRoute' : 'messages.invalidPlacement';
}

// ── Fábrica ─────────────────────────────────────────────────────────────────────────────────

export function createEditorStore(deps: EditorDeps, initial?: CircuitDocument): EditorStore {
  const { ctx } = deps;
  let sim: SimRuntime | null = null;
  let toastSeq = 0;

  const newDoc = () => createEmptyDocument('', new Date(deps.now()).toISOString());

  return createStore<EditorState>()((set, get) => {
    const derived = (doc: CircuitDocument) => ({
      diagnostics: computeDiagnostics(doc, ctx.registry),
      vertexClasses: classifyVertices(doc, ctx.registry),
    });

    const startDoc = initial ?? newDoc();

    const doc = () => docOf(get());
    const selection = () => selectionOfState(get());
    const isEditing = () => get().mode === 'edit';

    /** Confirma un documento nuevo en el historial (una entrada). */
    const commitDoc = (next: CircuitDocument, sel?: Selection, coalesceKey?: string) => {
      const s = get();
      if (next === docOf(s) && !sel) return;
      const history = commit(s.history, { doc: next, selection: sel ?? pruneSelection(next, selectionOfState(s)) }, {
        now: deps.now(),
        ...(coalesceKey ? { coalesceKey } : {}),
      });
      set({ history, ...derived(next), file: { ...s.file, dirty: true } });
    };

    const pruneSelection = (d: CircuitDocument, sel: Selection): Selection => ({
      components: sel.components.filter((id) => d.components[id]),
      segments: sel.segments.filter((id) => d.segments[id]),
      annotations: sel.annotations.filter((id) => d.annotations[id]),
    });

    const setSel = (sel: Selection) => set({ history: replacePresent(get().history, { doc: doc(), selection: sel }) });

    const message = (key: MessageKey, params?: MessageParams, tone: Tone = 'info') =>
      set({ message: { key, ...(params ? { params } : {}), tone } });

    const tolerance = () => {
      const k = GRID_PX * get().viewport.zoom;
      return { vertex: 7 / k, segment: 5 / k };
    };

    const hitsAt = (p: Point) => hitTest(doc(), ctx.registry, get().vertexClasses, p, tolerance());

    // ── Vista previa por herramienta ────────────────────────────────────────────────────────

    const carryPreview = (carry: Carry): Preview => {
      const d = doc();
      let r: EditResult;
      let active: Id[] = [...carry.selection.components];
      if (carry.fragment) {
        const pr = pasteFragment(d, carry.fragment, carry.delta, ctx);
        r = pr;
        active = [...pr.selection.components];
      } else if (carry.segment) {
        const offset = carry.segment.axis === 'H' ? carry.delta.y : carry.delta.x;
        r = moveSegment(d, carry.segment.id, offset, ctx);
      } else {
        r = moveSelection(d, carry.selection, carry.delta, ctx, { rotationSteps: carry.rotationSteps });
      }
      return { doc: r.doc, ok: r.ok, violations: r.violations, ...(r.reason ? { reason: r.reason } : {}), active };
    };

    const updatePreview = () => {
      const s = get();
      const tool = s.tool;
      const p = s.pointer ? snap(s.pointer) : undefined;
      if (tool.kind === 'place' && p) {
        const r = placeComponent(doc(), { type: tool.type, position: p, rotation: tool.rotation }, ctx);
        set({ preview: { doc: r.doc, ok: r.ok, violations: r.violations, active: r.componentId ? [r.componentId] : [], ...(r.reason ? { reason: r.reason } : {}) } });
      } else if (tool.kind === 'move' && tool.carry) {
        set({ preview: carryPreview(tool.carry) });
      } else if (tool.kind === 'wire' && tool.points.length > 0 && p) {
        const last = tool.points[tool.points.length - 1]!;
        const pts = [...tool.points, ...wirePath(last, p)];
        if (pts.length < 2 || (pts.length === 2 && sameP(pts[0], pts[1]))) {
          set({ preview: null });
          return;
        }
        const r = drawWire(doc(), pts, ctx);
        set({ preview: { doc: r.doc, ok: r.ok, violations: r.violations, active: [], ...(r.reason ? { reason: r.reason } : {}) } });
      } else if (s.preview) {
        set({ preview: null });
      }
    };

    const clearTransient = () => set({ preview: null, rubberBand: null });

    // ── Acciones de herramientas ────────────────────────────────────────────────────────────

    const pickUp = (p: Point) => {
      const hit = pickForSelect(hitsAt(p));
      if (!hit) return;
      const current = selection();
      const inSelection =
        (hit.kind === 'component' && current.components.includes(hit.id)) ||
        (hit.kind === 'segment' && current.segments.includes(hit.id)) ||
        (hit.kind === 'annotation' && current.annotations.includes(hit.id));
      const sel: Selection = inSelection
        ? current
        : {
            components: hit.kind === 'component' ? [hit.id] : [],
            segments: hit.kind === 'segment' ? [hit.id] : [],
            annotations: hit.kind === 'annotation' ? [hit.id] : [],
          };
      if (!inSelection) setSel(sel);
      let segment: Carry['segment'];
      if (sel.segments.length === 1 && sel.components.length === 0 && sel.annotations.length === 0) {
        const s = doc().segments[sel.segments[0]!]!;
        const a = vertexPosition(doc(), doc().vertices[s.a]!, ctx.registry);
        const b = vertexPosition(doc(), doc().vertices[s.b]!, ctx.registry);
        segment = { id: s.id, axis: a.y === b.y ? 'H' : 'V' };
      }
      const carry: Carry = { selection: sel, anchor: snap(p), delta: { x: 0, y: 0 }, rotationSteps: 0, ...(segment ? { segment } : {}) };
      set({ tool: { kind: 'move', carry }, message: { key: 'messages.carrying', tone: 'info' } });
      updatePreview();
    };

    const drop = () => {
      const s = get();
      if (s.tool.kind !== 'move' || !s.tool.carry) return;
      const carry = s.tool.carry;
      const still = carry.delta.x === 0 && carry.delta.y === 0 && carry.rotationSteps === 0 && !carry.fragment;
      if (still) {
        set({ tool: { kind: 'move' }, preview: null, message: null });
        return;
      }
      const preview = s.preview ?? carryPreview(carry);
      if (!preview.ok) {
        message(preview.reason === 'NO_ROUTE' ? 'messages.invalidNoRoute' : 'messages.invalidPlacement', undefined, 'warning');
        return;
      }
      let sel = pruneSelection(preview.doc, carry.selection);
      if (carry.fragment) sel = pasteFragment(doc(), carry.fragment, carry.delta, ctx).selection;
      commitDoc(preview.doc, sel);
      set({ tool: { kind: 'move' }, preview: null, message: null });
    };

    const wireClick = (c: Point) => {
      const tool = get().tool;
      if (tool.kind !== 'wire') return;
      if (tool.points.length === 0) {
        set({ tool: { kind: 'wire', points: [c] } });
        return;
      }
      const last = tool.points[tool.points.length - 1]!;
      if (sameP(last, c)) {
        finishWire([...tool.points]);
        return;
      }
      const full = [...tool.points, ...wirePath(last, c)];
      if (hasConnectionTargetAt(doc(), c, ctx.registry)) finishWire(full);
      else {
        set({ tool: { kind: 'wire', points: full } });
        updatePreview();
      }
    };

    const finishWire = (points: Point[]) => {
      if (points.length < 2) {
        set({ tool: { kind: 'wire', points: [] }, preview: null });
        return;
      }
      const r = drawWire(doc(), points, ctx);
      if (!r.ok) {
        message('messages.invalidWire', undefined, 'warning');
        return;
      }
      // Sin selección: así un clic posterior con Mover toma solo el tramo clicado.
      commitDoc(r.doc, EMPTY_SELECTION);
      set({ tool: { kind: 'wire', points: [] }, preview: null, message: null });
    };

    const eraseAt = (p: Point) => {
      const hit = pickForErase(doc(), hitsAt(p));
      if (!hit) return;
      const r = eraseTarget(doc(), { kind: hit.kind, id: hit.id }, ctx);
      if (r.ok) commitDoc(r.doc, EMPTY_SELECTION); // un clic = una entrada (R2 §12)
    };

    const selectAt = (p: Point, shift: boolean) => {
      const hit = pickForSelect(hitsAt(p));
      const current = selection();
      if (!hit) {
        if (!shift) setSel(EMPTY_SELECTION);
        set({ rubberBand: { a: p, b: p } });
        return;
      }
      const key = hit.kind === 'component' ? 'components' : hit.kind === 'segment' ? 'segments' : 'annotations';
      if (shift) {
        const list = current[key];
        const next = list.includes(hit.id) ? list.filter((id) => id !== hit.id) : [...list, hit.id];
        setSel({ ...current, [key]: next });
      } else {
        setSel({ ...EMPTY_SELECTION, [key]: [hit.id] });
      }
    };

    const finishRubberBand = () => {
      const rb = get().rubberBand;
      if (!rb) return;
      set({ rubberBand: null });
      const minX = Math.min(rb.a.x, rb.b.x);
      const maxX = Math.max(rb.a.x, rb.b.x);
      const minY = Math.min(rb.a.y, rb.b.y);
      const maxY = Math.max(rb.a.y, rb.b.y);
      if (maxX - minX < 0.2 && maxY - minY < 0.2) return;
      const inside = (p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
      const d = doc();
      const components = Object.values(d.components)
        .filter((c) => {
          const b = componentBounds(c, ctx.registry);
          return inside({ x: b.minX, y: b.minY }) && inside({ x: b.maxX, y: b.maxY });
        })
        .map((c) => c.id);
      const segments = Object.values(d.segments)
        .filter((s) => inside(vertexPosition(d, d.vertices[s.a]!, ctx.registry)) && inside(vertexPosition(d, d.vertices[s.b]!, ctx.registry)))
        .map((s) => s.id);
      const annotations = Object.values(d.annotations)
        .filter((n) => inside(n.position))
        .map((n) => n.id);
      setSel({ components, segments, annotations });
    };

    const startCarryFragment = (fragment: Fragment) => {
      const cursor = get().pointer;
      const delta = cursor
        ? { x: snap(cursor).x - fragment.origin.x, y: snap(cursor).y - fragment.origin.y }
        : { x: 2, y: 2 };
      const carry: Carry = { selection: EMPTY_SELECTION, anchor: fragment.origin, delta, rotationSteps: 0, fragment };
      set({ tool: { kind: 'move', carry }, message: { key: 'messages.carrying', tone: 'info' } });
      updatePreview();
    };

    // ── Simulación ──────────────────────────────────────────────────────────────────────────

    const publishSim = (force: boolean) => {
      if (!sim) return;
      const now = deps.clock.now();
      const snapNow = sim.engine.snapshot();
      const modeChanged = snapNow.mode === 'error' && get().mode !== 'error';
      if (force || modeChanged || now - sim.lastUiUpdate >= 100) {
        sim.lastUiUpdate = now;
        set({ simSnapshot: snapNow, simLagging: sim.lagging, ...(modeChanged ? { mode: 'error' as const } : {}) });
      }
    };

    return {
      history: createHistory<Snapshot>({ doc: startDoc, selection: EMPTY_SELECTION }),
      ...derived(startDoc),
      mode: 'edit',
      tool: { kind: 'select' },
      viewport: { panX: 0, panY: 0, zoom: DEFAULT_ZOOM },
      canvasSize: { width: 0, height: 0 },
      pointer: null,
      preview: null,
      rubberBand: null,
      simSnapshot: null,
      simLagging: false,
      speed: 1,
      message: null,
      file: { name: startDoc.metadata.name, dirty: false },
      clipboard: null,
      toasts: [],
      focusDiagnostics: 0,
      focusText: 0,

      setTool(kind) {
        if (!isEditing()) return;
        clearTransient();
        const tool: Tool =
          kind === 'wire' ? { kind: 'wire', points: [] } : kind === 'place' ? get().tool : kind === 'move' ? { kind: 'move' } : { kind } as Tool;
        const hint: Partial<Record<ToolKind, MessageKey>> = {
          wire: 'messages.wireHint',
          move: 'messages.moveHint',
          erase: 'messages.eraseHint',
          text: 'messages.textHint',
        };
        const key = hint[kind];
        set({ tool, message: key ? { key, tone: 'info' } : null });
      },

      startPlacing(type) {
        if (!isEditing()) return;
        const rotation = get().tool.kind === 'place' ? (get().tool as { rotation: Rotation }).rotation : 0;
        set({ tool: { kind: 'place', type, rotation }, message: null });
        updatePreview();
      },

      cancel() {
        const s = get();
        if (s.rubberBand) {
          set({ rubberBand: null });
          return;
        }
        if (s.tool.kind === 'move' && s.tool.carry) {
          set({ tool: { kind: 'move' }, preview: null, message: null });
          return;
        }
        if (s.tool.kind === 'wire' && s.tool.points.length > 0) {
          set({ tool: { kind: 'wire', points: [] }, preview: null });
          return;
        }
        if (s.tool.kind !== 'select') {
          set({ tool: { kind: 'select' }, preview: null, message: null });
          return;
        }
        if (selectionSize(selection()) > 0) setSel(EMPTY_SELECTION);
      },

      pointerMove(p) {
        const s = get();
        const prev = s.pointer ? snap(s.pointer) : undefined;
        set({ pointer: p });
        if (s.rubberBand) {
          set({ rubberBand: { a: s.rubberBand.a, b: p } });
          return;
        }
        if (!isEditing()) return;
        const c = snap(p);
        if (sameP(prev, c) && s.preview) return; // solo se recalcula al cambiar de celda
        const tool = s.tool;
        if (tool.kind === 'move' && tool.carry) {
          const raw = { x: c.x - tool.carry.anchor.x, y: c.y - tool.carry.anchor.y };
          const delta = tool.carry.segment ? (tool.carry.segment.axis === 'H' ? { x: 0, y: raw.y } : { x: raw.x, y: 0 }) : raw;
          if (!sameP(delta, tool.carry.delta) || !s.preview) set({ tool: { kind: 'move', carry: { ...tool.carry, delta } } });
        }
        updatePreview();
      },

      pointerDown(p, { shift }) {
        if (!isEditing()) {
          get().simPointerDown(p);
          return;
        }
        const tool = get().tool;
        switch (tool.kind) {
          case 'select':
            selectAt(p, shift);
            break;
          case 'place': {
            const r = placeComponent(doc(), { type: tool.type, position: snap(p), rotation: tool.rotation }, ctx);
            if (r.ok) {
              commitDoc(r.doc, { ...EMPTY_SELECTION, components: r.componentId ? [r.componentId] : [] });
              set({ message: null });
              updatePreview();
            } else message(reasonKey(r), undefined, 'warning');
            break;
          }
          case 'move':
            if (tool.carry) drop();
            else pickUp(p);
            break;
          case 'wire':
            wireClick(snap(p));
            break;
          case 'erase':
            eraseAt(p);
            break;
          case 'text': {
            const { doc: next, id } = addAnnotation(doc(), snap(p), t('annotation.default'), ctx);
            commitDoc(next, { ...EMPTY_SELECTION, annotations: [id] });
            set({ tool: { kind: 'select' }, message: null, focusText: get().focusText + 1 });
            break;
          }
        }
      },

      pointerUp() {
        if (get().rubberBand) finishRubberBand();
        if (!isEditing()) get().simPointerUp();
      },

      pointerLeave() {
        set({ pointer: null });
        const tool = get().tool;
        if (tool.kind === 'place' || (tool.kind === 'wire' && tool.points.length > 0)) set({ preview: null });
      },

      wireFinish() {
        const s = get();
        if (s.tool.kind !== 'wire' || s.tool.points.length === 0) return;
        const last = s.tool.points[s.tool.points.length - 1]!;
        const p = s.pointer ? snap(s.pointer) : last;
        finishWire([...s.tool.points, ...(sameP(last, p) ? [] : wirePath(last, p))]);
      },

      wireBack() {
        const tool = get().tool;
        if (tool.kind !== 'wire' || tool.points.length === 0) return;
        set({ tool: { kind: 'wire', points: tool.points.slice(0, -1) } });
        updatePreview();
      },

      rotate() {
        if (!isEditing()) return;
        const tool = get().tool;
        if (tool.kind === 'place') {
          set({ tool: { ...tool, rotation: ((tool.rotation + 90) % 360) as Rotation } });
          updatePreview();
          return;
        }
        if (tool.kind === 'move' && tool.carry) {
          const c = tool.carry;
          if (c.fragment || c.segment || c.selection.components.length !== 1 || c.selection.segments.length + c.selection.annotations.length > 0) {
            message('messages.groupRotateDisabled', undefined, 'warning');
            return;
          }
          set({ tool: { kind: 'move', carry: { ...c, rotationSteps: (c.rotationSteps + 1) % 4 } } });
          updatePreview();
          return;
        }
        const sel = selection();
        if (sel.components.length === 1 && sel.segments.length === 0 && sel.annotations.length === 0) {
          const r = rotateComponent(doc(), sel.components[0]!, ctx);
          if (r.ok) commitDoc(r.doc, sel);
          else message('messages.rotateRejected', undefined, 'warning');
        } else if (selectionSize(sel) > 1) {
          message('messages.groupRotateDisabled', undefined, 'warning');
        }
      },

      deleteSelection() {
        if (!isEditing()) return;
        const sel = selection();
        if (selectionSize(sel) === 0) return;
        const r = deleteSelection(doc(), sel, ctx);
        if (r.ok) commitDoc(r.doc, EMPTY_SELECTION);
      },

      selectAll() {
        const d = doc();
        setSel({ components: Object.keys(d.components), segments: Object.keys(d.segments), annotations: Object.keys(d.annotations) });
      },

      setSelection(sel) {
        setSel(sel);
      },

      undo() {
        if (!isEditing()) return;
        get().cancel();
        const s = get();
        if (!canUndo(s.history)) return;
        const history = undo(s.history);
        set({ history, ...derived(history.present.doc), preview: null, file: { ...s.file, dirty: true } });
      },

      redo() {
        if (!isEditing()) return;
        const s = get();
        if (!canRedo(s.history)) return;
        const history = redo(s.history);
        set({ history, ...derived(history.present.doc), preview: null, file: { ...s.file, dirty: true } });
      },

      copy() {
        const fragment = copyFragment(doc(), selection(), ctx.registry);
        if (!fragment) {
          message('messages.nothingToCopy', undefined, 'info');
          return;
        }
        set({ clipboard: fragment });
        message('messages.copied', { count: selectionSize(selection()) });
      },

      paste() {
        if (!isEditing()) return;
        const fragment = get().clipboard;
        if (fragment) startCarryFragment(fragment);
      },

      duplicate() {
        if (!isEditing()) return;
        const fragment = copyFragment(doc(), selection(), ctx.registry);
        if (fragment) startCarryFragment(fragment);
      },

      updateProps(componentId, patch) {
        if (!isEditing()) return;
        const d = doc();
        const c = d.components[componentId];
        if (!c) return;
        const effective: Record<string, unknown> = { ...patch };
        // Al vincular un contacto, su referencia sigue al vínculo (K1 → K1.1) si estaba vacía o derivada.
        if (typeof patch.link === 'string' && ctx.registry.require(c.type).behavior.kind === 'contact') {
          const oldLink = typeof c.props.link === 'string' ? c.props.link : '';
          const ref = typeof c.props.ref === 'string' ? c.props.ref : '';
          if (patch.link && (ref === '' || (oldLink !== '' && ref.startsWith(`${oldLink}.`)))) {
            const used = usedRefs({ ...d, components: Object.fromEntries(Object.entries(d.components).filter(([id]) => id !== componentId)) });
            effective.ref = nextContactRef(patch.link, used);
          }
        }
        const next = updateComponentProps(d, componentId, effective, ctx);
        if (next !== d) commitDoc(next, undefined, `props:${componentId}:${Object.keys(patch).join(',')}`);
      },

      updateAnnotation(annotationId, text) {
        if (!isEditing()) return;
        const next = updateAnnotationText(doc(), annotationId, text);
        if (next !== doc()) commitDoc(next, undefined, `text:${annotationId}`);
      },

      // ── Vista ────────────────────────────────────────────────────────────────────────────

      setCanvasSize(width, height) {
        const s = get();
        const first = s.canvasSize.width === 0 && width > 0;
        set({ canvasSize: { width, height } });
        if (first) {
          if (contentBounds(doc(), ctx)) get().fitView();
          else set({ viewport: { ...s.viewport, panX: width / 2, panY: height / 2 } });
        }
      },

      zoomAt(screen, factor) {
        const v = get().viewport;
        const zoom = clampZoom(v.zoom * factor);
        const w = screenToWorld(v, screen);
        const k = GRID_PX * zoom;
        set({ viewport: { zoom, panX: screen.x - w.x * k, panY: screen.y - w.y * k } });
      },

      panBy(dx, dy) {
        const v = get().viewport;
        set({ viewport: { ...v, panX: v.panX + dx, panY: v.panY + dy } });
      },

      fitView() {
        const s = get();
        const b = contentBounds(doc(), ctx);
        const { width, height } = s.canvasSize;
        if (!b || width === 0) {
          set({ viewport: { zoom: DEFAULT_ZOOM, panX: width / 2, panY: height / 2 } });
          return;
        }
        const margin = 60;
        const bw = Math.max(1, b.maxX - b.minX);
        const bh = Math.max(1, b.maxY - b.minY);
        const zoom = clampZoom(Math.min((width - 2 * margin) / (bw * GRID_PX), (height - 2 * margin) / (bh * GRID_PX), 3));
        const k = GRID_PX * zoom;
        const cx = (b.minX + b.maxX) / 2;
        const cy = (b.minY + b.maxY) / 2;
        set({ viewport: { zoom, panX: width / 2 - cx * k, panY: height / 2 - cy * k } });
      },

      resetZoom() {
        const { width, height } = get().canvasSize;
        const v = get().viewport;
        get().zoomAt({ x: width / 2, y: height / 2 }, 1 / v.zoom);
      },

      focusOn(p) {
        const { width, height } = get().canvasSize;
        const v = get().viewport;
        const k = GRID_PX * v.zoom;
        set({ viewport: { ...v, panX: width / 2 - p.x * k, panY: height / 2 - p.y * k } });
      },

      // ── Simulación ───────────────────────────────────────────────────────────────────────

      toggleSimulation() {
        const mode = get().mode;
        if (mode === 'edit') get().startSimulation();
        else if (mode === 'simulating') get().stopSimulation();
      },

      startSimulation() {
        const s = get();
        if (s.mode !== 'edit') return;
        const blocking = s.diagnostics.filter((d) => d.severity === 'blocking');
        if (blocking.length > 0) {
          set({ message: { key: 'messages.cannotSimulate', params: { count: blocking.length }, tone: 'error' }, focusDiagnostics: s.focusDiagnostics + 1 });
          return;
        }
        const engine = new SimEngine(doc(), ctx.registry);
        const snapshot = engine.start();
        const now = deps.clock.now();
        sim = { engine, baseSim: 0, baseWall: now, pressed: null, lastUiUpdate: now, lagging: false };
        set({
          mode: snapshot.mode === 'error' ? 'error' : 'simulating',
          simSnapshot: snapshot,
          simLagging: false,
          tool: { kind: 'select' },
          preview: null,
          rubberBand: null,
          message: null,
        });
      },

      stopSimulation() {
        if (get().mode !== 'simulating') return;
        sim = null;
        set({ mode: 'edit', simSnapshot: null, simLagging: false });
      },

      exitError() {
        if (get().mode !== 'error') return;
        sim = null;
        set({ mode: 'edit', simSnapshot: null, simLagging: false });
      },

      setSpeed(speed) {
        if (sim) {
          sim.baseSim = sim.engine.clockMs;
          sim.baseWall = deps.clock.now();
        }
        set({ speed });
      },

      simTick() {
        if (!sim || get().mode !== 'simulating') return;
        const target = sim.baseSim + (deps.clock.now() - sim.baseWall) * get().speed;
        sim.lagging = !sim.engine.advanceTo(Math.floor(target));
        publishSim(false);
      },

      simPointerDown(p) {
        if (!sim) return;
        const id = pickComponent(hitsAt(p));
        if (get().mode === 'simulating' && id) {
          const device = sim.engine.model.byId.get(id);
          if (device?.kind === 'switch') {
            if (device.action === 'momentary') {
              sim.engine.press(id);
              sim.pressed = id;
            } else sim.engine.toggle(id);
            publishSim(true);
            return;
          }
          if (device?.kind === 'selector') {
            const c = doc().components[id]!;
            const local = rotateOffset({ x: p.x - c.position.x, y: p.y - c.position.y }, ((360 - c.rotation) % 360) as Rotation);
            sim.engine.setSelector(id, local.x < -1 ? 1 : local.x > 1 ? 2 : 0);
            publishSim(true);
            return;
          }
        }
        // Inspección: seleccionar sin editar.
        const hit = pickForSelect(hitsAt(p));
        if (!hit) setSel(EMPTY_SELECTION);
        else setSel({ ...EMPTY_SELECTION, [hit.kind === 'component' ? 'components' : hit.kind === 'segment' ? 'segments' : 'annotations']: [hit.id] });
      },

      simPointerUp() {
        if (!sim || !sim.pressed) return;
        sim.engine.release(sim.pressed);
        sim.pressed = null;
        publishSim(true);
      },

      // ── Archivos ─────────────────────────────────────────────────────────────────────────

      newDocument() {
        if (get().file.dirty && !deps.confirm(t('menu.confirmDiscard'))) return;
        get().loadDocument(newDoc(), '');
      },

      loadDocument(next, fileName, handle) {
        sim = null;
        set({
          history: createHistory<Snapshot>({ doc: next, selection: EMPTY_SELECTION }),
          ...derived(next),
          mode: 'edit',
          simSnapshot: null,
          tool: { kind: 'select' },
          preview: null,
          rubberBand: null,
          file: { name: fileName || next.metadata.name, dirty: false, ...(handle ? { handle } : {}) },
        });
        get().fitView();
      },

      loadText(text, fileName, handle) {
        const r = parseDocument(text, ctx);
        if (!r.ok) {
          const detail = r.error.detail ?? '';
          message('messages.loadFailed', { reason: t(`loadErrors.${r.error.code}`, { detail }) }, 'error');
          return false;
        }
        get().loadDocument(r.doc, fileName, handle);
        message(r.normalized ? 'messages.normalized' : 'messages.opened', { name: fileName || r.doc.metadata.name });
        return true;
      },

      loadExample(id) {
        if (get().file.dirty && !deps.confirm(t('menu.confirmDiscard'))) return;
        const name = t(`examples.${id}`);
        get().loadDocument(buildExample(id, { name, note: t(`examples.${id}Note`) }), name);
      },

      async openFile() {
        if (!deps.files) return;
        if (get().file.dirty && !deps.confirm(t('menu.confirmDiscard'))) return;
        const r = await deps.files.open();
        if (r) get().loadText(r.text, r.fileName, r.handle);
      },

      async save(forcePicker = false) {
        if (!deps.files) return;
        const s = get();
        const nowIso = new Date(deps.now()).toISOString();
        const current = docOf(s);
        const name = s.file.name || current.metadata.name || t('app.untitled');
        const withMeta: CircuitDocument = {
          ...current,
          metadata: { ...current.metadata, name: current.metadata.name || name, modifiedAt: nowIso },
          view: { pan: { x: s.viewport.panX, y: s.viewport.panY }, zoom: s.viewport.zoom },
        };
        try {
          const suggested = name.toLowerCase().endsWith('.json') ? name : `${name}.json`;
          const r = await deps.files.save(serializeDocument(withMeta), suggested, s.file.handle, forcePicker);
          if (!r) return;
          set({ file: { name: r.fileName, dirty: false, ...(r.handle ? { handle: r.handle } : {}) } });
          message('messages.saved', { name: r.fileName });
        } catch {
          message('messages.saveFailed', undefined, 'error');
        }
      },

      // ── Avisos ───────────────────────────────────────────────────────────────────────────

      showMessage(key, params, tone = 'info') {
        message(key, params, tone);
      },

      pushToast(key, actions = [], params) {
        const id = ++toastSeq;
        set({ toasts: [...get().toasts, { id, key, actions, ...(params ? { params } : {}) }] });
      },

      dismissToast(id) {
        set({ toasts: get().toasts.filter((x) => x.id !== id) });
      },
    };
  });
}
