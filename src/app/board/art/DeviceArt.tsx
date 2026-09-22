/**
 * Dibujo de cada aparato (PLAN §22.6): la silueta de su base, los tornillos numerados y el esquema
 * IEC adentro. Hay una función por familia; agregar un aparato de una familia que ya existe es
 * agregar datos al catálogo.
 */
import type { ReactElement } from 'react';
import type { DeviceInstance } from '../../../core/board/model';
import { terminalKey } from '../../../core/board/model';
import type { DeviceDefinition, TerminalDef } from '../../../core/board/registry';
import type { DeviceView } from '../../../core/board/sim/engine';
import { BOARD_PALETTE, BOARD_STROKE } from '../theme';
import {
  Body,
  BulbSymbol,
  Caption,
  Coil,
  Conductor,
  Contact,
  LampSymbol,
  Lever,
  ManualActuator,
  MechLink,
  Screw,
  Tag,
  TerminalLabel,
  WireCount,
} from './primitives';

const P = BOARD_PALETTE;

export interface DeviceArtProps {
  readonly device: DeviceInstance;
  readonly def: DeviceDefinition;
  readonly view?: DeviceView | undefined;
  /** Cuántos cables tiene cada borne, por clave de borne [R5 §6]. */
  readonly wireCounts?: ReadonlyMap<string, number> | undefined;
}

const closedOf = (view: DeviceView | undefined, deviceId: string, a: string, b: string, fallback: boolean): boolean =>
  view?.contacts.get(`${deviceId}:${a}-${b}`) ?? fallback;

const tagOf = (device: DeviceInstance): string => (typeof device.props.ref === 'string' ? device.props.ref : '');
const labelOf = (device: DeviceInstance): string => (typeof device.props.label === 'string' ? device.props.label : '');

/** Columnas de la fila de arriba, ordenadas de izquierda a derecha. */
const topRow = (def: DeviceDefinition): readonly TerminalDef[] =>
  def.terminals.filter((t) => t.dir === 'N').sort((a, b) => a.offset.x - b.offset.x);

export function DeviceArt({ device, def, view, wireCounts }: DeviceArtProps): ReactElement {
  return (
    <g>
      {internals(device, def, view)}
      {def.terminals.map((t) => (
        <g key={t.id}>
          <Screw x={t.offset.x} y={t.offset.y} size={t.screw} />
          <TerminalLabel x={t.offset.x} y={t.offset.y} text={t.label} side={t.dir === 'N' ? 'top' : 'bottom'} />
          <WireCount
            x={t.offset.x}
            y={t.offset.y}
            count={wireCounts?.get(terminalKey({ deviceId: device.id, terminalId: t.id })) ?? 0}
          />
        </g>
      ))}
    </g>
  );
}

function internals(device: DeviceInstance, def: DeviceDefinition, view: DeviceView | undefined): ReactElement {
  switch (def.type) {
    case 'supply-1p':
      return <SupplyArt device={device} def={def} />;
    case 'contactor-3p':
      return <ContactorArt device={device} def={def} view={view} />;
    case 'pilot-lamp':
    case 'bulb':
      return <LoadArt device={device} def={def} view={view} />;
    default:
      return def.internals.actuators.some((a) => a.kind === 'manual' && a.action === 'maintained') &&
        def.category === 'protection' ? (
        <BreakerArt device={device} def={def} view={view} />
      ) : (
        <ManualArt device={device} def={def} view={view} />
      );
  }
}

/** Acometida dibujada como la bajada de un poste [R5 §2]. */
function SupplyArt({ device, def }: { device: DeviceInstance; def: DeviceDefinition }): ReactElement {
  const drops = def.terminals.filter((t) => t.dir === 'S');
  const armY = def.bounds.minY + 2;
  const box = { ...def.bounds, minY: def.bounds.maxY - 3.6 };
  return (
    <g>
      <rect
        x={-0.5}
        y={def.bounds.minY}
        width={1}
        height={def.bounds.maxY - def.bounds.minY - 2}
        fill={P.bodyShade}
        stroke={P.bodyEdge}
        strokeWidth={BOARD_STROKE}
      />
      <Conductor d={`M${def.bounds.minX + 1} ${armY}H${def.bounds.maxX - 1}`} width={BOARD_STROKE * 1.6} />
      {drops.map((t) => (
        <g key={t.id}>
          <circle cx={t.offset.x} cy={armY - 0.5} r={0.35} fill={P.metal} stroke={P.sym} strokeWidth={BOARD_STROKE * 0.8} />
          <Conductor d={`M${t.offset.x} ${armY - 0.5}V${t.offset.y - 1}`} />
        </g>
      ))}
      <Body bounds={box} />
      <Tag x={def.bounds.minX + 1.4} y={box.minY + 1.4} text={tagOf(device)} anchor="start" />
    </g>
  );
}

