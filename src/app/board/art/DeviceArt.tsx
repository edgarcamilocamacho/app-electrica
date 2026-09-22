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
import { BOARD_PALETTE, BOARD_STROKE, BODY_STROKE } from '../theme';
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
  WireCount,
} from './primitives';

const P = BOARD_PALETTE;

export interface DeviceArtProps {
  readonly device: DeviceInstance;
  readonly def: DeviceDefinition;
  readonly view?: DeviceView | undefined;
  /** Cuántos cables tiene cada borne, por clave de borne [R5 §6]. */
  readonly wireCounts?: ReadonlyMap<string, number> | undefined;
  /**
   * Qué capa dibujar. El cuerpo y el esquema van **debajo** de los cables; los tornillos y sus
   * marcaciones, **encima**, para que el cable termine visiblemente en el tornillo.
   */
  readonly layer?: 'body' | 'screws' | 'both';
}

const closedOf = (view: DeviceView | undefined, deviceId: string, a: string, b: string, fallback: boolean): boolean =>
  view?.contacts.get(`${deviceId}:${a}-${b}`) ?? fallback;

const tagOf = (device: DeviceInstance): string => (typeof device.props.ref === 'string' ? device.props.ref : '');
const labelOf = (device: DeviceInstance): string => (typeof device.props.label === 'string' ? device.props.label : '');

/** Columnas de la fila de arriba, ordenadas de izquierda a derecha. */
const topRow = (def: DeviceDefinition): readonly TerminalDef[] =>
  def.terminals.filter((t) => t.dir === 'N').sort((a, b) => a.offset.x - b.offset.x);

