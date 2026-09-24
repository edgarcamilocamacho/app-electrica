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
import { t } from '../../i18n/t';
import type { Dir, Point } from '../../../core/model/types';
import { BOARD_PALETTE, BOARD_STROKE, BODY_STROKE, FONT_FAMILY, LEAD, SMALL_FONT } from '../theme';
import {
  Body,
  BulbSymbol,
  Caption,
  Changeover,
  changeoverTip,
  type ChangeoverGeometry,
  Coil,
  Conductor,
  Indicator,
  Contact,
  LampSymbol,
  Lever,
  LightsProvider,
  ManualActuator,
  MechLink,
  RotationProvider,
  Screw,
  Tag,
  TagBlock,
  type TerminalLight,
  useLights,
  useUpright,
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
  /** Bornes con tensión y el color de su cable, durante la simulación [R7 §4]. */
  readonly lights?: ReadonlyMap<string, TerminalLight> | undefined;
}

const closedOf = (view: DeviceView | undefined, deviceId: string, a: string, b: string, fallback: boolean): boolean =>
  view?.contacts.get(`${deviceId}:${a}-${b}`) ?? fallback;

const tagOf = (device: DeviceInstance): string => (typeof device.props.ref === 'string' ? device.props.ref : '');
const labelOf = (device: DeviceInstance): string => (typeof device.props.label === 'string' ? device.props.label : '');

/** El preset del temporizador, para mostrarlo en la carátula también mientras se edita. */
const presetOf = (device: DeviceInstance): number =>
  typeof device.props.presetMs === 'number' ? device.props.presetMs : 0;

/** La leyenda del aparato, solo si el usuario escribió una. */
const captionOf = (device: DeviceInstance): { caption?: string } => {
  const label = labelOf(device);
  return label ? { caption: label } : {};
};

/** Columnas de la fila de arriba, ordenadas de izquierda a derecha. */
const topRow = (def: DeviceDefinition): readonly TerminalDef[] =>
  def.terminals.filter((t) => t.dir === 'N').sort((a, b) => a.offset.x - b.offset.x);

export function DeviceArt({ device, def, view, wireCounts, layer = 'both', lights }: DeviceArtProps): ReactElement {
  return (
    <RotationProvider value={device.rotation}>
      {layer !== 'screws' && <LightsProvider value={lights}>{internals(device, def, view)}</LightsProvider>}
      {layer !== 'body' &&
        def.terminals.map((t) => (
          <g key={t.id}>
            <title>{t.label}</title>
            <Screw x={t.offset.x} y={t.offset.y} size={t.screw} text={t.id} />
            <WireCount
              x={t.offset.x}
              y={t.offset.y}
              edge={t.dir}
              count={wireCounts?.get(terminalKey({ deviceId: device.id, terminalId: t.id })) ?? 0}
            />
          </g>
        ))}
    </RotationProvider>
  );
}

