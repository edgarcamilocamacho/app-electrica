/**
 * Vista previa del tablero mientras se construye la interfaz nueva (G2). Muestra el circuito de
 * ejemplo simulándose: se puede apretar un pulsador o mover la palanca de un taco con el mouse.
 * La reemplaza el lienzo real con herramientas; por eso todavía no tiene textos ni paneles.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { boardRegistry } from '../../core/board/catalog';
import { deviceOuterRect } from '../../core/board/model';
import { wireRoute } from '../../core/board/wireGeometry';
import { BoardSimEngine, type SimSnapshot } from '../../core/board/sim/engine';
import { createRandomIdGen } from '../../core/model/ids';
import { rectFromPoints, rectUnion, type Rect } from '../../core/model/geometry';
import { starterBoard } from '../../examples/board';
import { BoardDiagram } from './BoardDiagram';
import { BOARD_PALETTE } from './theme';

const MARGIN = 6;

export function BoardPreview(): ReactElement {
  const doc = useMemo(() => starterBoard({ ids: createRandomIdGen(), registry: boardRegistry }), []);
  const engine = useMemo(() => new BoardSimEngine(doc, boardRegistry), [doc]);
  const [snapshot, setSnapshot] = useState<SimSnapshot>(() => engine.start());
  const frame = useRef(0);

  useEffect(() => {
    const t0 = performance.now();
    const loop = (): void => {
      engine.advanceTo(performance.now() - t0);
      setSnapshot(engine.snapshot());
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame.current);
  }, [engine]);

  const viewBox = useMemo(() => {
    let box: Rect | undefined;
    for (const device of Object.values(doc.devices)) {
      const def = boardRegistry.get(device.type);
      if (!def) continue;
      const rect = deviceOuterRect(device, def);
      box = box ? rectUnion(box, rect) : rect;
    }
    for (const w of Object.values(doc.wires)) {
      const rect = rectFromPoints([...wireRoute(doc, boardRegistry, w)]);
      if (rect) box = box ? rectUnion(box, rect) : rect;
    }
    const r = box ?? { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    return `${r.minX - MARGIN} ${r.minY - MARGIN} ${r.maxX - r.minX + MARGIN * 2} ${r.maxY - r.minY + MARGIN * 2}`;
  }, [doc]);

  const deviceAt = (target: EventTarget | null): string | undefined => {
    const element = target instanceof Element ? target.closest('[data-device]') : null;
    return element?.getAttribute('data-device') ?? undefined;
  };

  return (
    <div style={{ width: '100%', height: '100%', background: BOARD_PALETTE.paper }}>
      <svg
        viewBox={viewBox}
        style={{ width: '100%', height: '100%', touchAction: 'none', userSelect: 'none' }}
        onPointerDown={(e) => {
          const id = deviceAt(e.target);
          if (!id) return;
          const type = doc.devices[id]?.type;
          if (type === 'breaker-1p' || type === 'switch-no') engine.toggle(id);
          else engine.press(id);
          setSnapshot(engine.snapshot());
        }}
        onPointerUp={(e) => {
          const id = deviceAt(e.target);
          if (id) engine.release(id);
          setSnapshot(engine.snapshot());
        }}
        onPointerLeave={() => {
          for (const id of Object.keys(doc.devices)) engine.release(id);
          setSnapshot(engine.snapshot());
        }}
      >
        <rect x="-1000" y="-1000" width="2000" height="2000" fill={BOARD_PALETTE.paper} />
        <BoardDiagram doc={doc} registry={boardRegistry} sim={snapshot} />
        {/* Zonas clicables arriba de todo: el aparato entero responde al puntero. */}
        <g>
          {Object.values(doc.devices).map((device) => {
            const def = boardRegistry.get(device.type);
            if (!def) return null;
            return (
              <rect
                key={device.id}
                data-device={device.id}
                x={device.position.x + def.bounds.minX}
                y={device.position.y + def.bounds.minY}
                width={def.bounds.maxX - def.bounds.minX}
                height={def.bounds.maxY - def.bounds.minY}
                fill="transparent"
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
