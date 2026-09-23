/**
 * Catálogo de aparatos [R5 §7–§13].
 *
 * Geometría en unidades de grid (10 px al 100 %). Convenciones:
 * - El cuerpo es simétrico respecto de la posición del aparato.
 * - Los tornillos quedan a una unidad del borde del cuerpo; el paso entre tornillos es 4.
 * - Fila de arriba: los cables salen al norte; fila de abajo, al sur.
 */
import type { DeviceDefinition, PropSpec, TerminalDef, TimerType } from './registry';
import { createDeviceRegistry } from './registry';

export const MIN_PRESET_MS = 100;
export const MAX_PRESET_MS = 3_600_000;

const REF: PropSpec = { key: 'ref', kind: 'ref', default: '' };
const LABEL: PropSpec = { key: 'label', kind: 'text', default: '' };
const CLOSED_INITIALLY: PropSpec = { key: 'initiallyActuated', kind: 'boolean', default: true };
const OPEN_INITIALLY: PropSpec = { key: 'initiallyActuated', kind: 'boolean', default: false };
const LAMP_COLOR: PropSpec = {
  key: 'color',
  kind: 'choice',
  default: 'red',
  options: ['red', 'green', 'amber', 'white', 'blue'],
};

const top = (id: string, label: string, x: number, y: number, screw: 'power' | 'control' = 'control'): TerminalDef => ({
  id,
  label,
  offset: { x, y },
  dir: 'N',
  screw,
});

const bottom = (id: string, label: string, x: number, y: number, screw: 'power' | 'control' = 'control'): TerminalDef => ({
  id,
  label,
  offset: { x, y },
  dir: 'S',
  screw,
});

/** Borne en un costado: el cable sale al oeste o al este. Lo usan los zócalos de 11 pines. */
const side = (id: string, x: number, y: number, dir: 'E' | 'W'): TerminalDef => ({
  id,
  label: id,
  offset: { x, y },
  dir,
  screw: 'control',
});

const NO_INTERNALS = { actuators: [], contacts: [], loads: [], sources: [] } as const;

const PRESET: PropSpec = { key: 'presetMs', kind: 'durationMs', default: 5000, min: MIN_PRESET_MS, max: MAX_PRESET_MS };
const INITIAL_POSITION: PropSpec = { key: 'initialPosition', kind: 'choice', default: 0, options: [1, 0, 2] };

/**
 * Acometida: la bajada del poste. Cada fase es una fuente independiente y todas comparten el
 * neutro [R5 §2].
 */
function supply(type: string, phases: readonly string[]): DeviceDefinition {
  const pitch = 4;
  // El neutro va siempre primero, a la izquierda.
  const ids = ['N', ...phases];
  const width = (ids.length - 1) * pitch;
  const terminals = ids.map((id, i) => bottom(id, id, -width / 2 + i * pitch, 7, 'power'));
  return {
    type,
    category: 'sources',
    refPrefix: 'G',
    bounds: { minX: -width / 2 - 4, minY: -8, maxX: width / 2 + 4, maxY: 8 },
    terminals,
    internals: { ...NO_INTERNALS, sources: [{ id: 'S', phases: [...phases], neutral: 'N' }] },
    props: [REF, LABEL],
  };
}

const SUPPLY_1P = supply('supply-1p', ['L']);
const SUPPLY_2P = supply('supply-2p', ['L1', 'L2']);
const SUPPLY_3P = supply('supply-3p', ['L1', 'L2', 'L3']);

/** Taco de N polos: interruptor manual mantenido, sin disparo [R5 §8]. */
function breaker(type: string, poles: number): DeviceDefinition {
  const pitch = 4;
  const width = (poles - 1) * pitch;
  const terminals: TerminalDef[] = [];
  const contacts = [];
  for (let i = 0; i < poles; i += 1) {
    const x = -width / 2 + i * pitch;
    const a = String(i * 2 + 1);
    const b = String(i * 2 + 2);
    terminals.push(top(a, a, x, -7, 'power'), bottom(b, b, x, 7, 'power'));
    contacts.push({ a, b, normal: 'NO' as const, actuator: 'Q' });
  }
  return {
    type,
    category: 'protection',
    refPrefix: 'Q',
    bounds: { minX: -width / 2 - 3, minY: -8, maxX: width / 2 + 4.5, maxY: 8 },
    terminals,
    internals: {
      ...NO_INTERNALS,
      actuators: [{ id: 'Q', kind: 'manual', action: 'maintained' }],
      contacts,
    },
    props: [REF, LABEL, CLOSED_INITIALLY],
  };
}