function internals(device: DeviceInstance, def: DeviceDefinition, view: DeviceView | undefined): ReactElement {
  if (def.type === 'ups') return <UpsArt device={device} def={def} view={view} />;
  if (def.type === 'power-monitor') return <PowerMonitorArt device={device} def={def} view={view} />;
  if (def.type === 'phase-monitor') return <PhaseMonitorArt device={device} def={def} view={view} />;
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

/**
 * Acometida: la bajada del poste de la calle [R5 §2]. Un aislador por borne, en su misma columna,
 * para que las bajadas queden rectas y no se crucen.
 */
function SupplyArt({ device, def }: { device: DeviceInstance; def: DeviceDefinition }): ReactElement {
  const lit = useLights();
  const drops = def.terminals.filter((t) => t.dir === 'S');
  const top = def.bounds.minY;
  const armY = top + 2.4;
  const braceY = top + 4.6;
  const box = { ...def.bounds, minY: def.bounds.maxY - 3.6 };
  const left = def.bounds.minX + 0.9;
  const right = def.bounds.maxX - 0.9;
  return (
    <g>
      {/* Poste, apenas cónico, hasta la bornera. */}
      <path
        d={`M-0.5 ${top}h1L0.95 ${box.minY}h-1.9z`}
        fill={P.bodyShade}
        stroke={P.bodyEdge}
        strokeWidth={BODY_STROKE}
      />
      {/* Tornapuntas de la cruceta. */}
      <Conductor
        d={`M-0.9 ${braceY}L${left + 0.6} ${armY + 0.3}M0.9 ${braceY}L${right - 0.6} ${armY + 0.3}`}
        color={P.bodyEdge}
        width={BOARD_STROKE * 0.9}
      />
      {/* Cruceta. */}
      <rect
        x={left}
        y={armY - 0.3}
        width={right - left}
        height={0.6}
        rx={0.22}
        fill={P.metal}
        stroke={P.bodyEdge}
        strokeWidth={BOARD_STROKE * 0.8}
      />
      {drops.map((t) => (
        <g key={t.id}>
          {/* Aislador de campana sobre la cruceta. */}
          <path
            d={`M${t.offset.x - 0.45} ${armY - 0.3}v-0.5a0.45 0.45 0 0 1 0.9 0v0.5z`}
            fill={P.screw}
            stroke={P.bodyEdge}
            strokeWidth={BOARD_STROKE * 0.7}
          />
          {/* Bajada recta hasta su borne. */}
          <Conductor d={`M${t.offset.x} ${armY - 0.8}V${t.offset.y - LEAD}`} width={BOARD_STROKE * 1.2} light={lit(t.id)} />
        </g>
      ))}
      <Body bounds={box} />
      <TagBlock
        x={def.bounds.minX + 1}
        y={box.minY + 1.5}
        tag={tagOf(device)}
        {...captionOf(device)}
        anchor="start"
      />
    </g>
  );
}

/** Taco: una cuchilla por polo y la palanca a la derecha [R5 §8]. */
function BreakerArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const lit = useLights();
  const columns = topRow(def);
  const bottom = def.terminals.filter((t) => t.dir === 'S').sort((a, b) => a.offset.x - b.offset.x);
  const leverX = def.bounds.maxX - 1.5;
  return (
    <g>
      <Body bounds={def.bounds} />
      {columns.map((t, i) => {
        const b = bottom[i]!;
        const closed = closedOf(view, device.id, t.id, b.id, false);
        return (
          <g key={t.id}>
            <Conductor d={`M${t.offset.x} ${t.offset.y + LEAD}V-2.2`} light={lit(t.id)} />
            <Contact
              x={t.offset.x}
              yTop={-2.2}
              yBottom={2.2}
              normal="NO"
              closed={closed}
              fixedLight={lit(t.id)}
              bladeLight={lit(b.id)}
            />
            <Conductor d={`M${b.offset.x} 2.2V${b.offset.y - LEAD}`} light={lit(b.id)} />
          </g>
        );
      })}
      <MechLink d={`M${columns[0]!.offset.x - 0.8} 0H${leverX - 0.9}`} />
      <Lever x={leverX} y={0} on={view?.actuated ?? false} />
      <TagBlock
        x={columns[0]!.offset.x - 1.5}
        y={4.6}
        tag={tagOf(device)}
        {...captionOf(device)}
        anchor="end"
      />
    </g>
  );
}