export function DeviceArt({ device, def, view, wireCounts, layer = 'both' }: DeviceArtProps): ReactElement {
  return (
    <g>
      {layer !== 'screws' && internals(device, def, view)}
      {layer !== 'body' &&
        def.terminals.map((t) => (
          <g key={t.id}>
            <title>{t.label}</title>
            <Screw x={t.offset.x} y={t.offset.y} size={t.screw} text={t.id} />
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
  if (def.type === 'ups') return <UpsArt device={device} def={def} view={view} />;
  if (def.type === 'contactor-3p') return <ContactorArt device={device} def={def} view={view} />;
  if (def.type === 'selector-3') return <SelectorArt device={device} def={def} view={view} />;
  if (def.category === 'sources') return <SupplyArt device={device} def={def} />;
  if (def.category === 'protection') return <BreakerArt device={device} def={def} view={view} />;
  if (def.category === 'relays' || def.category === 'timers') {
    return <RelayArt device={device} def={def} view={view} />;
  }
  if (def.type === 'bulb') return <BulbArt device={device} def={def} view={view} />;
  if (def.category === 'loads') return <LoadArt device={device} def={def} view={view} />;
  return <ManualArt device={device} def={def} view={view} />;
}

/** Acometida: poste de la calle con su cruceta, aisladores y la bajada a la bornera [R5 §2]. */
function SupplyArt({ device, def }: { device: DeviceInstance; def: DeviceDefinition }): ReactElement {
  const drops = def.terminals.filter((t) => t.dir === 'S');
  const top = def.bounds.minY;
  const armY = top + 1.6;
  const arm2Y = top + 3.4;
  const box = { ...def.bounds, minY: def.bounds.maxY - 3.6 };
  const label = labelOf(device);
  return (
    <g>
      {/* Poste, apenas cónico. */}
      <path
        d={`M-0.75 ${top}h1.5L1.1 ${box.minY}h-2.2z`}
        fill={P.bodyShade}
        stroke={P.bodyEdge}
        strokeWidth={BOARD_STROKE}
      />
      {/* Crucetas con sus aisladores. */}
      {[armY, arm2Y].map((y, i) => (
        <g key={y}>
          <rect
            x={def.bounds.minX + (i === 0 ? 0.6 : 1.8)}
            y={y - 0.28}
            width={def.bounds.maxX - def.bounds.minX - (i === 0 ? 1.2 : 3.6)}
            height={0.56}
            rx={0.2}
            fill={P.metal}
            stroke={P.bodyEdge}
            strokeWidth={BOARD_STROKE * 0.7}
          />
        </g>
      ))}
      {drops.map((t, i) => {
        const y = i % 2 === 0 ? armY : arm2Y;
        return (
          <g key={t.id}>
            <rect
              x={t.offset.x - 0.32}
              y={y - 1.1}
              width={0.64}
              height={0.9}
              rx={0.25}
              fill={P.screw}
              stroke={P.sym}
              strokeWidth={BOARD_STROKE * 0.7}
            />
            {/* La bajada cuelga con una curva suave hasta la bornera. */}
            <path
              d={`M${t.offset.x} ${y - 1.1}C${t.offset.x} ${y + 3} ${t.offset.x + (t.offset.x < 0 ? -1.4 : 1.4)} ${
                box.minY - 3
              } ${t.offset.x} ${t.offset.y - 1}`}
              fill="none"
              stroke={P.sym}
              strokeWidth={BOARD_STROKE * 1.2}
              strokeLinecap="round"
            />
          </g>
        );
      })}
      <Body bounds={box} />
      <Tag x={def.bounds.minX + 1.4} y={box.minY + 1.5} text={tagOf(device)} anchor="start" />
      {label && <Caption x={def.bounds.maxX - 1.2} y={box.minY - 1} text={label} anchor="end" />}
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
  const on = view?.energized === true;
  // Bobina chica, justo entre A1 y A2, para no cruzar la zona de contactos.
  const coil = { x: (a1.offset.x + a2.offset.x) / 2 - 1.1, y: a1.offset.y + 1.2, w: 2.2, h: 1.6 };
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
      <Conductor d={`M${a1.offset.x} ${a1.offset.y + 1.2}V${coil.y + coil.h / 2}H${coil.x}`} />
      <Conductor d={`M${a2.offset.x} ${a2.offset.y + 1.2}V${coil.y + coil.h / 2}H${coil.x + coil.w}`} />
      <Coil x={coil.x} y={coil.y} w={coil.w} h={coil.h} on={on} />
      <MechLink
        d={`M${coil.x + coil.w / 2} ${coil.y + coil.h}V0M${def.bounds.minX + 1.2} 0H${def.bounds.maxX - 1.2}`}
      />
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

/**
 * Base enchufable (relé o temporizador): la bobina en su columna y cada polo dibujado como un
 * conmutador entre sus tres tornillos. La geometría sale de los bornes, así que sirve igual para
 * la base de 8 y la de 11 pines.
 */
function RelayArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const actuator = def.internals.actuators[0];
  const at = (id: string) => def.terminals.find((t) => t.id === id)!;
  const timer = actuator?.kind === 'timer' ? actuator.timerType : undefined;
  const on = timer ? view?.timer?.output === true : view?.energized === true;
  const coilA = actuator && actuator.kind !== 'manual' ? at(actuator.terminals[0]) : undefined;
  const coilB = actuator && actuator.kind !== 'manual' ? at(actuator.terminals[1]) : undefined;

  // Los contactos vienen de a pares (NA y NC del mismo común).
  const commons = [...new Set(def.internals.contacts.map((c) => c.a))];

  return (
    <g>
      <Body bounds={def.bounds} />
      {coilA && coilB && (
        <g>
          <Conductor d={`M${coilA.offset.x} ${coilA.offset.y + 1.4}V-1.4`} />
          <Coil x={coilA.offset.x - 1.4} y={-1.4} w={2.8} h={2.8} on={on} {...(timer ? { timer } : {})} />
          <Conductor d={`M${coilB.offset.x} 1.4V${coilB.offset.y - 1.4}`} />
        </g>
      )}
      {commons.map((common) => {
        const no = def.internals.contacts.find((c) => c.a === common && c.normal === 'NO');
        const nc = def.internals.contacts.find((c) => c.a === common && c.normal === 'NC');
        if (!no || !nc) return null;
        const commonT = at(common);
        const noT = at(no.b);
        const ncT = at(nc.b);
        const upper = commonT.dir === 'N';
        const sign = upper ? 1 : -1;
        const pivotY = commonT.offset.y + sign * 3.4;
        const fixedY = commonT.offset.y + sign * 1.4;
        const closed = closedOf(view, device.id, common, no.b, false);
        const tipX = closed ? noT.offset.x : ncT.offset.x;
        return (
          <g key={common}>
            <Conductor d={`M${commonT.offset.x} ${commonT.offset.y + sign * 1.4}V${pivotY}`} />
            <Conductor d={`M${noT.offset.x} ${noT.offset.y + sign * 1.4}V${fixedY}`} />
            <Conductor d={`M${ncT.offset.x} ${ncT.offset.y + sign * 1.4}V${fixedY}`} />
            <circle cx={commonT.offset.x} cy={pivotY} r={0.13} fill={P.sym} />
            <Conductor
              d={`M${commonT.offset.x} ${pivotY}L${tipX} ${fixedY}`}
              width={BOARD_STROKE * 1.2}
            />
            <MechLink d={`M${coilA ? coilA.offset.x : def.bounds.minX + 1} ${(pivotY + fixedY) / 2}H${commonT.offset.x}`} />
          </g>
        );
      })}
      {timer && <TimerFace view={view} x={def.bounds.maxX - 2.6} />}
      <Tag x={(coilA?.offset.x ?? def.bounds.minX) + 2} y={def.bounds.maxY - 1.6} text={tagOf(device)} anchor="start" />
    </g>
  );
}

/** Carátula del temporizador: el tiempo que va corriendo y el testigo de salida. */
function TimerFace({ view, x }: { view?: DeviceView; x: number }): ReactElement {
  const timer = view?.timer;
  const seconds = timer ? Math.max(0, timer.presetMs - timer.elapsedMs) / 1000 : undefined;
  return (
    <g>
      <circle cx={x} cy={0} r={1.7} fill={P.bodyShade} stroke={P.bodyEdge} strokeWidth={BOARD_STROKE} />
      <circle cx={x} cy={0} r={0.5} fill={timer?.output ? '#f59e0b' : P.screw} stroke={P.sym} strokeWidth={0.08} />
      {seconds !== undefined && (
        <Caption x={x} y={3.2} text={`${seconds.toFixed(1)} s`} />
      )}
    </g>
  );
}

/** Selector de 3 posiciones: un común y dos salidas [I3]. */
function SelectorArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const at = (id: string) => def.terminals.find((t) => t.id === id)!;
  const common = at('1');
  const out1 = at('2');
  const out2 = at('4');
  const position = view?.position ?? 0;
  const tip = position === 1 ? out1.offset.x : position === 2 ? out2.offset.x : common.offset.x;
  return (
    <g>
      <Body bounds={def.bounds} />
      <Conductor d={`M${common.offset.x} ${common.offset.y + 1.4}V-1.6`} />
      <Conductor d={`M${out1.offset.x} ${out1.offset.y - 1.4}V2`} />
      <Conductor d={`M${out2.offset.x} ${out2.offset.y - 1.4}V2`} />
      <circle cx={common.offset.x} cy={-1.6} r={0.13} fill={P.sym} />
      <Conductor d={`M${common.offset.x} -1.6L${tip} 2`} width={BOARD_STROKE * 1.2} />
      <MechLink d={`M${common.offset.x} -1.6V-3.4`} />
      <Conductor d={`M${common.offset.x - 1.2} -3.4H${common.offset.x + 1.2}`} />
      <Tag x={def.bounds.minX + 1} y={def.bounds.maxY - 3.2} text={tagOf(device)} anchor="start" />
    </g>
  );
}

/** UPS: la entrada solo enciende su indicador y la salida es una fuente propia [R5 §11]. */
function UpsArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const at = (id: string) => def.terminals.find((t) => t.id === id)!;
  const lin = at('L1');
  const nin = at('N1');
  const lout = at('L2');
  const nout = at('N2');
  const on = view?.energized === true;
  return (
    <g>
      <Body bounds={def.bounds} />
      <Conductor d={`M${lin.offset.x} ${lin.offset.y + 1.4}V-3.4H${(lin.offset.x + nin.offset.x) / 2 - 1.6}`} />
      <Conductor d={`M${nin.offset.x} ${nin.offset.y + 1.4}V-3.4H${(lin.offset.x + nin.offset.x) / 2 + 1.6}`} />
      <LampSymbol x={(lin.offset.x + nin.offset.x) / 2} y={-3.4} r={1.6} on={on} color={P.lamp.green!} />
      <rect
        x={lout.offset.x - 2.6}
        y={1.2}
        width={5.2}
        height={3.4}
        rx={0.4}
        fill={P.bodyShade}
        stroke={P.sym}
        strokeWidth={BOARD_STROKE}
      />
      <Conductor d={`M${lout.offset.x - 1.6} 2.9a0.8 0.8 0 0 1 1.6 0a0.8 0.8 0 0 0 1.6 0`} />
      <Conductor d={`M${lout.offset.x} 4.6V${lout.offset.y - 1.4}`} />
      <Conductor d={`M${nout.offset.x} ${nout.offset.y - 1.4}V2.9H${lout.offset.x + 2.6}`} />
      <Tag x={def.bounds.minX + 1} y={def.bounds.maxY - 2.6} text={tagOf(device)} anchor="start" />
    </g>
  );
}

/** Foco: la silueta del bombillo es el aparato, con los dos bornes abajo [R5 §10]. */
function BulbArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const x1 = def.terminals.find((t) => t.id === 'X1')!;
  const x2 = def.terminals.find((t) => t.id === 'X2')!;
  const on = view?.energized === true;
  const color = P.lamp.amber!;
  const glass = { cx: 0, cy: -3.2, r: 4 };
  const neckTop = 0.2;
  const baseTop = 1.5;
  const baseBottom = 5.4;
  return (
    <g>
      {on && <circle cx={glass.cx} cy={glass.cy} r={glass.r * 1.6} fill={color} opacity={0.28} />}
      {/* Cuello entre la ampolla y el casquillo. */}
      <path
        d={`M-2.9 ${neckTop}H2.9L2.4 ${baseTop}H-2.4Z`}
        fill={on ? color : P.body}
        stroke={P.bodyEdge}
        strokeWidth={BODY_STROKE}
      />
      {/* Ampolla. */}
      <circle
        cx={glass.cx}
        cy={glass.cy}
        r={glass.r}
        fill={on ? color : P.body}
        stroke={P.bodyEdge}
        strokeWidth={BODY_STROKE}
      />
      {/* Casquillo roscado. */}
      <rect
        x={-2.4}
        y={baseTop}
        width={4.8}
        height={baseBottom - baseTop}
        rx={0.5}
        fill={P.bodyShade}
        stroke={P.bodyEdge}
        strokeWidth={BODY_STROKE}
      />
      <path
        d={`M-2.4 2.5H2.4M-2.4 3.5H2.4M-2.4 4.5H2.4`}
        stroke={P.bodyEdge}
        strokeWidth={BOARD_STROKE * 0.8}
        opacity={0.7}
        fill="none"
      />
      {/* Filamento: sube de cada borne y hace la V dentro de la ampolla. */}
      <Conductor
        d={`M${x1.offset.x} ${x1.offset.y - 1.2}V${glass.cy + 1.6}l1.1 -2.2l0.9 1.6l0.9 -1.6l1.1 2.2V${x2.offset.y - 1.2}`}
      />
      <Tag x={def.bounds.maxX - 0.4} y={glass.cy} text={tagOf(device)} anchor="end" />
    </g>
  );
}

/** Piloto: el símbolo de la carga en la columna del aparato [R5 §10]. */
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