const BREAKER_1P = breaker('breaker-1p', 1);
const BREAKER_2P = breaker('breaker-2p', 2);
const BREAKER_3P = breaker('breaker-3p', 3);

/**
 * Contactor tripolar con un contacto auxiliar NA y uno NC [R5 §9].
 * A1 y A2 van arriba, entre los bornes de potencia y un poco más altos.
 */
const CONTACTOR_3P: DeviceDefinition = {
  type: 'contactor-3p',
  category: 'relays',
  refPrefix: 'K',
  bounds: { minX: -10, minY: -11, maxX: 13, maxY: 11 },
  terminals: [
    top('A1', 'A1', -6, -10),
    top('A2', 'A2', -2, -10),
    top('1', '1/L1', -8, -7, 'power'),
    top('3', '3/L2', -4, -7, 'power'),
    top('5', '5/L3', 0, -7, 'power'),
    top('13', '13', 4, -7),
    top('21', '21', 8, -7),
    bottom('2', '2/T1', -8, 10, 'power'),
    bottom('4', '4/T2', -4, 10, 'power'),
    bottom('6', '6/T3', 0, 10, 'power'),
    bottom('14', '14', 4, 10),
    bottom('22', '22', 8, 10),
  ],
  internals: {
    ...NO_INTERNALS,
    actuators: [{ id: 'K', kind: 'coil', terminals: ['A1', 'A2'] }],
    contacts: [
      { a: '1', b: '2', normal: 'NO', actuator: 'K' },
      { a: '3', b: '4', normal: 'NO', actuator: 'K' },
      { a: '5', b: '6', normal: 'NO', actuator: 'K' },
      { a: '13', b: '14', normal: 'NO', actuator: 'K' },
      { a: '21', b: '22', normal: 'NC', actuator: 'K' },
    ],
  },
  props: [REF, LABEL],
};

/** Pulsador NA: un contacto, un borne arriba y otro abajo [R5 §7]. */
const PUSHBUTTON_NO: DeviceDefinition = {
  type: 'pushbutton-no',
  category: 'manual',
  refPrefix: 'S',
  bounds: { minX: -4, minY: -8, maxX: 4, maxY: 8 },
  terminals: [top('13', '13', 0, -7), bottom('14', '14', 0, 7)],
  internals: {
    ...NO_INTERNALS,
    actuators: [{ id: 'S', kind: 'manual', action: 'momentary' }],
    contacts: [{ a: '13', b: '14', normal: 'NO', actuator: 'S' }],
  },
  props: [REF, LABEL],
};

/** Pulsador NC. */
const PUSHBUTTON_NC: DeviceDefinition = {
  type: 'pushbutton-nc',
  category: 'manual',
  refPrefix: 'S',
  bounds: { minX: -4, minY: -8, maxX: 4, maxY: 8 },
  terminals: [top('11', '11', 0, -7), bottom('12', '12', 0, 7)],
  internals: {
    ...NO_INTERNALS,
    actuators: [{ id: 'S', kind: 'manual', action: 'momentary' }],
    contacts: [{ a: '11', b: '12', normal: 'NC', actuator: 'S' }],
  },
  props: [REF, LABEL],
};

/** Piloto: el círculo del símbolo es el que alumbra [R5 §10]. */
const PILOT_LAMP: DeviceDefinition = {
  type: 'pilot-lamp',
  category: 'loads',
  refPrefix: 'H',
  bounds: { minX: -4, minY: -8, maxX: 4, maxY: 8 },
  terminals: [top('X1', 'X1', 0, -7), bottom('X2', 'X2', 0, 7)],
  internals: { ...NO_INTERNALS, loads: [{ a: 'X1', b: 'X2', look: 'pilot' }] },
  props: [REF, LABEL, LAMP_COLOR],
};

/** Foco: silueta de bombillo, con los dos bornes abajo [R5 §10]. */
const BULB: DeviceDefinition = {
  type: 'bulb',
  category: 'loads',
  refPrefix: 'E',
  bounds: { minX: -5, minY: -9, maxX: 5, maxY: 9 },
  terminals: [bottom('X1', 'X1', -2, 8), bottom('X2', 'X2', 2, 8)],
  internals: { ...NO_INTERNALS, loads: [{ a: 'X1', b: 'X2', look: 'bulb' }] },
  props: [REF, LABEL],
};

