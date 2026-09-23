/**
 * Piezas con las que se dibuja cualquier aparato (PLAN §22.6): cuerpo, tornillos, etiquetas de
 * borne y los símbolos IEC que van adentro (contacto, bobina, lámpara, foco).
 *
 * Todo en coordenadas locales del aparato, en unidades de grid. El padre aplica la posición.
 */
import { createContext, useContext, type ReactElement } from 'react';
import { rotateDir, rotateOffset, type Rect } from '../../../core/model/geometry';
import type { Dir, Point, Rotation } from '../../../core/model/types';
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

/**
 * Giro del aparato que se está dibujando. Los textos lo compensan: el aparato gira, pero sus
 * marcaciones se leen siempre derechas [R5 §19].
 */
const RotationContext = createContext<Rotation>(0);

export const RotationProvider = RotationContext.Provider;

export const useRotation = (): Rotation => useContext(RotationContext);

/**
 * Coloca algo junto a un borne: el desplazamiento se piensa en pantalla (el aparato ya girado) y
 * se devuelve en coordenadas locales, que es donde se dibuja.
 */
function placeByEdge(
  x: number,
  y: number,
  edge: Dir,
  rotation: Rotation,
  offsets: Readonly<Record<Dir, Point>>,
): Point {
  const shown = rotateDir(edge, rotation);
  const back = ((360 - rotation) % 360) as Rotation;
  const local = rotateOffset(offsets[shown], back);
  return { x: x + local.x, y: y + local.y };
}

/** Contragiro para que un texto quede derecho, alrededor de su propio punto de anclaje. */
export function useUpright(x: number, y: number): { transform?: string } {
  const rotation = useContext(RotationContext);
  return rotation === 0 ? {} : { transform: `rotate(${-rotation} ${x} ${y})` };
}

export function Body({ bounds, shaded }: { bounds: Rect; shaded?: boolean }): ReactElement {
  return (
    <rect
      x={bounds.minX}
      y={bounds.minY}
      width={bounds.maxX - bounds.minX}
      height={bounds.maxY - bounds.minY}
      rx={0.9}
      fill={shaded ? P.bodyShade : P.body}
      stroke={P.bodyEdge}
      strokeWidth={BODY_STROKE}
    />
  );
}

/**
 * Tornillo del borne, con su número adentro [R5 §18]. Los de potencia se dibujan más grandes y el
 * texto se achica cuando la marcación es larga.
 */