/** Taco: una cuchilla por polo y la palanca a la derecha [R5 §8]. */
function BreakerArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const columns = topRow(def);
  const bottom = def.terminals.filter((t) => t.dir === 'S').sort((a, b) => a.offset.x - b.offset.x);
  const leverX = def.bounds.maxX - 1.3;
  return (
    <g>
      <Body bounds={def.bounds} />
      {columns.map((t, i) => {
        const b = bottom[i]!;
        const closed = closedOf(view, device.id, t.id, b.id, false);
        return (
          <g key={t.id}>
            <Conductor d={`M${t.offset.x} ${t.offset.y + 1.4}V-2.2`} />
            <Contact x={t.offset.x} yTop={-2.2} yBottom={2.2} normal="NO" closed={closed} />
            <Conductor d={`M${b.offset.x} 2.2V${b.offset.y - 1.4}`} />
          </g>
        );
      })}
      <MechLink d={`M${columns[0]!.offset.x - 1} 0H${leverX - 0.9}`} />
      <Lever x={leverX} y={0} on={view?.actuated ?? false} />
      <Tag x={def.bounds.minX + 1.2} y={def.bounds.maxY - 3.2} text={tagOf(device)} anchor="start" />
    </g>
  );
}

/** Contactor: bobina arriba entre los bornes de potencia y los cinco contactos debajo [R5 §9]. */
function ContactorArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const poles: readonly [string, string, boolean, 'NO' | 'NC'][] = [
    ['1', '2', true, 'NO'],
    ['3', '4', true, 'NO'],
    ['5', '6', true, 'NO'],
    ['13', '14', false, 'NO'],
    ['21', '22', false, 'NC'],
  ];
  const at = (id: string) => def.terminals.find((t) => t.id === id)!;
  const a1 = at('A1');
  const a2 = at('A2');
  const coilTop = 4.2;
  const on = view?.energized === true;
  return (
    <g>
      <Body bounds={def.bounds} />
      {poles.map(([top, bot, power, normal]) => {
        const t = at(top);
        const b = at(bot);
        const closed = closedOf(view, device.id, top, bot, normal === 'NC');
        return (
          <g key={top}>
            <Conductor d={`M${t.offset.x} ${t.offset.y + 1.5}V-2.2`} />
            <Contact x={t.offset.x} yTop={-2.2} yBottom={2.2} normal={normal} closed={closed} power={power} />
            <Conductor d={`M${b.offset.x} 2.2V${b.offset.y - 1.5}`} />
          </g>
        );
      })}
      <Conductor d={`M${a1.offset.x} ${a1.offset.y + 1.4}V${coilTop}`} />
      <Conductor d={`M${a2.offset.x} ${a2.offset.y + 1.4}V${coilTop}`} />
      <Coil x={a1.offset.x} y={coilTop} w={a2.offset.x - a1.offset.x} h={2.2} on={on} />
      <MechLink d={`M${a1.offset.x + (a2.offset.x - a1.offset.x) / 2} ${coilTop}V0M${def.bounds.minX + 1.2} 0H${def.bounds.maxX - 1.2}`} />
      <Tag x={2} y={def.bounds.maxY - 3.4} text={tagOf(device)} anchor="start" />
      <Caption x={2} y={def.bounds.maxY - 1.9} text={labelOf(device)} anchor="start" />
    </g>
  );
}

/** Pulsadores e interruptores: un contacto con su accionamiento al lado [R5 §7]. */
function ManualArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const contact = def.internals.contacts[0];
  const actuator = def.internals.actuators[0];
  const top = def.terminals.find((t) => t.dir === 'N');
  const bottom = def.terminals.find((t) => t.dir === 'S');
  if (!contact || !top || !bottom) return <Body bounds={def.bounds} />;
  const closed = closedOf(view, device.id, contact.a, contact.b, contact.normal === 'NC');
  const kind =
    actuator?.kind === 'manual' && actuator.action === 'latching'
      ? 'mushroom'
      : actuator?.kind === 'manual' && actuator.action === 'maintained'
        ? 'toggle'
        : 'push';
  return (
    <g>
      <Body bounds={def.bounds} />
      <Conductor d={`M${top.offset.x} ${top.offset.y + 1.4}V-2.2`} />
      <Contact x={0} yTop={-2.2} yBottom={2.2} normal={contact.normal} closed={closed} />
      <Conductor d={`M${bottom.offset.x} 2.2V${bottom.offset.y - 1.4}`} />
      <ManualActuator x={2.2} y={0} kind={kind} actuated={view?.actuated ?? false} />
      <Tag x={def.bounds.minX + 0.8} y={def.bounds.maxY - 3.2} text={tagOf(device)} anchor="start" />
    </g>
  );
}

/** Piloto y foco: el símbolo de la carga en la columna del aparato [R5 §10]. */
function LoadArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const top = def.terminals.find((t) => t.dir === 'N')!;
  const bottom = def.terminals.find((t) => t.dir === 'S')!;
  const on = view?.energized === true;
  const colorKey = typeof device.props.color === 'string' ? device.props.color : 'white';
  const color = P.lamp[colorKey] ?? P.lamp.white!;
  return (
    <g>
      <Body bounds={def.bounds} />
      <Conductor d={`M${top.offset.x} ${top.offset.y + 1.4}V-2.4`} />
      {def.type === 'bulb' ? (
        <BulbSymbol x={0} y={-0.4} r={1.9} on={on} color={color} />
      ) : (
        <LampSymbol x={0} y={0} r={2.2} on={on} color={color} />
      )}
      <Conductor d={`M${bottom.offset.x} 2.4V${bottom.offset.y - 1.4}`} />
      <Tag x={def.bounds.minX + 0.8} y={def.bounds.maxY - 3.2} text={tagOf(device)} anchor="start" />
    </g>
  );
}
