/**
 * Piezas con las que se dibuja cualquier aparato (PLAN §22.6): cuerpo, tornillos, etiquetas de
 * borne y los símbolos IEC que van adentro (contacto, bobina, lámpara, foco).
 *
 * Todo en coordenadas locales del aparato, en unidades de grid. El padre aplica la posición.
 */
import type { ReactElement } from 'react';
import type { Rect } from '../../../core/model/geometry';
import {
  BOARD_PALETTE,
  BOARD_STROKE,
  BODY_STROKE,
  FONT_FAMILY,
  SCREW_RADIUS,
  SMALL_FONT,
  TAG_FONT,
  TERMINAL_FONT,
} from '../theme';

const P = BOARD_PALETTE;

export function Body({ bounds, shaded }: { bounds: Rect; shaded?: boolean }): ReactElement {
  return (
    <rect
      x={bounds.minX}
      y={bounds.minY}
      width={bounds.maxX - bounds.minX}
      height={bounds.maxY - bounds.minY}
      rx={0.6}
      fill={shaded ? P.bodyShade : P.body}
      stroke={P.bodyEdge}
      strokeWidth={BODY_STROKE}
    />
  );
}

/** Tornillo del borne. Los de potencia se dibujan más grandes [R5 §9]. */
export function Screw({
  x,
  y,
  size = 'control',
}: {
  x: number;
  y: number;
  size?: 'control' | 'power';
}): ReactElement {
  const r = SCREW_RADIUS[size];
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={P.screw} stroke={P.screwEdge} strokeWidth={BOARD_STROKE * 0.8} />
      <path
        d={`M${x - r * 0.6} ${y}H${x + r * 0.6}M${x} ${y - r * 0.6}V${y + r * 0.6}`}
        stroke={P.screwEdge}
        strokeWidth={BOARD_STROKE * 0.9}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

/** Marcación impresa junto al tornillo. `side` es el borde donde está el borne. */
export function TerminalLabel({
  x,
  y,
  text,
  side,
}: {
  x: number;
  y: number;
  text: string;
  side: 'top' | 'bottom';
}): ReactElement {
  return (
    <text
      x={x}
      y={side === 'top' ? y + 1.6 : y - 1.05}
      textAnchor="middle"
      fontSize={TERMINAL_FONT}
      fontFamily={FONT_FAMILY}
      fontWeight={600}
      fill={P.muted}
    >
      {text}
    </text>
  );
}

/** Cuántos cables tiene el tornillo [R5 §6]. */
export function WireCount({ x, y, count }: { x: number; y: number; count: number }): ReactElement | null {
  if (count <= 0) return null;
  return (
    <g>
      <circle cx={x + 1.05} cy={y - 1.05} r={0.48} fill={P.paper} stroke={P.muted} strokeWidth={0.07} />
      <text
        x={x + 1.05}
        y={y - 0.8}
        textAnchor="middle"
        fontSize={SMALL_FONT * 0.9}
        fontFamily={FONT_FAMILY}
        fontWeight={700}
        fill={P.muted}
      >
        {count}
      </text>
    </g>
  );
}

export function Tag({ x, y, text, anchor = 'middle' }: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }): ReactElement | null {
  if (!text) return null;
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={TAG_FONT} fontFamily={FONT_FAMILY} fontWeight={700} fill={P.ink}>
      {text}
    </text>
  );
}

export function Caption({ x, y, text, anchor = 'middle' }: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }): ReactElement | null {
  if (!text) return null;
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={SMALL_FONT} fontFamily={FONT_FAMILY} fill={P.muted}>
      {text}
    </text>
  );
}

export function Conductor({ d, color = P.sym, width = BOARD_STROKE }: { d: string; color?: string; width?: number }): ReactElement {
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />;
}

export function MechLink({ d }: { d: string }): ReactElement {
  return (
    <path
      d={d}
      fill="none"
      stroke={P.sym}
      strokeWidth={BOARD_STROKE * 0.8}
      strokeDasharray="0.3 0.25"
      strokeLinecap="round"
      opacity={0.8}
    />
  );
}

export interface ContactProps {
  /** Columna del contacto. */
  readonly x: number;
  /** Contacto fijo, arriba. */
  readonly yTop: number;
  /** Pivote de la cuchilla, abajo. */
  readonly yBottom: number;
  readonly normal: 'NO' | 'NC';
  readonly closed: boolean;
  /** Contacto principal de un contactor: lleva el arco de corte. */
  readonly power?: boolean;
  /** Contacto temporizado: el "paracaídas" indica el retardo. */
  readonly delay?: 'TON' | 'TOF';
  readonly color?: string;
}

/**
 * Contacto vertical: el fijo arriba, la cuchilla pivotando abajo. La cuchilla se dibuja inclinada
 * cuando está abierta, como en un esquema IEC.
 */