export function Screw({
  x,
  y,
  size = 'control',
  text,
}: {
  x: number;
  y: number;
  size?: 'control' | 'power';
  text?: string;
}): ReactElement {
  const r = SCREW_RADIUS[size];
  const label = text ?? '';
  const font = label.length <= 1 ? r * 1.15 : label.length === 2 ? r * 0.95 : r * 0.72;
  const upright = useUpright(x, y);
  return (
    <g>
      <circle cx={x} cy={y} r={r * 1.18} fill={P.screwEdge} opacity={0.16} />
      <circle cx={x} cy={y} r={r} fill={P.screw} stroke={P.screwEdge} strokeWidth={BOARD_STROKE * 0.9} />
      {label ? (
        <text
          x={x}
          y={y + font * 0.35}
          {...upright}
          textAnchor="middle"
          fontSize={font}
          fontFamily={FONT_FAMILY}
          fontWeight={700}
          fill={P.ink}
        >
          {label}
        </text>
      ) : (
        <path
          d={`M${x - r * 0.6} ${y}H${x + r * 0.6}M${x} ${y - r * 0.6}V${y + r * 0.6}`}
          stroke={P.screwEdge}
          strokeWidth={BOARD_STROKE * 0.9}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </g>
  );
}

/** Marcación impresa junto al tornillo, siempre hacia adentro del cuerpo. */
export function TerminalLabel({
  x,
  y,
  text,
  edge,
}: {
  x: number;
  y: number;
  text: string;
  /** Borde del cuerpo donde está el borne. */
  edge: Dir;
}): ReactElement {
  const rotation = useRotation();
  const shown = rotateDir(edge, rotation);
  const at = placeByEdge(x, y, edge, rotation, {
    N: { x: 0, y: 1.6 },
    S: { x: 0, y: -1.05 },
    W: { x: 1.15, y: 0.3 },
    E: { x: -1.15, y: 0.3 },
  });
  return (
    <text
      x={at.x}
      y={at.y}
      {...useUpright(at.x, at.y)}
      textAnchor={shown === 'W' ? 'start' : shown === 'E' ? 'end' : 'middle'}
      fontSize={TERMINAL_FONT}
      fontFamily={FONT_FAMILY}
      fontWeight={600}
      fill={P.muted}
      stroke={P.body}
      strokeWidth={0.45}
      paintOrder="stroke"
      strokeLinejoin="round"
    >
      {text}
    </text>
  );
}

/** Cuántos cables tiene el tornillo [R5 §6]. Va del lado opuesto a la marcación, para no pisarla. */
export function WireCount({
  x,
  y,
  count,
  edge = 'N',
}: {
  x: number;
  y: number;
  count: number;
  edge?: Dir;
}): ReactElement | null {
  const { x: cx, y: cy } = placeByEdge(x, y, edge, useRotation(), {
    N: { x: 1.05, y: -1.05 },
    S: { x: 1.05, y: 1.05 },
    W: { x: 0, y: -1.15 },
    E: { x: 0, y: -1.15 },
  });
  const upright = useUpright(cx, cy);
  if (count <= 0) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={0.48} fill={P.paper} stroke={P.muted} strokeWidth={0.07} />
      <text
        x={cx}
        y={cy + 0.25}
        {...upright}
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
  const upright = useUpright(x, y);
  if (!text) return null;
  return (
    <text
      x={x}
      y={y}
      {...upright}
      textAnchor={anchor}
      fontSize={TAG_FONT}
      fontFamily={FONT_FAMILY}
      fontWeight={700}
      fill={P.ink}
      stroke={P.body}
      strokeWidth={0.5}
      paintOrder="stroke"
      strokeLinejoin="round"
    >
      {text}
    </text>
  );
}

export function Caption({ x, y, text, anchor = 'middle' }: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }): ReactElement | null {
  const upright = useUpright(x, y);
  if (!text) return null;
  return (
    <text
      x={x}
      y={y}
      {...upright}
      textAnchor={anchor}
      fontSize={SMALL_FONT}
      fontFamily={FONT_FAMILY}
      fontWeight={500}
      fill={P.muted}
      stroke={P.body}
      strokeWidth={0.4}
      paintOrder="stroke"
      strokeLinejoin="round"
    >
      {text}
    </text>
  );
}

/** Rótulo del aparato: la referencia y, debajo, la leyenda que escribió el usuario. */
export function TagBlock({
  x,
  y,
  tag,
  caption,
  anchor = 'middle',
}: {
  x: number;
  y: number;
  tag: string;
  caption?: string;
  anchor?: 'start' | 'middle' | 'end';
}): ReactElement {
  return (
    <g>
      <Tag x={x} y={y} text={tag} anchor={anchor} />
      {caption ? <Caption x={x} y={y + 1.35} text={caption} anchor={anchor} /> : null}
    </g>
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
          d={`M${x - 0.7} ${yTop}A0.7 0.7 0 0 1 ${x + 0.7} ${yTop}`}
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

/**
 * Contacto conmutado de una base enchufable: el pivote y, a `length` en la dirección `toward`, los
 * dos contactos fijos separados `spread` del eje. Orientable, porque en un zócalo real los bornes
 * de un mismo polo caen en costados distintos.
 */
export interface ChangeoverGeometry {
  readonly pivot: Point;
  readonly toward: Dir;
  readonly length: number;
  readonly spread: number;
}

/** Punta del contacto fijo que está del lado `side` (−1 o +1) del eje de la cuchilla. */
export function changeoverTip(geometry: ChangeoverGeometry, side: number): Point {
  const { pivot, toward, length, spread } = geometry;
  if (toward === 'N') return { x: pivot.x + side * spread, y: pivot.y - length };
  if (toward === 'S') return { x: pivot.x + side * spread, y: pivot.y + length };
  if (toward === 'E') return { x: pivot.x + length, y: pivot.y + side * spread };
  return { x: pivot.x - length, y: pivot.y + side * spread };
}

export function Changeover({
  geometry,
  side,
  delay,
}: {
  geometry: ChangeoverGeometry;
  /** Lado al que apunta la cuchilla ahora mismo. */
  side: number;
  delay?: 'TON' | 'TOF';
}): ReactElement {
  const { pivot } = geometry;
  const tip = changeoverTip(geometry, side);
  const midX = (pivot.x + tip.x) / 2;
  const midY = (pivot.y + tip.y) / 2;
  return (
    <g>
      <circle cx={pivot.x} cy={pivot.y} r={0.15} fill={P.sym} />
      <Conductor d={`M${pivot.x} ${pivot.y}L${tip.x} ${tip.y}`} width={BOARD_STROKE * 1.25} />
      {delay && (
        <path
          d={
            delay === 'TON'
              ? `M${midX} ${midY}h0.6a0.45 0.45 0 0 1 0 0.9`
              : `M${midX} ${midY}h0.6a0.45 0.45 0 0 0 0 -0.9`
          }
          fill="none"
          stroke={P.sym}
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

/**
 * Accionamiento manual, al lado de la cuchilla y unido a ella por el vínculo mecánico. Al accionar
 * se hunde hacia el contacto, para que se vea qué se está apretando.
 */
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
  const press = actuated ? -0.3 : 0;
  const stem = x + press;
  return (
    <g>
      <MechLink d={`M${x - 1.9} ${y}H${stem}`} />
      {kind === 'push' && (
        <g>
          <Conductor d={`M${stem} ${y - 0.95}V${y + 0.95}`} width={BOARD_STROKE * 1.2} />
          <rect
            x={stem + 0.12}
            y={y - 0.7}
            width={0.55}
            height={1.4}
            rx={0.18}
            fill={P.bodyShade}
            stroke={P.sym}
            strokeWidth={BOARD_STROKE * 0.9}
          />
        </g>
      )}
      {kind === 'toggle' && (
        <g>
          <Conductor d={`M${stem} ${y - 0.95}V${y + 0.95}`} width={BOARD_STROKE * 1.2} />
          <circle cx={stem + 0.5} cy={y} r={0.42} fill={P.bodyShade} stroke={P.sym} strokeWidth={BOARD_STROKE * 0.9} />
        </g>
      )}
      {kind === 'mushroom' && (
        <g>
          <Conductor d={`M${stem} ${y - 1.05}V${y + 1.05}`} width={BOARD_STROKE * 1.2} />
          <path
            d={`M${stem + 0.1} ${y - 1.05}A1.05 1.05 0 0 1 ${stem + 0.1} ${y + 1.05}Z`}
            fill={actuated ? '#991b1b' : '#dc2626'}
            stroke={P.sym}
            strokeWidth={BOARD_STROKE * 0.9}
          />
        </g>
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