/** Interruptor mantenido NA, para circuitos de mando. */
const SWITCH_NO: DeviceDefinition = {
  type: 'switch-no',
  category: 'manual',
  refPrefix: 'S',
  bounds: { minX: -4, minY: -8, maxX: 4, maxY: 8 },
  terminals: [top('13', '13', 0, -7), bottom('14', '14', 0, 7)],
  internals: {
    ...NO_INTERNALS,
    actuators: [{ id: 'S', kind: 'manual', action: 'maintained' }],
    contacts: [{ a: '13', b: '14', normal: 'NO', actuator: 'S' }],
  },
  props: [REF, LABEL, OPEN_INITIALLY],
};

/** Parada de emergencia: NC enclavada; un clic la acciona y otro la libera [I2]. */
const EMERGENCY_STOP: DeviceDefinition = {
  type: 'emergency-stop',
  category: 'manual',
  refPrefix: 'S',
  bounds: { minX: -4, minY: -8, maxX: 4, maxY: 8 },
  terminals: [top('11', '11', 0, -7), bottom('12', '12', 0, 7)],
  internals: {
    ...NO_INTERNALS,
    actuators: [{ id: 'S', kind: 'manual', action: 'latching' }],
    contacts: [{ a: '11', b: '12', normal: 'NC', actuator: 'S' }],
  },
  props: [REF, LABEL],
};

/** Selector de 3 posiciones: un común y dos salidas [I3]. */
const SELECTOR_3: DeviceDefinition = {
  type: 'selector-3',
  category: 'manual',
  refPrefix: 'S',
  bounds: { minX: -6, minY: -8, maxX: 6, maxY: 8 },
  terminals: [top('1', '1', 0, -7), bottom('2', '2', -4, 7), bottom('4', '4', 4, 7)],
  internals: {
    ...NO_INTERNALS,
    actuators: [{ id: 'S', kind: 'manual', action: 'selector' }],
    contacts: [
      { a: '1', b: '2', normal: 'NO', actuator: 'S', position: 1 },
      { a: '1', b: '4', normal: 'NO', actuator: 'S', position: 2 },
    ],
  },
  props: [REF, LABEL, INITIAL_POSITION],
};

/**
 * Base enchufable, con la disposición real del zócalo: los **comunes abajo**, sus dos contactos
 * **arriba** y la bobina en los dos extremos de la fila de abajo. Así las dos filas quedan
 * alineadas columna por columna. La numeración es la de un zócalo de 8 u 11 pines; cambia algo
 * según el fabricante.
 */
interface SocketPole {
  /** Columna del común (fila de abajo). */
  readonly common: { readonly id: string; readonly column: number };
  /** Contacto NA (fila de arriba). */
  readonly no: { readonly id: string; readonly column: number };
  /** Contacto NC (fila de arriba). */
  readonly nc: { readonly id: string; readonly column: number };
}

function socketBase(opts: {
  readonly type: string;
  readonly category: 'relays' | 'timers';
  readonly columns: number;
  /** Bobina: columna de cada pin, en la fila de abajo. */
  readonly coil: readonly [{ id: string; column: number }, { id: string; column: number }];
  readonly poles: readonly SocketPole[];
  readonly timer?: TimerType;
  readonly extraProps?: readonly PropSpec[];
}): DeviceDefinition {
  const pitch = 4;
  const width = (opts.columns - 1) * pitch;
  const x = (column: number): number => -width / 2 + column * pitch;

  const terminals: TerminalDef[] = [];
  for (const pin of opts.coil) terminals.push(bottom(pin.id, pin.id, x(pin.column), 8));
  for (const pole of opts.poles) {
    terminals.push(
      bottom(pole.common.id, pole.common.id, x(pole.common.column), 8),
      top(pole.no.id, pole.no.id, x(pole.no.column), -8),
      top(pole.nc.id, pole.nc.id, x(pole.nc.column), -8),
    );
  }
  terminals.sort((a, b) => a.offset.y - b.offset.y || a.offset.x - b.offset.x);

  return {
    type: opts.type,
    category: opts.category,
    refPrefix: opts.timer ? 'T' : 'K',
    bounds: { minX: -width / 2 - 2.5, minY: -9, maxX: width / 2 + (opts.timer ? 7 : 2.5), maxY: 9 },
    terminals,
    internals: {
      ...NO_INTERNALS,
      actuators: [
        opts.timer
          ? { id: 'K', kind: 'timer', timerType: opts.timer, terminals: [opts.coil[0].id, opts.coil[1].id] }
          : { id: 'K', kind: 'coil', terminals: [opts.coil[0].id, opts.coil[1].id] },
      ],
      contacts: opts.poles.flatMap((pole) => [
        { a: pole.common.id, b: pole.no.id, normal: 'NO' as const, actuator: 'K' },
        { a: pole.common.id, b: pole.nc.id, normal: 'NC' as const, actuator: 'K' },
      ]),
    },
    props: [REF, LABEL, ...(opts.extraProps ?? [])],
  };
}

