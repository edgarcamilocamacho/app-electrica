/**
 * Dibujo puro de un tablero: cables y aparatos. Se reutiliza para exportar, así que no lee estado
 * de la tienda ni decide interacción.
 */
import { memo, useMemo, type ReactElement } from 'react';
import type { BoardDocument, Wire } from '../../core/board/model';
import { terminalOf, wireCountByTerminal } from '../../core/board/model';
import { computeNets, wireLayers } from '../../core/board/nets';
import type { DeviceDefinition, DeviceRegistry } from '../../core/board/registry';
import type { NetPotential, SimSnapshot } from '../../core/board/sim/engine';
import { wireRoute } from '../../core/board/wireGeometry';
import type { Id } from '../../core/model/types';
import { DeviceArt } from './art/DeviceArt';
import { terminalLights } from './lights';
import { BOARD_PALETTE, WIRE_TONES, WIRE_WIDTH } from './theme';

const P = BOARD_PALETTE;

export interface BoardDiagramProps {
  readonly doc: BoardDocument;
  readonly registry: DeviceRegistry;
  readonly sim?: SimSnapshot | null;
  /** Aparatos y cables resaltados por la selección. */
  readonly selected?: ReadonlySet<Id>;
  /** Vista previa inválida: se dibuja en rojo. */
  readonly invalid?: readonly Id[];
  /** Aparatos implicados en la falla de simulación: se resaltan. */
  readonly fault?: readonly Id[];
  /**
   * Color del fondo sobre el que se dibuja. Cada cable lleva debajo una funda de ese color, para
   * que al cruzarse se lea cuál pasa por encima. Al exportar, el fondo es blanco [R5 §16].
   */
  readonly background?: string;
}

const pathOf = (points: readonly { x: number; y: number }[]): string =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');

/** Un cable ya resuelto para dibujar: su recorrido y su estado. */
interface WireDrawing {
  readonly wire: Wire;
  readonly d: string;
  readonly points: readonly { x: number; y: number }[];
  readonly width: number;
  readonly stroke: string;
  readonly live: boolean;
  readonly short: boolean;
  readonly glow: string;
  readonly selected: boolean;
}

/**
 * Los cables de una misma red, en pasadas: halos de selección, fundas, brillos y, al final, los
 * conductores. Como todas las fundas de la red van debajo de todos sus conductores, dos cables de
 * la misma red se cruzan o se superponen sin corte [R7 §3]; la funda sigue cortando a los cables de
 * las redes que quedaron debajo, que es lo que muestra que ahí no hay conexión.
 */
function WireLayer({ wires, background }: { wires: readonly WireDrawing[]; background: string }): ReactElement {
  const round = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <g>
      {wires.map((w) =>
        w.selected ? <path key={`halo-${w.wire.id}`} d={w.d} {...round} stroke={P.selectionHalo} strokeWidth={w.width + 0.7} /> : null,
      )}
      {/* Funda: separa la red de lo que pasa por debajo. */}
      {wires.map((w) => (
        <path key={`sleeve-${w.wire.id}`} data-part="sleeve" d={w.d} {...round} stroke={background} strokeWidth={w.width + 0.34} />
      ))}
      {wires.map((w) =>
        w.live && !w.short ? <path key={`glow-${w.wire.id}`} d={w.d} {...round} stroke={w.glow} strokeWidth={w.width + 0.55} /> : null,
      )}
      {wires.map((w) => (
        <g key={w.wire.id} data-wire={w.wire.id} data-live={w.live ? 'true' : 'false'}>
          <path d={w.d} {...round} stroke={w.stroke} strokeWidth={w.width} {...(w.short ? { strokeDasharray: '0.6 0.4' } : {})} />
          {/* Punta suelta: círculo abierto rojo hasta que se conecte a un borne [R5 §17]. */}
          {w.wire.a.kind === 'free' && <LooseEnd at={w.points[0]!} />}
          {w.wire.b.kind === 'free' && <LooseEnd at={w.points[w.points.length - 1]!} />}
        </g>
      ))}
    </g>
  );
}

function LooseEnd({ at }: { at: { x: number; y: number } }): ReactElement {
  return (
    <g>
      <circle cx={at.x} cy={at.y} r={0.6} fill={P.paper} stroke={P.invalid} strokeWidth={0.18} />
      <circle cx={at.x} cy={at.y} r={0.16} fill={P.invalid} />
    </g>
  );
}

