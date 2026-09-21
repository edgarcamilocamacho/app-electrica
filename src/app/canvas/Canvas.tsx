import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { t } from '../i18n/t';
import { useEditor, useEditorStore, useRegistry } from '../store/context';
import { docOf, GRID_PX, screenToWorld, snap, selectionOfState } from '../store/editorStore';
import { COLORS } from '../theme';
import { Diagram, type Marker } from './Diagram';
import type { Id } from '../../core/model/types';

/** Referencias estables: `Diagram` está memoizado y un [] nuevo por render lo redibujaría entero. */
const NO_IDS: readonly Id[] = [];
const NO_MARKERS: readonly Marker[] = [];

/**
 * Lienzo SVG (PLAN §6, ADR-01). Un único <svg>; el mundo se dibuja en unidades de grid dentro de un
 * grupo escalado por GRID_PX × zoom y desplazado por el pan. Se siente infinito: la grilla cubre
 * siempre el área visible.
 */
export function Canvas() {
  const store = useEditorStore();
  const registry = useRegistry();
  const svgRef = useRef<SVGSVGElement>(null);
  const panning = useRef<{ id: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  const { doc, selection, classes, viewport, canvasSize, preview, rubberBand, mode, sim, tool, pointer, diagnostics } = useEditor(
    useShallow((s) => ({
      doc: docOf(s),
      selection: selectionOfState(s),
      classes: s.vertexClasses,
      viewport: s.viewport,
      canvasSize: s.canvasSize,
      preview: s.preview,
      rubberBand: s.rubberBand,
      mode: s.mode,
      sim: s.simSnapshot,
      tool: s.tool,
      pointer: s.pointer,
      diagnostics: s.diagnostics,
    })),
  );

  // Tamaño del lienzo.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) store.getState().setCanvasSize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [store]);

  // Zoom con la rueda (listener no pasivo para poder evitar el scroll de la página).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        store.getState().zoomAt({ x: e.clientX - r.left, y: e.clientY - r.top }, Math.exp(-e.deltaY * 0.0015));
      } else {
        store.getState().panBy(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [store]);

  // Espacio mantenido = desplazar la vista.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    const blur = () => {
      setSpaceDown(false);
      store.getState().simPointerUp();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [store]);

  const toWorld = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return screenToWorld(store.getState().viewport, { x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    svgRef.current?.focus({ preventScroll: true });
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault();
      panning.current = { id: e.pointerId };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    // Sin eventos de mouse de compatibilidad: el lienzo no le roba el foco a un campo que la
    // acción acaba de enfocar (p. ej. el texto de una anotación nueva).
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    store.getState().pointerDown(toWorld(e), { shift: e.shiftKey });
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (panning.current) {
      store.getState().panBy(e.movementX, e.movementY);
      return;
    }
    store.getState().pointerMove(toWorld(e));
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (panning.current) {
      panning.current = null;
      return;
    }
    store.getState().pointerUp(toWorld(e));
  };

  const k = GRID_PX * viewport.zoom;
  const world = {
    minX: Math.floor(-viewport.panX / k) - 2,
    minY: Math.floor(-viewport.panY / k) - 2,
    maxX: Math.ceil((canvasSize.width - viewport.panX) / k) + 2,
    maxY: Math.ceil((canvasSize.height - viewport.panY) / k) + 2,
  };
  const gridStep = viewport.zoom < 0.6 ? 5 : 1;

  const shown = preview?.doc ?? doc;
  const markers: readonly Marker[] = useMemo(() => {
    if (preview) return preview.violations.length ? preview.violations.map((v) => ({ at: v.at, segmentIds: v.segmentIds })) : NO_MARKERS;
    if (mode !== 'edit') return NO_MARKERS;
    const blocking = diagnostics.filter((d) => d.severity === 'blocking' && d.at);
    return blocking.length ? blocking.map((d) => ({ at: d.at!, segmentIds: d.segmentIds })) : NO_MARKERS;
  }, [preview, diagnostics, mode]);

  const cursor = spaceDown ? 'grab' : mode !== 'edit' ? 'pointer' : cursorFor(tool.kind, tool.kind === 'move' && !!tool.carry);
  const snapped = pointer ? snap(pointer) : null;
  const showCrosshair = mode === 'edit' && snapped && (tool.kind === 'wire' || tool.kind === 'place' || tool.kind === 'text');

  return (
    <svg
      ref={svgRef}
      className="canvas"
      data-testid="canvas"
      data-mode={mode}
      data-tool={tool.kind}
      role="application"
      aria-label={t('canvas.label')}
      tabIndex={0}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => store.getState().pointerLeave()}
      onDoubleClick={() => store.getState().wireFinish()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <pattern id="grid-dots" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={gridStep === 1 ? 0.07 : 0.2} fill={COLORS.grid} />
        </pattern>
        <pattern id="grid-major" width={10} height={10} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={0.13} fill={COLORS.gridMajor} />
        </pattern>
      </defs>
      <g transform={`translate(${viewport.panX} ${viewport.panY}) scale(${k})`}>
        <rect x={world.minX} y={world.minY} width={world.maxX - world.minX} height={world.maxY - world.minY} fill="url(#grid-dots)" />
        <rect x={world.minX} y={world.minY} width={world.maxX - world.minX} height={world.maxY - world.minY} fill="url(#grid-major)" />
        <Diagram
          doc={shown}
          registry={registry}
          classes={classes}
          sim={sim}
          selection={selection}
          active={preview?.active ?? NO_IDS}
          invalid={preview ? !preview.ok : false}
          markers={markers}
          fault={sim?.fault?.components ?? NO_IDS}
        />
        {tool.kind === 'wire' &&
          tool.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={0.22} fill={COLORS.preview} />)}
        {showCrosshair && (
          <g pointerEvents="none">
            <circle cx={snapped.x} cy={snapped.y} r={0.45} fill="none" stroke={preview && !preview.ok ? COLORS.invalid : COLORS.preview} strokeWidth={0.1} />
          </g>
        )}
        {rubberBand && (
          <rect
            x={Math.min(rubberBand.a.x, rubberBand.b.x)}
            y={Math.min(rubberBand.a.y, rubberBand.b.y)}
            width={Math.abs(rubberBand.b.x - rubberBand.a.x)}
            height={Math.abs(rubberBand.b.y - rubberBand.a.y)}
            fill={COLORS.selectionHalo}
            stroke={COLORS.selection}
            strokeWidth={0.08}
            strokeDasharray="0.4 0.25"
          />
        )}
      </g>
    </svg>
  );
}

function cursorFor(tool: string, carrying: boolean): string {
  switch (tool) {
    case 'wire':
    case 'place':
    case 'text':
      return 'crosshair';
    case 'move':
      return carrying ? 'grabbing' : 'grab';
    case 'erase':
      return 'cell';
    default:
      return 'default';
  }
}

export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