/** Contactor: bobina arriba entre los bornes de potencia y los cinco contactos debajo [R5 §9]. */
function ContactorArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const lit = useLights();
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
  // Bobina chica, en la misma línea que A1 y A2: no le tapa la columna a ningún borne.
  const coil = { x: (a1.offset.x + a2.offset.x) / 2 - 0.85, y: a1.offset.y - 0.6, w: 1.7, h: 1.2 };
  const lastX = at('21').offset.x;
  return (
    <g>
      <Body bounds={def.bounds} />
      {poles.map(([topId, botId, power, normal]) => {
        const t = at(topId);
        const b = at(botId);
        const closed = closedOf(view, device.id, topId, botId, normal === 'NC');
        return (
          <g key={topId}>
            <Conductor d={`M${t.offset.x} ${t.offset.y + LEAD}V-2.2`} light={lit(topId)} />
            <Contact
              x={t.offset.x}
              yTop={-2.2}
              yBottom={2.2}
              normal={normal}
              closed={closed}
              power={power}
              fixedLight={lit(topId)}
              bladeLight={lit(botId)}
            />
            <Conductor d={`M${b.offset.x} 2.2V${b.offset.y - LEAD}`} light={lit(botId)} />
          </g>
        );
      })}
      {/* Los arranques quedan bajo el tornillo, que se dibuja encima. */}
      <Conductor d={`M${a1.offset.x} ${a1.offset.y}H${coil.x}`} light={lit('A1')} />
      <Conductor d={`M${a2.offset.x} ${a2.offset.y}H${coil.x + coil.w}`} light={lit('A2')} />
      <Coil x={coil.x} y={coil.y} w={coil.w} h={coil.h} on={on} />
      {/* El vínculo mecánico cruza las cuchillas; no baja desde la bobina para no tapar bornes. */}
      <MechLink d={`M${at('1').offset.x - 1} 0H${lastX + 1}`} />
      <TagBlock
        x={(lastX + 0.8 + def.bounds.maxX) / 2}
        y={-0.2}
        tag={tagOf(device)}
        {...captionOf(device)}
      />
    </g>
  );
}

/** Pulsadores e interruptores: un contacto con su accionamiento al lado [R5 §7]. */
function ManualArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const lit = useLights();
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
      <Conductor d={`M${top.offset.x} ${top.offset.y + LEAD}V-2.2`} light={lit(top.id)} />
      <Contact
        x={0}
        yTop={-2.2}
        yBottom={2.2}
        normal={contact.normal}
        closed={closed}
        fixedLight={lit(top.id)}
        bladeLight={lit(bottom.id)}
      />
      <Conductor d={`M${bottom.offset.x} 2.2V${bottom.offset.y - LEAD}`} light={lit(bottom.id)} />
      <ManualActuator x={def.bounds.maxX - 1.5} y={0} kind={kind} actuated={view?.actuated ?? false} />
      <TagBlock x={def.bounds.minX + 0.7} y={4.6} tag={tagOf(device)} {...captionOf(device)} anchor="start" />
    </g>
  );
}

/**
 * Disposición del esquema de cada zócalo. Los tornillos van donde están en el zócalo real, así que
 * los bornes de un mismo polo caen en costados distintos: por eso cada polo declara dónde queda su
 * conmutador, y los conductores se rutean solos desde cada borne hasta el punto que le toca.
 */
interface PoleLayout {
  /** Pivote de la cuchilla. */
  readonly pivot: Point;
  /** Hacia dónde quedan los dos contactos fijos. */
  readonly toward: Dir;
  /** Lado del eje (−1 o +1) en el que se apoya el contacto NA. */
  readonly noSide: -1 | 1;
  /** Largo de la cuchilla, si el sitio pide una más corta. */
  readonly length?: number;
}

interface SocketLayout {
  /** Por borne común. */
  readonly poles: Readonly<Record<string, PoleLayout>>;
  /** Centro de la bobina. */
  readonly coil: Point;
  /** Tramos punteados del vínculo mecánico. */
  readonly link: string;
}

const BLADE_LENGTH = 3.2;
const BLADE_SPREAD = 1;
const COIL_SIZE = { w: 2.6, h: 1.7 };

/** Zócalo de 8 pines: los dos comunes abajo y sus cuatro contactos arriba. */
const SOCKET_8_ART: SocketLayout = {
  poles: {
    '8': { pivot: { x: -4, y: -2.2 }, toward: 'N', noSide: -1 },
    '1': { pivot: { x: 4, y: -2.2 }, toward: 'N', noSide: 1 },
  },
  coil: { x: 0, y: 5.15 },
  link: 'M-5 -3.8H5M0 -3.8V4.3',
};