function BoardDiagramInner({
  doc,
  registry,
  sim,
  selected,
  invalid,
  fault,
  background = P.paper,
}: BoardDiagramProps): ReactElement {
  const nets = useMemo(() => computeNets(doc, registry), [doc, registry]);
  const counts = useMemo(() => wireCountByTerminal(doc), [doc]);
  const invalidSet = useMemo(() => new Set(invalid ?? []), [invalid]);
  const faultSet = useMemo(() => new Set(fault ?? []), [fault]);
  const layers = useMemo(() => wireLayers(doc, nets), [doc, nets]);
  const lights = useMemo(() => terminalLights(doc, registry, nets, sim), [doc, registry, nets, sim]);
  const wireNet = (wire: Wire): string | undefined => {
    const ref = terminalOf(wire.a) ?? terminalOf(wire.b);
    return ref ? nets.netOf(ref) : undefined;
  };
  const drawing = (wire: Wire): WireDrawing => {
    const points = wireRoute(doc, registry, wire);
    const net = wireNet(wire);
    const potential: NetPotential | undefined = net ? sim?.netPotentials.get(net) : undefined;
    const tone = WIRE_TONES[wire.color];
    const short = potential?.kind === 'short';
    const live = potential?.kind === 'line' || potential?.kind === 'neutral';
    return {
      wire,
      d: pathOf(points),
      points,
      width: WIRE_WIDTH[wire.gauge],
      stroke: invalidSet.has(wire.id) ? P.invalid : short ? P.short : live ? tone.on : tone.off,
      live,
      short,
      glow: tone.glow,
      selected: selected?.has(wire.id) ?? false,
    };
  };

  const devices = Object.values(doc.devices).map((device) => ({ device, def: registry.get(device.type) }));

  /** Durante la simulación, los aparatos de accionamiento manual se pueden tocar. */
  const isLive = (def: DeviceDefinition): boolean =>
    sim != null && sim.mode !== 'error' && def.internals.actuators.some((a) => a.kind === 'manual');

  return (
    <g>
      {/* Cuerpos y esquema interno: debajo de los cables. */}
      {devices.map(({ device, def }) =>
        def ? (
          <g
            key={device.id}
            transform={`translate(${device.position.x} ${device.position.y}) rotate(${device.rotation})`}
          >
            {(selected?.has(device.id) ?? false) && (
              <rect
                x={def.bounds.minX - 0.5}
                y={def.bounds.minY - 0.5}
                width={def.bounds.maxX - def.bounds.minX + 1}
                height={def.bounds.maxY - def.bounds.minY + 1}
                rx={0.9}
                fill={P.selectionHalo}
                stroke={P.selection}
                strokeWidth={0.2}
              />
            )}
            <DeviceArt
              device={device}
              def={def}
              view={sim?.devices.get(device.id)}
              lights={lights.get(device.id)}
              layer="body"
            />
          </g>
        ) : null,
      )}

      {/* Una capa por red; los más gruesos encima [R7 §1], sin corte dentro de una red [R7 §3]. */}
      {layers.map((layer) => (
        <WireLayer key={layer[0]!.id} wires={layer.map(drawing)} background={background} />
      ))}

      {/* Tornillos, marcaciones y marcas de inválido: encima de los cables. */}
      {devices.map(({ device, def }) =>
        def ? (
          <g
            key={device.id}
            transform={`translate(${device.position.x} ${device.position.y}) rotate(${device.rotation})`}
            className={isLive(def) ? 'tb-live' : undefined}
            data-device={device.id}
            data-rotation={device.rotation}
            data-ref={typeof device.props.ref === 'string' ? device.props.ref : ''}
            data-energized={sim?.devices.get(device.id)?.energized === true ? 'true' : 'false'}
            data-actuated={sim?.devices.get(device.id)?.actuated === true ? 'true' : 'false'}
            data-lit={[...(lights.get(device.id)?.keys() ?? [])].sort().join(' ')}
          >
            {isLive(def) && (
              <g>
                {/* Realce al pasar el cursor: dice qué se puede accionar [R5 §21]. */}
                <rect
                  className="tb-live__ring"
                  x={def.bounds.minX - 0.5}
                  y={def.bounds.minY - 0.5}
                  width={def.bounds.maxX - def.bounds.minX + 1}
                  height={def.bounds.maxY - def.bounds.minY + 1}
                  rx={1.2}
                  fill={P.liveHalo}
                  stroke={P.selection}
                  strokeWidth={0.22}
                />
                {/* Zona sensible: transparente, pero recibe el cursor. */}
                <rect
                  x={def.bounds.minX}
                  y={def.bounds.minY}
                  width={def.bounds.maxX - def.bounds.minX}
                  height={def.bounds.maxY - def.bounds.minY}
                  fill="transparent"
                />
              </g>
            )}
            <DeviceArt
              device={device}
              def={def}
              view={sim?.devices.get(device.id)}
              wireCounts={counts}
              layer="screws"
            />
            {faultSet.has(device.id) && (
              <rect
                x={def.bounds.minX - 0.7}
                y={def.bounds.minY - 0.7}
                width={def.bounds.maxX - def.bounds.minX + 1.4}
                height={def.bounds.maxY - def.bounds.minY + 1.4}
                rx={1.1}
                fill={P.invalidHalo}
                stroke={P.short}
                strokeWidth={0.3}
                strokeDasharray="1 0.6"
              />
            )}
            {invalidSet.has(device.id) && (
              <rect
                x={def.bounds.minX - 0.4}
                y={def.bounds.minY - 0.4}
                width={def.bounds.maxX - def.bounds.minX + 0.8}
                height={def.bounds.maxY - def.bounds.minY + 0.8}
                rx={0.9}
                fill={P.invalidHalo}
                stroke={P.invalid}
                strokeWidth={0.22}
              />
            )}
          </g>
        ) : null,
      )}
    </g>
  );
}

export const BoardDiagram = memo(BoardDiagramInner);
