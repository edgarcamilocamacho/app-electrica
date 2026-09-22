/**
 * Dibujo puro de un tablero: cables y aparatos. Se reutiliza para exportar, así que no lee estado
 * de la tienda ni decide interacción.
 */
import { memo, useMemo, type ReactElement } from 'react';
import type { BoardDocument, Wire } from '../../core/board/model';
import { wireCountByTerminal } from '../../core/board/model';
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
}

const pathOf = (points: readonly { x: number; y: number }[]): string =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');

function WireArt({
  wire,
  points,
  potential,
  selected,
  invalid,
}: {
  wire: Wire;
  points: readonly { x: number; y: number }[];
  potential: NetPotential | undefined;
  selected: boolean;
  invalid: boolean;
}): ReactElement {
  const tone = WIRE_TONES[wire.color];
  const width = WIRE_WIDTH[wire.gauge];
  const d = pathOf(points);
  const short = potential?.kind === 'short';
  const live = potential?.kind === 'line' || potential?.kind === 'neutral';
  const stroke = invalid ? P.invalid : short ? P.short : live ? tone.on : tone.off;
  return (
    <g>
      {selected && <path d={d} fill="none" stroke={P.selectionHalo} strokeWidth={width + 0.7} strokeLinecap="round" strokeLinejoin="round" />}
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
    </g>
  );
}

function BoardDiagramInner({ doc, registry, sim, selected, invalid }: BoardDiagramProps): ReactElement {
  const nets = useMemo(() => computeNets(doc, registry), [doc, registry]);
  const counts = useMemo(() => wireCountByTerminal(doc), [doc]);
  const invalidSet = useMemo(() => new Set(invalid ?? []), [invalid]);

  return (
    <g>
      {Object.values(doc.wires).map((wire) => (
        <WireArt
          key={wire.id}
          wire={wire}
          points={wireRoute(doc, registry, wire)}
          potential={sim?.netPotentials.get(nets.netOf(wire.a))}
          selected={selected?.has(wire.id) ?? false}
          invalid={invalidSet.has(wire.id)}
        />
      ))}
      {Object.values(doc.devices).map((device) => {
        const def = registry.get(device.type);
        if (!def) return null;
        const isSelected = selected?.has(device.id) ?? false;
        return (
          <g key={device.id} transform={`translate(${device.position.x} ${device.position.y})`}>
            {isSelected && (
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
            <DeviceArt device={device} def={def} view={sim?.devices.get(device.id)} wireCounts={counts} />
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
        );
      })}
    </g>
  );
}

export const BoardDiagram = memo(BoardDiagramInner);