/** Zócalo de 11 pines: el 9 sale por el costado izquierdo y el 3 y el 4 por el derecho. */
const SOCKET_11_ART: SocketLayout = {
  poles: {
    // El polo del 9 abre hacia el oeste: sus dos fijos se apilan y cada borne entra derecho.
    '11': { pivot: { x: -2.8, y: 2 }, toward: 'W', noSide: 1, length: 2.6 },
    '1': { pivot: { x: 2, y: 0.8 }, toward: 'E', noSide: 1 },
    '6': { pivot: { x: 2, y: -2.4 }, toward: 'N', noSide: -1 },
  },
  coil: { x: 0, y: 5.15 },
  link: 'M-4.5 0.8H5M-4.5 0.8V2.8M2 0.8V-2.4M0 0.8V4.3',
};

const SOCKET_ART: Readonly<Record<string, SocketLayout>> = {
  'relay-8': SOCKET_8_ART,
  'timer-ton': SOCKET_8_ART,
  'timer-tof': SOCKET_8_ART,
  'timer-mixed': SOCKET_8_ART,
  'relay-11': SOCKET_11_ART,
};

/** Conductor de un borne a un punto del esquema: sale recto del tornillo y dobla una vez. */
function leadPath(terminal: TerminalDef, to: Point): string {
  const from = {
    x: terminal.offset.x + (terminal.dir === 'W' ? LEAD : terminal.dir === 'E' ? -LEAD : 0),
    y: terminal.offset.y + (terminal.dir === 'N' ? LEAD : terminal.dir === 'S' ? -LEAD : 0),
  };
  const vertical = terminal.dir === 'N' || terminal.dir === 'S';
  const corner = vertical ? { x: from.x, y: to.y } : { x: to.x, y: from.y };
  return `M${from.x} ${from.y}L${corner.x} ${corner.y}L${to.x} ${to.y}`;
}

/**
 * Base enchufable (relé o temporizador): el cuerpo con sus tornillos donde están en el zócalo real
 * y, adentro, la bobina y un conmutador por polo. En el temporizador mixto [R7 §2] solo el polo
 * temporizado lleva la marca de retardo; el otro es el de un relé.
 */
function RelayArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const lit = useLights();
  const actuators = def.internals.actuators;
  const timerActuator = actuators.find((a) => a.kind === 'timer');
  const coilActuator = actuators.find((a) => a.kind === 'coil');
  const at = (id: string) => def.terminals.find((t) => t.id === id)!;
  const timer = timerActuator?.kind === 'timer' ? timerActuator.timerType : undefined;
  const mixed = timer !== undefined && coilActuator !== undefined;
  // Con bobina instantánea, se ilumina al energizarse; en un temporizador simple, con su salida.
  const on = coilActuator ? view?.energized === true : view?.timer?.output === true;
  const coilPins = (timerActuator ?? coilActuator)?.terminals;
  const timedBy = (actuatorId: string): boolean => actuators.find((a) => a.id === actuatorId)?.kind === 'timer';
  const art = SOCKET_ART[def.type];
  if (!art) return <Body bounds={def.bounds} />;

  const commons = [...new Set(def.internals.contacts.map((c) => c.a))];
  const coil = { x: art.coil.x - COIL_SIZE.w / 2, y: art.coil.y - COIL_SIZE.h / 2, ...COIL_SIZE };

  return (
    <g>
      <Body bounds={def.bounds} />
      {coilPins && (
        <g>
          <Conductor d={leadPath(at(coilPins[0]), { x: coil.x, y: art.coil.y })} light={lit(coilPins[0])} />
          <Conductor d={leadPath(at(coilPins[1]), { x: coil.x + coil.w, y: art.coil.y })} light={lit(coilPins[1])} />
          <Coil x={coil.x} y={coil.y} w={coil.w} h={coil.h} on={on} {...(timer ? { timer } : {})} />
        </g>
      )}
      {commons.map((common) => {
        const pole = art.poles[common];
        const no = def.internals.contacts.find((c) => c.a === common && c.normal === 'NO');
        const nc = def.internals.contacts.find((c) => c.a === common && c.normal === 'NC');
        if (!pole || !no || !nc) return null;
        const geometry: ChangeoverGeometry = {
          pivot: pole.pivot,
          toward: pole.toward,
          length: pole.length ?? BLADE_LENGTH,
          spread: BLADE_SPREAD,
        };
        const closed = closedOf(view, device.id, common, no.b, false);
        return (
          <g key={common}>
            <Conductor d={leadPath(at(common), pole.pivot)} light={lit(common)} />
            <Conductor d={leadPath(at(no.b), changeoverTip(geometry, pole.noSide))} light={lit(no.b)} />
            <Conductor d={leadPath(at(nc.b), changeoverTip(geometry, -pole.noSide))} light={lit(nc.b)} />
            <Changeover
              geometry={geometry}
              side={closed ? pole.noSide : -pole.noSide}
              light={lit(common)}
              {...(timer && timedBy(no.actuator) ? { delay: timer } : {})}
            />
          </g>
        );
      })}
      {/* Vínculo mecánico: cruza las cuchillas y baja a la bobina. */}
      <MechLink d={art.link} />
      {timer && (
        <TimerFace
          view={view}
          preset={presetOf(device)}
          label={mixed ? t('board.timerType.MIXED') : t(`board.timerType.${timer}`)}
          x={def.bounds.maxX - 3.4}
        />
      )}
      <TagBlock x={art.coil.x} y={1.9} tag={tagOf(device)} {...captionOf(device)} />
    </g>
  );
}

/** Carátula del temporizador: qué clase es, el tiempo que falta y el anillo de avance del preset. */
function TimerFace({
  view,
  preset,
  label,
  x,
}: {
  view?: DeviceView;
  preset: number;
  /** TON, TOFF o MIXTO: lo único que distingue a los temporizadores a simple vista [R5 §22]. */
  label: string;
  x: number;
}): ReactElement {
  const timer = view?.timer;
  const fraction = timer && timer.presetMs > 0 ? Math.min(1, timer.elapsedMs / timer.presetMs) : 0;
  const seconds = timer ? Math.max(0, timer.presetMs - timer.elapsedMs) / 1000 : preset / 1000;
  const r = 1.5;
  const circumference = 2 * Math.PI * r;
  const upright = useUpright(x, -0.2);
  return (
    <g>
      <circle cx={x} cy={-0.6} r={r + 0.7} fill={P.bodyShade} stroke={P.bodyEdge} strokeWidth={BOARD_STROKE} />
      <circle cx={x} cy={-0.6} r={r} fill="none" stroke={P.screw} strokeWidth={0.35} />
      <circle
        cx={x}
        cy={-0.6}
        r={r}
        fill="none"
        stroke={P.selection}
        strokeWidth={0.35}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        transform={`rotate(-90 ${x} -0.6)`}
      />
      <text
        x={x}
        y={-0.2}
        {...upright}
        textAnchor="middle"
        fontSize={SMALL_FONT * 1.15}
        fontFamily={FONT_FAMILY}
        fontWeight={700}
        fill={P.ink}
      >
        {seconds.toFixed(1)}
      </text>
      <Caption x={x} y={2.6} text={t('board.seconds')} />
      {/* Qué temporizador es: es lo único que los distingue a simple vista. */}
      <Tag x={x} y={4.6} text={label} />
      <circle
        cx={x}
        cy={-4.4}
        r={0.45}
        fill={timer?.output ? '#f59e0b' : P.screw}
        stroke={P.bodyEdge}
        strokeWidth={0.08}
      />
    </g>
  );
}

