/**
 * Miniatura de un aparato para la biblioteca: el mismo dibujo del lienzo, encuadrado en su caja.
 * Así la biblioteca muestra exactamente lo que se va a colocar.
 */
import { memo, type ReactElement } from 'react';
import type { DeviceInstance } from '../../core/board/model';
import type { DeviceDefinition } from '../../core/board/registry';
import { DeviceArt } from './art/DeviceArt';
import { BOARD_PALETTE } from './theme';

const MARGIN = 1.5;

function DeviceThumbInner({
  def,
  width = 74,
  height = 54,
}: {
  def: DeviceDefinition;
  width?: number;
  height?: number;
}): ReactElement {
  const device: DeviceInstance = { id: `thumb-${def.type}`, type: def.type, position: { x: 0, y: 0 },
    rotation: 0, props: {} };
  const minX = def.bounds.minX - MARGIN;
  const minY = def.bounds.minY - MARGIN;
  const w = def.bounds.maxX - def.bounds.minX + MARGIN * 2;
  const h = def.bounds.maxY - def.bounds.minY + MARGIN * 2;
  return (
    <svg
      viewBox={`${minX} ${minY} ${w} ${h}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', background: BOARD_PALETTE.paper, borderRadius: 4 }}
      aria-hidden="true"
    >
      <DeviceArt device={device} def={def} />
    </svg>
  );
}

export const DeviceThumb = memo(DeviceThumbInner);
