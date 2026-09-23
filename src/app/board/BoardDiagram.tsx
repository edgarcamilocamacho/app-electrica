/**
 * Dibujo puro de un tablero: cables y aparatos. Se reutiliza para exportar, así que no lee estado
 * de la tienda ni decide interacción.
 */
import { memo, useMemo, type ReactElement } from 'react';
import type { BoardDocument, Wire } from '../../core/board/model';
import { terminalOf, wireCountByTerminal } from '../../core/board/model';
import { computeNets } from '../../core/board/nets';
import type { DeviceRegistry } from '../../core/board/registry';
import type { NetPotential, SimSnapshot } from '../../core/board/sim/engine';
import { wireRoute } from '../../core/board/wireGeometry';
import type { Id } from '../../core/model/types';
import { DeviceArt } from './art/DeviceArt';
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

function WireArt({
  wire,
  points,
  potential,
  selected,
  invalid,
  background,
}: {
  wire: Wire;
  points: readonly { x: number; y: number }[];
  potential: NetPotential | undefined;
  selected: boolean;
  invalid: boolean;
  background: string;
}): ReactElement {
  const tone = WIRE_TONES[wire.color];
  const width = WIRE_WIDTH[wire.gauge];
  const d = pathOf(points);
  const short = potential?.kind === 'short';
  const live = potential?.kind === 'line' || potential?.kind === 'neutral';
  const stroke = invalid ? P.invalid : short ? P.short : live ? tone.on : tone.off;
  return (
    <g data-wire={wire.id} data-live={live ? 'true' : 'false'}>
      {selected && <path d={d} fill="none" stroke={P.selectionHalo} strokeWidth={width + 0.7} strokeLinecap="round" strokeLinejoin="round" />}
      {/* Funda: separa el cable de lo que pasa por debajo. */}
      <path d={d} fill="none" stroke={background} strokeWidth={width + 0.34} strokeLinecap="round" strokeLinejoin="round" />
      {live && !short && (
        <path d={d} fill="none" stroke={tone.glow} strokeWidth={width + 0.55} strokeLinecap="round" strokeLinejoin="round" />
      )}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...(short ? { strokeDasharray: '0.6 0.4' } : {})}
      />
      {/* Punta suelta: círculo abierto rojo hasta que se conecte a un borne [R5 §17]. */}
      {wire.a.kind === 'free' && <LooseEnd at={points[0]!} />}
      {wire.b.kind === 'free' && <LooseEnd at={points[points.length - 1]!} />}
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
  const wireNet = (wire: Wire): string | undefined => {
    const ref = terminalOf(wire.a) ?? terminalOf(wire.b);
    return ref ? nets.netOf(ref) : undefined;
  };

  const devices = Object.values(doc.devices).map((device) => ({ device, def: registry.get(device.type) }));

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
            <DeviceArt device={device} def={def} view={sim?.devices.get(device.id)} layer="body" />
          </g>
        ) : null,
      )}

      {Object.values(doc.wires).map((wire) => (
        <WireArt
          key={wire.id}
          wire={wire}
          points={wireRoute(doc, registry, wire)}
          potential={wireNet(wire) ? sim?.netPotentials.get(wireNet(wire)!) : undefined}
          selected={selected?.has(wire.id) ?? false}
          invalid={invalidSet.has(wire.id)}
          background={background}
        />
      ))}

      {/* Tornillos, marcaciones y marcas de inválido: encima de los cables. */}
      {devices.map(({ device, def }) =>
        def ? (
          <g
            key={device.id}
            transform={`translate(${device.position.x} ${device.position.y}) rotate(${device.rotation})`}
            data-device={device.id}
            data-rotation={device.rotation}
            data-ref={typeof device.props.ref === 'string' ? device.props.ref : ''}
            data-energized={sim?.devices.get(device.id)?.energized === true ? 'true' : 'false'}
            data-actuated={sim?.devices.get(device.id)?.actuated === true ? 'true' : 'false'}
          >
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