/** Selector de 3 posiciones: un común, dos salidas y el centro en vacío [I3]. */
function SelectorArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const lit = useLights();
  const at = (id: string) => def.terminals.find((t) => t.id === id)!;
  const common = at('1');
  const out1 = at('2');
  const out2 = at('4');
  const position = view?.position ?? 0;
  // La cuchilla gira sobre un pivote y se para en una de tres puntas; la del medio no conduce.
  const pivot = { x: common.offset.x, y: -1 };
  const fixedY = 2;
  const spread = 1.6;
  const tipX = pivot.x + (position === 1 ? -spread : position === 2 ? spread : 0);
  const knob = { x: def.bounds.maxX - 1.8, y: -4.4 };
  return (
    <g>
      <Body bounds={def.bounds} />
      <Conductor d={`M${common.offset.x} ${common.offset.y + LEAD}V${pivot.y}`} light={lit(common.id)} />
      <Conductor d={`M${out1.offset.x} ${out1.offset.y - LEAD}V${fixedY}H${pivot.x - spread}`} light={lit(out1.id)} />
      <Conductor d={`M${out2.offset.x} ${out2.offset.y - LEAD}V${fixedY}H${pivot.x + spread}`} light={lit(out2.id)} />
      <circle cx={pivot.x} cy={pivot.y} r={0.15} fill={lit(common.id)?.color ?? P.sym} />
      <Conductor d={`M${pivot.x} ${pivot.y}L${tipX} ${fixedY}`} width={BOARD_STROKE * 1.25} light={lit(common.id)} />
      {/* Perilla: apunta a la posición elegida, que es lo que dice en qué estado está. */}
      <MechLink d={`M${pivot.x} ${pivot.y}H${knob.x}V${knob.y + 1.1}`} />
      <SelectorKnob x={knob.x} y={knob.y} position={position} />
      <TagBlock x={def.bounds.minX + 0.8} y={4.6} tag={tagOf(device)} {...captionOf(device)} anchor="start" />
    </g>
  );
}

/** Perilla del selector: tres marcas y un puntero que se para en la posición actual. */
function SelectorKnob({ x, y, position }: { x: number; y: number; position: number }): ReactElement {
  const r = 1.1;
  const angle = position === 1 ? -0.7 : position === 2 ? 0.7 : 0;
  const tip = { x: x + Math.sin(angle) * r, y: y - Math.cos(angle) * r };
  return (
    <g>
      {[-0.7, 0, 0.7].map((mark) => (
        <circle
          key={mark}
          cx={x + Math.sin(mark) * (r + 0.5)}
          cy={y - Math.cos(mark) * (r + 0.5)}
          r={0.12}
          fill={P.muted}
        />
      ))}
      <circle cx={x} cy={y} r={r} fill={P.bodyShade} stroke={P.bodyEdge} strokeWidth={BOARD_STROKE} />
      <Conductor d={`M${x} ${y}L${tip.x} ${tip.y}`} color={P.bodyEdge} width={BOARD_STROKE * 1.6} />
      <circle cx={x} cy={y} r={0.22} fill={P.bodyEdge} />
    </g>
  );
}

/** ¿Está encendida esta carga del aparato? */
const loadOn = (view: DeviceView | undefined, deviceId: string, a: string, b: string): boolean =>
  view?.loads.get(`${deviceId}:${a}-${b}`) === true;

/**
 * Monitor de energía con contactor de cuatro polos [R5 §24]: los cuatro contactos dejan pasar de
 * arriba hacia abajo (la flecha lo dice) y arriba hay un testigo por fase de entrada.
 */
function PowerMonitorArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const lit = useLights();
  const at = (id: string) => def.terminals.find((t) => t.id === id)!;
  const poles: readonly [string, string][] = [
    ['A1', 'A2'],
    ['B1', 'B2'],
    ['C1', 'C2'],
    ['N1', 'N2'],
  ];
  const phases: readonly [string, string][] = [
    ['A1', P.lamp.red!],
    ['B1', P.lamp.amber!],
    ['C1', P.lamp.blue!],
  ];
  return (
    <g>
      <Body bounds={def.bounds} />
      {poles.map(([topId, botId]) => {
        const t = at(topId);
        const b = at(botId);
        const closed = closedOf(view, device.id, topId, botId, true);
        return (
          <g key={topId}>
            <Conductor d={`M${t.offset.x} ${t.offset.y + LEAD}V-2.2`} light={lit(topId)} />
            <Contact
              x={t.offset.x}
              yTop={-2.2}
              yBottom={2.2}
              normal="NO"
              closed={closed}
              power
              fixedLight={lit(topId)}
              bladeLight={lit(botId)}
            />
            <Conductor d={`M${b.offset.x} 2.2V${b.offset.y - LEAD}`} light={lit(botId)} />
          </g>
        );
      })}
      {/* Testigos: uno por fase de entrada contra el neutro de entrada. */}
      {phases.map(([phase, color], i) => {
        const cx = -4 + i * 4;
        return (
          <g key={phase}>
            <Indicator x={cx} y={-5.6} on={loadOn(view, device.id, phase, 'N1')} color={color} />
            <Caption x={cx} y={-3.5} text={phase.slice(0, 1)} />
          </g>
        );
      })}
      {/* Flecha: la energía va de arriba hacia abajo. */}
      <Conductor d="M0 3.6V6.1" color={P.muted} width={BOARD_STROKE * 1.2} />
      <path d="M-0.7 5.7L0 6.9L0.7 5.7Z" fill={P.muted} />
      <MechLink d={`M${at('A1').offset.x - 1.2} 0H${at('N1').offset.x + 1.2}`} />
      <TagBlock
        x={(at('N1').offset.x + 1.2 + def.bounds.maxX) / 2}
        y={-0.2}
        tag={tagOf(device)}
        {...captionOf(device)}
      />
    </g>
  );
}

/**
 * Protector de fase [R5 §24]: A1–A2 solo encienden su testigo y el aviso sale por un contacto
 * conmutado. Sano, el común queda con el 14; en falla, con el 12.
 */
function PhaseMonitorArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const lit = useLights();
  const at = (id: string) => def.terminals.find((t) => t.id === id)!;
  const a1 = at('A1');
  const a2 = at('A2');
  const healthy = closedOf(view, device.id, '11', '14', true);
  const geometry: ChangeoverGeometry = {
    pivot: { x: at('11').offset.x, y: 1.5 },
    toward: 'N',
    length: 3.2,
    spread: 1,
  };
  const fixedY = geometry.pivot.y - geometry.length;
  return (
    <g>
      <Body bounds={def.bounds} />
      <Conductor d={`M${a1.offset.x} ${a1.offset.y + LEAD}V-4.2H-1.3`} light={lit('A1')} />
      <Conductor d={`M${a2.offset.x} ${a2.offset.y + LEAD}V-4.2H1.3`} light={lit('A2')} />
      <Indicator x={0} y={-4.2} r={1.1} on={loadOn(view, device.id, 'A1', 'A2')} color={P.lamp.green!} />
      <Conductor d={`M${at('14').offset.x} ${8 - LEAD}V${fixedY}H${geometry.pivot.x - geometry.spread}`} light={lit('14')} />
      <Conductor d={`M${at('12').offset.x} ${8 - LEAD}V${fixedY}H${geometry.pivot.x + geometry.spread}`} light={lit('12')} />
      <Conductor d={`M${at('11').offset.x} ${8 - LEAD}V${geometry.pivot.y}`} light={lit('11')} />
      <Changeover geometry={geometry} side={healthy ? -1 : 1} light={lit('11')} />
      {/* La electrónica del protector mueve el contacto. */}
      <MechLink d={`M0 -3.1V0`} />
      <TagBlock x={def.bounds.minX + 0.8} y={4.8} tag={tagOf(device)} {...captionOf(device)} anchor="start" />
    </g>
  );
}