export function Contact({ x, yTop, yBottom, normal, closed, power, delay, color = P.sym }: ContactProps): ReactElement {
  const length = yBottom - yTop;
  const tilt = normal === 'NO' ? (closed ? 0 : -0.38) : closed ? 0.32 : 0.68;
  const tipX = x + Math.sin(tilt) * length;
  const tipY = yBottom - Math.cos(tilt) * length;
  const midX = (x + tipX) / 2;
  const midY = (yBottom + tipY) / 2;
  return (
    <g>
      {power && (
        <path
          d={`M${x - 0.5} ${yTop - 0.3}A0.5 0.5 0 0 1 ${x + 0.5} ${yTop - 0.3}`}
          fill="none"
          stroke={color}
          strokeWidth={BOARD_STROKE}
        />
      )}
      {normal === 'NC' && <Conductor d={`M${x} ${yTop}H${x + 0.9}`} color={color} />}
      <circle cx={x} cy={yBottom} r={0.13} fill={color} />
      <Conductor d={`M${x} ${yBottom}L${tipX} ${tipY}`} color={color} width={BOARD_STROKE * 1.2} />
      {delay && (
        <path
          d={
            delay === 'TON'
              ? `M${midX} ${midY}h0.55a0.45 0.45 0 0 1 0 0.9`
              : `M${midX} ${midY}h0.55a0.45 0.45 0 0 0 0 -0.9`
          }
          fill="none"
          stroke={color}
          strokeWidth={BOARD_STROKE * 0.9}
        />
      )}
    </g>
  );
}

/** Bobina: rectángulo que se rellena cuando está energizada. */
export function Coil({
  x,
  y,
  w,
  h,
  on,
  timer,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  on: boolean;
  timer?: 'TON' | 'TOF';
}): ReactElement {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={on ? P.coilOn : P.body} stroke={P.sym} strokeWidth={BOARD_STROKE} />
      {timer && (
        <path
          d={
            timer === 'TON'
              ? `M${x} ${y}L${x + w} ${y + h}`
              : `M${x} ${y + h}L${x + w} ${y}`
          }
          stroke={P.sym}
          strokeWidth={BOARD_STROKE}
          fill="none"
        />
      )}
    </g>
  );
}

/** Piloto: el círculo del símbolo es el que alumbra [R5 §10]. */
export function LampSymbol({ x, y, r, on, color }: { x: number; y: number; r: number; on: boolean; color: string }): ReactElement {
  const k = r * 0.7071;
  return (
    <g>
      {on && <circle cx={x} cy={y} r={r * 1.7} fill={color} opacity={0.28} />}
      <circle cx={x} cy={y} r={r} fill={on ? color : P.body} stroke={P.sym} strokeWidth={BOARD_STROKE} />
      <path
        d={`M${x - k} ${y - k}L${x + k} ${y + k}M${x + k} ${y - k}L${x - k} ${y + k}`}
        stroke={P.sym}
        strokeWidth={BOARD_STROKE}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

/** Foco: carga con forma de bombillo [R5 §10]. */
export function BulbSymbol({ x, y, r, on, color }: { x: number; y: number; r: number; on: boolean; color: string }): ReactElement {
  return (
    <g>
      {on && <circle cx={x} cy={y - r * 0.2} r={r * 1.9} fill={color} opacity={0.3} />}
      <path
        d={`M${x - r} ${y - r * 0.2}a${r} ${r} 0 1 1 ${r * 2} 0c0 ${r * 0.75} -${r * 0.5} ${r * 0.75} -${r * 0.5} ${r * 1.15}h-${r} c0 -${r * 0.4} -${r * 0.5} -${r * 0.4} -${r * 0.5} -${r * 1.15}z`}
        fill={on ? color : P.body}
        stroke={P.sym}
        strokeWidth={BOARD_STROKE}
      />
      <path
        d={`M${x - r * 0.5} ${y + r * 0.95}h${r}M${x - r * 0.5} ${y + r * 1.35}h${r}`}
        stroke={P.sym}
        strokeWidth={BOARD_STROKE}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

/** Accionamiento manual dibujado al lado de la cuchilla. */
export function ManualActuator({
  x,
  y,
  kind,
  actuated,
}: {
  x: number;
  y: number;
  kind: 'push' | 'toggle' | 'mushroom';
  actuated: boolean;
}): ReactElement {
  return (
    <g>
      <MechLink d={`M${x - 1.4} ${y}H${x}`} />
      {kind === 'push' && (
        <Conductor d={`M${x + 0.5} ${y - 0.75}H${x}V${y + 0.75}H${x + 0.5}`} />
      )}
      {kind === 'toggle' && <Conductor d={`M${x} ${y - 0.75}V${y + 0.75}M${x} ${y}h0.6`} />}
      {kind === 'mushroom' && (
        <path
          d={`M${x} ${y - 0.95}A0.95 0.95 0 0 1 ${x} ${y + 0.95}Z`}
          fill={actuated ? '#991b1b' : '#dc2626'}
          stroke={P.sym}
          strokeWidth={BOARD_STROKE}
        />
      )}
    </g>
  );
}

/** Palanca de un taco: arriba cerrado, abajo abierto. */
export function Lever({ x, y, on }: { x: number; y: number; on: boolean }): ReactElement {
  return (
    <g>
      <rect x={x - 0.75} y={y - 2.2} width={1.5} height={4.4} rx={0.3} fill={P.bodyShade} stroke={P.bodyEdge} strokeWidth={BOARD_STROKE} />
      <rect
        x={x - 0.5}
        y={on ? y - 2 : y + 0.1}
        width={1}
        height={1.9}
        rx={0.2}
        fill={on ? P.metal : P.body}
        stroke={P.bodyEdge}
        strokeWidth={BOARD_STROKE * 0.9}
      />
    </g>
  );
}
