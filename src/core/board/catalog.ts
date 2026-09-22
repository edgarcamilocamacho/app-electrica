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

const NO_INTERNALS = { actuators: [], contacts: [], loads: [], sources: [] } as const;

const PRESET: PropSpec = { key: 'presetMs', kind: 'durationMs', default: 5000, min: MIN_PRESET_MS, max: MAX_PRESET_MS };
const INITIAL_POSITION: PropSpec = { key: 'initialPosition', kind: 'choice', default: 0, options: [1, 0, 2] };

/**
 * Acometida: la bajada del poste. Cada fase es una fuente independiente y todas comparten el
 * neutro [R5 §2].
 */
function supply(type: string, phases: readonly string[]): DeviceDefinition {
  const pitch = 4;
  const ids = [...phases, 'N'];
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
  bounds: { minX: -10, minY: -11, maxX: 10, maxY: 11 },
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

/** Foco: carga con forma de bombillo [R5 §10]. */
const BULB: DeviceDefinition = {
  type: 'bulb',
  category: 'loads',
  refPrefix: 'E',
  bounds: { minX: -4, minY: -8, maxX: 4, maxY: 8 },
  terminals: [top('X1', 'X1', 0, -7), bottom('X2', 'X2', 0, 7)],
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

interface PoleSpec {
  readonly common: string;
  readonly no: string;
  readonly nc: string;
  readonly row: 'top' | 'bottom';
  /** Banda de tres columnas donde va el polo; cada banda tiene una fila arriba y otra abajo. */
  readonly band: number;
}

/**
 * Base enchufable: la bobina (o el temporizador) en la primera columna y los contactos conmutados
 * en bandas de tres columnas (NA · común · NC). La numeración es de ejemplo: cambia según el
 * fabricante.
 */
function relayBase(opts: {
  readonly type: string;
  readonly category: 'relays' | 'timers';
  readonly coil: readonly [string, string];
  readonly poles: readonly PoleSpec[];
  readonly timer?: TimerType;
  readonly extraProps?: readonly PropSpec[];
}): DeviceDefinition {
  const pitch = 4;
  const bands = Math.max(...opts.poles.map((p) => p.band)) + 1;
  const columns = 1 + bands * 3;
  const width = (columns - 1) * pitch;
  const x = (index: number): number => -width / 2 + index * pitch;

  const terminals: TerminalDef[] = [
    top(opts.coil[0], opts.coil[0], x(0), -7),
    bottom(opts.coil[1], opts.coil[1], x(0), 7),
  ];
  for (const pole of opts.poles) {
    const base = 1 + pole.band * 3;
    const place = pole.row === 'top' ? top : bottom;
    const y = pole.row === 'top' ? -7 : 7;
    terminals.push(
      place(pole.no, pole.no, x(base), y),
      place(pole.common, pole.common, x(base + 1), y),
      place(pole.nc, pole.nc, x(base + 2), y),
    );
  }

  return {
    type: opts.type,
    category: opts.category,
    refPrefix: opts.timer ? 'T' : 'K',
    bounds: { minX: -width / 2 - 2, minY: -8, maxX: width / 2 + 2, maxY: 8 },
    terminals,
    internals: {
      ...NO_INTERNALS,
      actuators: [
        opts.timer
          ? { id: 'K', kind: 'timer', timerType: opts.timer, terminals: opts.coil }
          : { id: 'K', kind: 'coil', terminals: opts.coil },
      ],
      contacts: opts.poles.flatMap((pole) => [
        { a: pole.common, b: pole.no, normal: 'NO' as const, actuator: 'K' },
        { a: pole.common, b: pole.nc, normal: 'NC' as const, actuator: 'K' },
      ]),
    },
    props: [REF, LABEL, ...(opts.extraProps ?? [])],
  };
}

const RELAY_8_POLES: readonly PoleSpec[] = [
  { common: '8', no: '6', nc: '5', row: 'top', band: 0 },
  { common: '1', no: '3', nc: '4', row: 'bottom', band: 0 },
];

/** Relé enchufable de 8 pines: bobina 7-2 y dos contactos conmutados. */
const RELAY_8 = relayBase({ type: 'relay-8', category: 'relays', coil: ['7', '2'], poles: RELAY_8_POLES });

/** Relé enchufable de 11 pines: bobina 2-10 y tres contactos conmutados. */
const RELAY_11 = relayBase({
  type: 'relay-11',
  category: 'relays',
  coil: ['2', '10'],
  poles: [
    { common: '11', no: '9', nc: '8', row: 'top', band: 0 },
    { common: '1', no: '3', nc: '4', row: 'bottom', band: 0 },
    { common: '6', no: '7', nc: '5', row: 'top', band: 1 },
  ],
});

/** Temporizadores: dos aparatos independientes [R5 §13]. */
const TIMER_TON = relayBase({
  type: 'timer-ton',
  category: 'timers',
  coil: ['7', '2'],
  poles: RELAY_8_POLES,
  timer: 'TON',
  extraProps: [PRESET],
});

const TIMER_TOF = relayBase({
  type: 'timer-tof',
  category: 'timers',
  coil: ['7', '2'],
  poles: RELAY_8_POLES,
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