/** UPS: la entrada solo enciende su indicador y la salida es una fuente propia [R5 §11]. */
function UpsArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const lit = useLights();
  const at = (id: string) => def.terminals.find((t) => t.id === id)!;
  const lin = at('L1');
  const nin = at('N1');
  const lout = at('L2');
  const nout = at('N2');
  const on = view?.energized === true;
  const inputX = (lin.offset.x + nin.offset.x) / 2;
  return (
    <g>
      <Body bounds={def.bounds} />
      <Conductor d={`M${lin.offset.x} ${lin.offset.y + LEAD}V-3.4H${inputX - 1.7}`} light={lit('L1')} />
      <Conductor d={`M${nin.offset.x} ${nin.offset.y + LEAD}V-3.4H${inputX + 1.7}`} light={lit('N1')} />
      <LampSymbol x={inputX} y={-3.4} r={1.7} on={on} color={P.lamp.green!} />
      <rect
        x={lout.offset.x - 2.6}
        y={1.2}
        width={5.2}
        height={3.4}
        rx={0.5}
        fill={P.bodyShade}
        stroke={P.sym}
        strokeWidth={BOARD_STROKE}
      />
      <Conductor d={`M${lout.offset.x - 1.6} 2.9a0.8 0.8 0 0 1 1.6 0a0.8 0.8 0 0 0 1.6 0`} />
      <Conductor d={`M${lout.offset.x} 4.6V${lout.offset.y - LEAD}`} light={lit('L2')} />
      <Conductor d={`M${nout.offset.x} ${nout.offset.y - LEAD}V2.9H${lout.offset.x + 2.6}`} light={lit('N2')} />
      <TagBlock x={def.bounds.minX + 1} y={1.4} tag={tagOf(device)} {...captionOf(device)} anchor="start" />
    </g>
  );
}

/** Foco: la silueta del bombillo es el aparato, con los dos bornes abajo [R5 §10]. */
function BulbArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const lit = useLights();
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
      {/* Filamento: sube de cada borne y hace la V dentro de la ampolla; cada mitad, del color de su borne. */}
      <Conductor d={`M${x1.offset.x} ${x1.offset.y - LEAD}V${glass.cy + 1.6}l1.1 -2.2l0.9 1.6`} light={lit('X1')} />
      <Conductor
        d={`M${x1.offset.x + 2} ${glass.cy + 1}l0.9 -1.6l1.1 2.2V${x2.offset.y - LEAD}`}
        light={lit('X2')}
      />
      <TagBlock x={def.bounds.maxX - 0.3} y={glass.cy} tag={tagOf(device)} {...captionOf(device)} anchor="end" />
    </g>
  );
}

/** Piloto: el símbolo de la carga en la columna del aparato [R5 §10]. */
function LoadArt({ device, def, view }: { device: DeviceInstance; def: DeviceDefinition; view?: DeviceView }): ReactElement {
  const lit = useLights();
  const top = def.terminals.find((t) => t.dir === 'N')!;
  const bottom = def.terminals.find((t) => t.dir === 'S')!;
  const on = view?.energized === true;
  const colorKey = typeof device.props.color === 'string' ? device.props.color : 'white';
  const color = P.lamp[colorKey] ?? P.lamp.white!;
  return (
    <g>
      <Body bounds={def.bounds} />
      <Conductor d={`M${top.offset.x} ${top.offset.y + LEAD}V-2.4`} light={lit(top.id)} />
      {def.type === 'bulb' ? (
        <BulbSymbol x={0} y={-0.4} r={1.9} on={on} color={color} />
      ) : (
        <LampSymbol x={0} y={0} r={2.2} on={on} color={color} />
      )}
      <Conductor d={`M${bottom.offset.x} 2.4V${bottom.offset.y - LEAD}`} light={lit(bottom.id)} />
      <TagBlock x={def.bounds.minX + 0.7} y={4.6} tag={tagOf(device)} {...captionOf(device)} anchor="start" />
    </g>
  );
}
