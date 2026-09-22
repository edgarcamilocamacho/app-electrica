/**
 * Lienzo del tablero: un único <svg> con desplazamiento y zoom, la grilla, el dibujo y los gestos
 * de cada herramienta. La lógica de edición vive en la tienda; acá solo se traduce el puntero.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import { useStore } from 'zustand';
import type { Id, Point } from '../../core/model/types';
import { BoardDiagram } from './BoardDiagram';
import { wireDebug } from './debugLog';
import { hitTest, objectsInRect } from './hitTest';
import {
  docOf,
  GRID_PX,
  MAX_ZOOM,
  MIN_ZOOM,
  screenToWorld,
  selectionOf,
  snap,
  type BoardStore,
} from './store';
import { BOARD_PALETTE, WIRE_TONES, WIRE_WIDTH } from './theme';

const P = BOARD_PALETTE;

interface SegmentDrag {
  readonly wireId: Id;
  readonly segmentIndex: number;
  readonly origin: Point;
}

export function BoardCanvas({ store }: { store: BoardStore }): ReactElement {
  const state = useStore(store);
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const segmentDrag = useRef<SegmentDrag | undefined>(undefined);
  /** Trazado por arrastre: apretar en un tornillo, arrastrar y soltar en otro. */
  const wireDrag = useRef<{ from: Point } | undefined>(undefined);
  const panning = useRef<{ start: Point; pan: Point } | undefined>(undefined);

  const doc = docOf(state);
  const preview = state.preview;
  const shown = preview?.doc ?? doc;
  const selection = selectionOf(state);
  const selected = useMemo(
    () => new Set<Id>([...selection.devices, ...selection.wires, ...selection.annotations]),
    [selection],
  );

  const fitted = useRef(false);

  useEffect(() => {
    // Al abrir, la vista se ajusta una vez al contenido.
    if (fitted.current || size.width === 0 || size.height === 0) return;
    fitted.current = true;
    store.getState().fitView(size);
  }, [size, store]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: host.clientWidth, height: host.clientHeight });
    });
    observer.observe(host);
    setSize({ width: host.clientWidth, height: host.clientHeight });
    return () => observer.disconnect();
  }, []);

  const toWorld = (e: ReactPointerEvent): Point => {
    const rect = hostRef.current?.getBoundingClientRect();
    const local = { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
    return screenToWorld(state.viewport, local);
  };

  const scale = GRID_PX * state.viewport.zoom;
  const world = {
    minX: -state.viewport.pan.x / scale,
    minY: -state.viewport.pan.y / scale,
    maxX: (size.width - state.viewport.pan.x) / scale,
    maxY: (size.height - state.viewport.pan.y) / scale,
  };

  const onPointerDown = (e: ReactPointerEvent): void => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const at = toWorld(e);
    if (e.button === 1 || e.shiftKey) {
      panning.current = { start: { x: e.clientX, y: e.clientY }, pan: state.viewport.pan };
      return;
    }
    const hit = hitTest(doc, state.registry, at);
    logGesture('down', at, hit);

    if (state.mode !== 'edit') {
      if (hit.kind === 'device' || hit.kind === 'terminal') {
        const id = hit.kind === 'device' ? hit.id : hit.ref.deviceId;
        const def = state.registry.get(doc.devices[id]!.type);
        const manual = def?.internals.actuators.find((a) => a.kind === 'manual');
        if (manual?.kind === 'manual' && (manual.action === 'maintained' || manual.action === 'latching')) {
          store.getState().toggleDevice(id);
        } else if (manual) {
          store.getState().pressDevice(id);
        }
      }
      return;
    }

    if (state.placing) {
      store.getState().place(at);
      return;
    }

    switch (state.tool) {
      case 'wire':
        if (hit.kind === 'terminal') {
          if (state.wiring) store.getState().finishWire(hit.ref);
          else {
            store.getState().beginWire(hit.ref);
            wireDrag.current = { from: { x: e.clientX, y: e.clientY } };
          }
        } else if (state.wiring) {
          store.getState().addBend(at);
        } else {
          // Empezar en el aire: la punta queda suelta y marcada hasta conectarla [R5 §17].
          store.getState().beginWireAt(at);
        }
        break;
      case 'erase':
        if (hit.kind === 'device') store.getState().eraseAt({ kind: 'device', id: hit.id });
        else if (hit.kind === 'wire') store.getState().eraseAt({ kind: 'wire', id: hit.id });
        else if (hit.kind === 'annotation') store.getState().eraseAt({ kind: 'annotation', id: hit.id });
        break;
      case 'text':
        store.getState().addText(at, '');
        break;
      default: {
        if (hit.kind === 'terminal') {
          store.getState().beginWire(hit.ref);
          wireDrag.current = { from: { x: e.clientX, y: e.clientY } };
          break;
        }
        if (hit.kind === 'device') {
          const already = selection.devices.includes(hit.id);
          if (!already) store.getState().selectDevice(hit.id, e.ctrlKey || e.metaKey);
          store.getState().beginDrag(at);
          break;
        }
        if (hit.kind === 'wire') {
          store.getState().selectWire(hit.id, e.ctrlKey || e.metaKey);
          segmentDrag.current = { wireId: hit.id, segmentIndex: hit.segmentIndex, origin: snap(at) };
          break;
        }
        if (hit.kind === 'annotation') {
          store.getState().setSelection({ devices: [], wires: [], annotations: [hit.id] });
          store.getState().beginDrag(at);
          break;
        }
        store.getState().setSelection({ devices: [], wires: [], annotations: [] });
        store.getState().beginMarquee(at);
        break;
      }
    }
  };

  const logGesture = (event: string, at: Point, hit?: { kind: string }): void => {
    if (!wireDebug.enabled) return;
    const s = store.getState();
    wireDebug.log({
      event,
      tool: s.tool,
      at,
      ...(hit ? { hit: hit.kind } : {}),
      ...(s.wiring ? { draft: s.wiring.points, preview: s.draftRoute() } : {}),
      wires: Object.keys(docOf(s).wires).length,
    });
  };

  const onPointerMove = (e: ReactPointerEvent): void => {
    if (panning.current) {
      const dx = e.clientX - panning.current.start.x;
      const dy = e.clientY - panning.current.start.y;
      store.getState().setViewport({ pan: { x: panning.current.pan.x + dx, y: panning.current.pan.y + dy } });
      return;
    }
    const at = toWorld(e);
    if (state.placing) store.getState().movePlacing(at);
    if (state.wiring) {
      const hit = hitTest(doc, state.registry, at);
      store.getState().moveWireCursor(at, hit.kind === 'terminal' ? hit.ref : undefined);
      logGesture('move', at, hit);
    }
    if (state.drag) store.getState().updateDrag(at);
    if (state.marquee) store.getState().updateMarquee(at);
    if (segmentDrag.current) {
      const p = snap(at);
      const { wireId, segmentIndex, origin } = segmentDrag.current;
      store.getState().previewWireSegment(wireId, segmentIndex, { x: p.x - origin.x, y: p.y - origin.y });
    }
  };

  const onPointerUp = (e: ReactPointerEvent): void => {
    panning.current = undefined;
    logGesture('up', toWorld(e));
    // Soltar sobre otro tornillo cierra el cable; soltar en el aire deja el trazado para seguir a clics.
    if (wireDrag.current) {
      const moved = Math.hypot(e.clientX - wireDrag.current.from.x, e.clientY - wireDrag.current.from.y) > 4;
      wireDrag.current = undefined;
      if (moved && state.wiring) {
        const hit = hitTest(doc, state.registry, toWorld(e));
        if (hit.kind === 'terminal') {
          store.getState().finishWire(hit.ref);
          return;
        }
      }
    }
    if (state.mode !== 'edit') {
      const hit = hitTest(doc, state.registry, toWorld(e));
      if (hit.kind === 'device') store.getState().releaseDevice(hit.id);
      else if (hit.kind === 'terminal') store.getState().releaseDevice(hit.ref.deviceId);
      return;
    }
    if (segmentDrag.current) {
      const at = snap(toWorld(e));
      const { wireId, segmentIndex, origin } = segmentDrag.current;
      const delta = { x: at.x - origin.x, y: at.y - origin.y };
      if (delta.x !== 0 || delta.y !== 0) store.getState().dragWireSegment(wireId, segmentIndex, delta);
      segmentDrag.current = undefined;
    }
    if (state.drag) store.getState().endDrag();
    if (state.marquee) store.getState().endMarquee();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!store.getState().wiring) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        store.getState().undoBend();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        store.getState().finishFree();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  // La rueda va con un listener propio: React los registra como pasivos y no dejan preventDefault.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      const local = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const viewport = store.getState().viewport;
      const before = screenToWorld(viewport, local);
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      store.getState().setViewport({
        zoom,
        pan: { x: local.x - before.x * GRID_PX * zoom, y: local.y - before.y * GRID_PX * zoom },
      });
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, [store]);

  const placingDef = state.placing ? state.registry.get(state.placing.type) : undefined;

  return (
    <div
      ref={hostRef}
      data-testid="board-canvas"
      style={{ position: 'relative', width: '100%', height: '100%', background: P.paper, overflow: 'hidden' }}
    >
      <svg
        width={size.width}
        height={size.height}
        style={{ display: 'block', touchAction: 'none', userSelect: 'none', cursor: state.tool === 'wire' ? 'crosshair' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={() => store.getState().finishFree()}
      >
        <rect x={0} y={0} width={size.width} height={size.height} fill={P.paper} />
        <g transform={`translate(${state.viewport.pan.x} ${state.viewport.pan.y}) scale(${scale})`}>
          <Grid world={world} zoom={state.viewport.zoom} />
          <BoardDiagram
            doc={shown}
            registry={state.registry}
            sim={state.sim}
            selected={selected}
            invalid={preview?.ok === false ? preview.invalid : []}
            fault={state.mode === 'error' && state.sim?.fault ? state.sim.fault.devices : []}
          />
          {state.marquee && (
            <rect
              x={Math.min(state.marquee.from.x, state.marquee.to.x)}
              y={Math.min(state.marquee.from.y, state.marquee.to.y)}
              width={Math.abs(state.marquee.to.x - state.marquee.from.x)}
              height={Math.abs(state.marquee.to.y - state.marquee.from.y)}
              fill={P.selectionHalo}
              stroke={P.selection}
              strokeWidth={0.14}
              strokeDasharray="0.6 0.4"
            />
          )}
          {state.tool === 'wire' && <TerminalDots store={store} />}
          {state.wiring && <WiringPreview store={store} />}
          {state.placing && placingDef && (
            <g transform={`translate(${state.placing.at.x} ${state.placing.at.y})`} opacity={0.65}>
              <rect
                x={placingDef.bounds.minX}
                y={placingDef.bounds.minY}
                width={placingDef.bounds.maxX - placingDef.bounds.minX}
                height={placingDef.bounds.maxY - placingDef.bounds.minY}
                rx={0.6}
                fill={P.bodyShade}
                stroke={P.selection}
                strokeWidth={0.2}
              />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

function Grid({ world, zoom }: { world: { minX: number; minY: number; maxX: number; maxY: number }; zoom: number }): ReactElement {
  const step = zoom >= 1.6 ? 1 : zoom < 0.6 ? 10 : 5;
  const dots: ReactElement[] = [];
  const x0 = Math.floor(world.minX / step) * step;
  const y0 = Math.floor(world.minY / step) * step;
  for (let x = x0; x <= world.maxX; x += step) {
    for (let y = y0; y <= world.maxY; y += step) {
      const major = x % 5 === 0 && y % 5 === 0;
      dots.push(
        <circle key={`${x},${y}`} cx={x} cy={y} r={major ? 0.11 : 0.06} fill={major ? P.gridMajor : P.grid} />,
      );
    }
  }
  return <g>{dots}</g>;
}

/** Los bornes se marcan mientras se cablea, para saber dónde se puede enganchar. */
function TerminalDots({ store }: { store: BoardStore }): ReactElement {
  const state = useStore(store);
  const doc = docOf(state);
  const dots: ReactElement[] = [];
  for (const device of Object.values(doc.devices)) {
    const def = state.registry.get(device.type);
    if (!def) continue;
    for (const terminal of def.terminals) {
      dots.push(
        <circle
          key={`${device.id}.${terminal.id}`}
          cx={device.position.x + terminal.offset.x}
          cy={device.position.y + terminal.offset.y}
          r={1}
          fill={P.selectionHalo}
          stroke={P.selection}
          strokeWidth={0.12}
        />,
      );
    }
  }
  return <g style={{ pointerEvents: 'none' }}>{dots}</g>;
}

function WiringPreview({ store }: { store: BoardStore }): ReactElement | null {
  const state = useStore(store);
  const wiring = state.wiring;
  if (!wiring) return null;
  const route = state.draftRoute();
  const tone = WIRE_TONES[state.wireStyle.color];
  const last = route[route.length - 1];
  const invalid = wiring.invalid !== undefined;
  const stroke = invalid ? P.invalid : tone.off;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <path
        d={route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('')}
        fill="none"
        stroke={invalid ? P.invalidHalo : P.selectionHalo}
        strokeWidth={WIRE_WIDTH[state.wireStyle.gauge] + 0.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('')}
        fill="none"
        stroke={stroke}
        strokeWidth={WIRE_WIDTH[state.wireStyle.gauge] + 0.08}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1.1 0.5"
      />
      {wiring.points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={0.28} fill={invalid ? P.invalid : P.selection} />
      ))}
      {last && (
        <circle
          cx={last.x}
          cy={last.y}
          r={wiring.over ? 0.9 : 0.4}
          fill={wiring.over ? (invalid ? P.invalidHalo : P.selectionHalo) : 'none'}
          stroke={invalid ? P.invalid : P.selection}
          strokeWidth={0.14}
        />
      )}
    </g>
  );
}

/** Reexportado para las pruebas de integración. */
export const boardHitTest = hitTest;
export const boardObjectsInRect = objectsInRect;
