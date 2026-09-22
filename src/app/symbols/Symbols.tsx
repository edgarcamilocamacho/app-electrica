import type { ReactElement } from 'react';
import type { DeviceView } from '../../core/sim/engine';
import { FONT_FAMILY, STROKE, usePalette } from '../theme';

/**
 * Símbolos IEC 60617 simplificados (PLAN ADR-10). Cada uno se dibuja en coordenadas locales del
 * componente (unidades de grid, sin rotar), con los terminales donde los declara el catálogo:
 * (0,−3) y (0,3) para los de dos terminales. El padre aplica posición y rotación.
 */
export interface SymbolProps {
  readonly props: Readonly<Record<string, unknown>>;
  readonly view?: DeviceView | undefined;
  readonly color: string;
  /** Tipo del timer vinculado (para dibujar el contacto temporizado correcto, R3 Q3.4). */
  readonly linkedTimer?: 'TON' | 'TOF' | undefined;
}

const W = STROKE;

function Line({ x1, y1, x2, y2, color, dash, width = W }: { x1: number; y1: number; x2: number; y2: number; color: string; dash?: boolean; width?: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" {...(dash ? { strokeDasharray: '0.35 0.25' } : {})} />;
}

/** Contacto NA/NC genérico: dos tramos fijos y la cuchilla. `closed` = conduce. */
function ContactBody({ normal, closed, color }: { normal: 'NO' | 'NC'; closed: boolean; color: string }) {
  const blade = closed
    ? normal === 'NO'
      ? { x: 0, y: -1 }
      : { x: 1, y: -1.05 }
    : normal === 'NO'
      ? { x: -1.15, y: -1.15 }
      : { x: 1.55, y: -0.35 };
  return (
    <g>
      <Line x1={0} y1={-3} x2={0} y2={-1} color={color} />
      <Line x1={0} y1={1} x2={0} y2={3} color={color} />
      {normal === 'NC' && <Line x1={0} y1={-1} x2={1.1} y2={-1} color={color} />}
      <Line x1={0} y1={1} x2={blade.x} y2={blade.y} color={color} width={W * 1.15} />
    </g>
  );
}

/** Punto medio de la cuchilla, para enganchar el accionamiento. */
function bladeMid(normal: 'NO' | 'NC', closed: boolean): { x: number; y: number } {
  if (normal === 'NO') return closed ? { x: 0, y: 0 } : { x: -0.55, y: -0.05 };
  return closed ? { x: 0.5, y: -0.02 } : { x: 0.75, y: 0.3 };
}

function Actuator({ from, kind, color, active }: { from: { x: number; y: number }; kind: 'push' | 'toggle' | 'mushroom'; color: string; active: boolean }) {
  const x = -2.1;
  return (
    <g>
      <Line x1={from.x} y1={from.y} x2={x + 0.3} y2={from.y} color={color} dash />
      {kind === 'push' && <path d={`M ${x + 0.35} ${from.y - 0.7} L ${x} ${from.y - 0.7} L ${x} ${from.y + 0.7} L ${x + 0.35} ${from.y + 0.7}`} fill="none" stroke={color} strokeWidth={W} />}
      {kind === 'toggle' && (
        <path d={`M ${x + 0.3} ${from.y} L ${x} ${from.y} L ${x} ${from.y + 0.7} M ${x} ${from.y} L ${x - 0.4} ${from.y - 0.6}`} fill="none" stroke={color} strokeWidth={W} />
      )}
      {kind === 'mushroom' && (
        <path d={`M ${x} ${from.y - 0.9} A 0.9 0.9 0 0 0 ${x} ${from.y + 0.9} Z`} fill={active ? '#991b1b' : '#dc2626'} stroke={color} strokeWidth={W} />
      )}
    </g>
  );
}

function ManualSwitch({ props: _props, view, color, normal, kind }: SymbolProps & { normal: 'NO' | 'NC'; kind: 'push' | 'toggle' | 'mushroom' }) {
  const actuated = view?.actuated ?? false;
  const closed = normal === 'NO' ? actuated : !actuated;
  return (
    <g>
      <ContactBody normal={normal} closed={closed} color={color} />
      <Actuator from={bladeMid(normal, closed)} kind={kind} color={color} active={actuated} />
    </g>
  );
}

function Contact({ view, color, normal, timed, linkedTimer }: SymbolProps & { normal: 'NO' | 'NC'; timed: boolean }) {
  const closed = view?.conducting ?? normal === 'NC';
  const mid = bladeMid(normal, closed);
  // Contacto temporizado: "paracaídas" cuya orientación indica el retardo (R3 Q3.4).
  const delayOnClose = linkedTimer === 'TON' ? normal === 'NO' : linkedTimer === 'TOF' ? normal === 'NC' : undefined;
  return (
    <g>
      <ContactBody normal={normal} closed={closed} color={color} />
      {timed && (
        <g>
          <Line x1={mid.x} y1={mid.y} x2={-1.6} y2={mid.y} color={color} dash />
          {delayOnClose === undefined ? (
            <circle cx={-1.95} cy={mid.y} r={0.35} fill="none" stroke={color} strokeWidth={W} strokeDasharray="0.2 0.15" />
          ) : delayOnClose ? (
            // Retardo al cerrar: el arco abre hacia la cuchilla.
            <path d={`M -2.5 ${mid.y - 0.45} A 0.45 0.45 0 0 1 -2.5 ${mid.y + 0.45} Z`} fill="none" stroke={color} strokeWidth={W} />
          ) : (
            // Retardo al abrir: el arco abre hacia afuera.
            <path d={`M -1.6 ${mid.y - 0.45} A 0.45 0.45 0 0 0 -1.6 ${mid.y + 0.45} Z`} fill="none" stroke={color} strokeWidth={W} />
          )}
        </g>
      )}
    </g>
  );
}

function CoilBox({ color, on, extra }: { color: string; on: boolean; extra?: 'ton' | 'tof' }) {
  const palette = usePalette();
  return (
    <g>
      <Line x1={0} y1={-3} x2={0} y2={-0.7} color={color} />
      <Line x1={0} y1={0.7} x2={0} y2={3} color={color} />
      <rect x={-1} y={-0.7} width={2} height={1.4} fill={on ? palette.coilOn : palette.paper} stroke={color} strokeWidth={W} />
      {extra && (
        <g>
          <rect x={-2} y={-0.7} width={1} height={1.4} fill={extra === 'tof' ? color : palette.paper} stroke={color} strokeWidth={W} />
          {extra === 'ton' && (
            <g>
              <Line x1={-2} y1={-0.7} x2={-1} y2={0.7} color={color} />
              <Line x1={-2} y1={0.7} x2={-1} y2={-0.7} color={color} />
            </g>
          )}
        </g>
      )}
    </g>
  );
}

function Source({ color }: SymbolProps) {
  const palette = usePalette();
  return (
    <g>
      <Line x1={0} y1={-3} x2={0} y2={-1.4} color={color} />
      <Line x1={0} y1={1.4} x2={0} y2={3} color={color} />
      <circle cx={0} cy={0} r={1.4} fill={palette.paper} stroke={color} strokeWidth={W} />
      <path d="M -0.8 0 C -0.55 -0.75 -0.25 -0.75 0 0 S 0.55 0.75 0.8 0" fill="none" stroke={color} strokeWidth={W} />
      <text x={0.35} y={-2.1} fontSize={0.75} fontFamily={FONT_FAMILY} fill={color}>
        {'L'}
      </text>
      <text x={0.35} y={2.7} fontSize={0.75} fontFamily={FONT_FAMILY} fill={color}>
        {'N'}
      </text>
    </g>
  );
}

function Lamp({ props, view, color }: SymbolProps) {
  const palette = usePalette();
  const on = view?.energized ?? false;
  const fill = palette.lamp[String(props.color)] ?? palette.lamp.red!;
  // La cruz va sobre el relleno encendido: en tinta oscura también en el tema oscuro.
  const cross = on && color === palette.ink ? palette.litInk : color;
  return (
    <g>
      {on && <circle cx={0} cy={0} r={2.1} fill={fill} opacity={0.3} />}
      <Line x1={0} y1={-3} x2={0} y2={-1.3} color={color} />
      <Line x1={0} y1={1.3} x2={0} y2={3} color={color} />
      <circle cx={0} cy={0} r={1.3} fill={on ? fill : palette.paper} stroke={color} strokeWidth={W} />
      <Line x1={-0.92} y1={-0.92} x2={0.92} y2={0.92} color={cross} />
      <Line x1={-0.92} y1={0.92} x2={0.92} y2={-0.92} color={cross} />
    </g>
  );
}

function Selector({ view, color }: SymbolProps) {
  const pos = view?.position ?? 0;
  const tip = pos === 1 ? { x: -2, y: 1.2 } : pos === 2 ? { x: 2, y: 1.2 } : { x: 0, y: 1.1 };
  return (
    <g>
      <Line x1={0} y1={-3} x2={0} y2={-1.2} color={color} />
      <Line x1={-2} y1={3} x2={-2} y2={1.2} color={color} />
      <Line x1={2} y1={3} x2={2} y2={1.2} color={color} />
      <Line x1={0} y1={-1.2} x2={tip.x} y2={tip.y} color={color} width={W * 1.15} />
      <Line x1={tip.x / 2} y1={(tip.y - 1.2) / 2} x2={-2.6} y2={(tip.y - 1.2) / 2} color={color} dash />
      <path d={`M -2.6 ${(tip.y - 1.2) / 2 - 0.6} L -2.9 ${(tip.y - 1.2) / 2 - 0.6} L -2.9 ${(tip.y - 1.2) / 2 + 0.6}`} fill="none" stroke={color} strokeWidth={W} />
      <text x={-2.75} y={2.6} fontSize={0.7} fontFamily={FONT_FAMILY} fill={color} textAnchor="middle">
        {'I'}
      </text>
      <text x={2.75} y={2.6} fontSize={0.7} fontFamily={FONT_FAMILY} fill={color} textAnchor="middle">
        {'II'}
      </text>
    </g>
  );
}

export const SYMBOLS: Readonly<Record<string, (p: SymbolProps) => ReactElement>> = {
  'ac-source': Source,
  'switch-no': (p) => <ManualSwitch {...p} normal="NO" kind="toggle" />,
  'switch-nc': (p) => <ManualSwitch {...p} normal="NC" kind="toggle" />,
  'pushbutton-no': (p) => <ManualSwitch {...p} normal="NO" kind="push" />,
  'pushbutton-nc': (p) => <ManualSwitch {...p} normal="NC" kind="push" />,
  'emergency-stop': (p) => <ManualSwitch {...p} normal="NC" kind="mushroom" />,
  'selector-3': Selector,
  coil: (p) => <CoilBox color={p.color} on={p.view?.energized ?? false} />,
  'contact-no': (p) => <Contact {...p} normal="NO" timed={false} />,
  'contact-nc': (p) => <Contact {...p} normal="NC" timed={false} />,
  'timer-ton': (p) => <CoilBox color={p.color} on={p.view?.energized ?? false} extra="ton" />,
  'timer-tof': (p) => <CoilBox color={p.color} on={p.view?.energized ?? false} extra="tof" />,
  'timed-contact-no': (p) => <Contact {...p} normal="NO" timed />,
  'timed-contact-nc': (p) => <Contact {...p} normal="NC" timed />,
  lamp: Lamp,
};