/** Zócalo de 8 pines: arriba 6 · 5 · 4 · 3, abajo 7 · 8 · 1 · 2, con la bobina entre 7 y 2. */
const SOCKET_8 = {
  columns: 4,
  coil: [
    { id: '7', column: 0 },
    { id: '2', column: 3 },
  ],
  poles: [
    { common: { id: '8', column: 1 }, no: { id: '6', column: 0 }, nc: { id: '5', column: 1 } },
    { common: { id: '1', column: 2 }, no: { id: '3', column: 3 }, nc: { id: '4', column: 2 } },
  ],
} as const;

const RELAY_8 = socketBase({ type: 'relay-8', category: 'relays', ...SOCKET_8 });

/**
 * Zócalo de 11 pines (tres contactos conmutados). La posición de los tornillos es la del zócalo
 * real: cuatro arriba (8 7 6 5), cuatro abajo (10 11 1 2), el 9 en el costado izquierdo y el 4 y
 * el 3 en el derecho. La numeración va dando la vuelta al anillo.
 */
const RELAY_11: DeviceDefinition = {
  type: 'relay-11',
  category: 'relays',
  refPrefix: 'K',
  bounds: { minX: -9, minY: -9, maxX: 9, maxY: 9 },
  terminals: [
    top('8', '8', -6, -8),
    top('7', '7', -2, -8),
    top('6', '6', 2, -8),
    top('5', '5', 6, -8),
    side('4', 8, -3, 'E'),
    side('3', 8, 3, 'E'),
    side('9', -8, 3, 'W'),
    bottom('10', '10', -6, 8),
    bottom('11', '11', -2, 8),
    bottom('1', '1', 2, 8),
    bottom('2', '2', 6, 8),
  ],
  internals: {
    ...NO_INTERNALS,
    actuators: [{ id: 'K', kind: 'coil', terminals: ['10', '2'] }],
    contacts: [
      { a: '11', b: '9', normal: 'NO', actuator: 'K' },
      { a: '11', b: '8', normal: 'NC', actuator: 'K' },
      { a: '1', b: '3', normal: 'NO', actuator: 'K' },
      { a: '1', b: '4', normal: 'NC', actuator: 'K' },
      { a: '6', b: '7', normal: 'NO', actuator: 'K' },
      { a: '6', b: '5', normal: 'NC', actuator: 'K' },
    ],
  },
  props: [REF, LABEL],
};

const TIMER_TON = socketBase({
  type: 'timer-ton',
  category: 'timers',
  ...SOCKET_8,
  timer: 'TON',
  extraProps: [PRESET],
});

const TIMER_TOF = socketBase({
  type: 'timer-tof',
  category: 'timers',
  ...SOCKET_8,
  timer: 'TOF',
  extraProps: [PRESET],
});

/**
 * UPS / inversor: la entrada solo enciende su indicador y la salida es una fuente independiente
 * siempre activa [R5 §11].
 */
const UPS: DeviceDefinition = {
  type: 'ups',
  category: 'sources',
  refPrefix: 'G',
  bounds: { minX: -10, minY: -9, maxX: 10, maxY: 9 },
  terminals: [
    top('L1', 'L ent', -6, -8, 'power'),
    top('N1', 'N ent', -2, -8, 'power'),
    bottom('L2', 'L sal', 2, 8, 'power'),
    bottom('N2', 'N sal', 6, 8, 'power'),
  ],
  internals: {
    ...NO_INTERNALS,
    loads: [{ a: 'L1', b: 'N1', look: 'indicator' }],
    sources: [{ id: 'OUT', phases: ['L2'], neutral: 'N2' }],
  },
  props: [REF, LABEL],
};

export const DEVICE_DEFINITIONS: readonly DeviceDefinition[] = [
  SUPPLY_1P,
  SUPPLY_2P,
  SUPPLY_3P,
  UPS,
  BREAKER_1P,
  BREAKER_2P,
  BREAKER_3P,
  CONTACTOR_3P,
  RELAY_8,
  RELAY_11,
  TIMER_TON,
  TIMER_TOF,
  PUSHBUTTON_NO,
  PUSHBUTTON_NC,
  EMERGENCY_STOP,
  SWITCH_NO,
  SELECTOR_3,
  PILOT_LAMP,
  BULB,
];

/** Registro por defecto del catálogo de tablero. */
export const boardRegistry = createDeviceRegistry(DEVICE_DEFINITIONS);
