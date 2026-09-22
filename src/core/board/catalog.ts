/**
 * Catálogo de aparatos [R5 §7–§13].
 *
 * Geometría en unidades de grid (10 px al 100 %). Convenciones:
 * - El cuerpo es simétrico respecto de la posición del aparato.
 * - Los tornillos quedan a una unidad del borde del cuerpo; el paso entre tornillos es 4.
 * - Fila de arriba: los cables salen al norte; fila de abajo, al sur.
 */
import type { DeviceDefinition, PropSpec, TerminalDef } from './registry';
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

/** Acometida monofásica: baja del poste con fase y neutro [R5 §2]. */
const SUPPLY_1P: DeviceDefinition = {
  type: 'supply-1p',
  category: 'sources',
  refPrefix: 'G',
  bounds: { minX: -6, minY: -8, maxX: 6, maxY: 8 },
  terminals: [bottom('L', 'L', -2, 7, 'power'), bottom('N', 'N', 2, 7, 'power')],
  internals: { ...NO_INTERNALS, sources: [{ id: 'S', phases: ['L'], neutral: 'N' }] },
  props: [REF, LABEL],
};

/** Taco de un polo: interruptor manual mantenido, sin disparo [R5 §8]. */
const BREAKER_1P: DeviceDefinition = {
  type: 'breaker-1p',
  category: 'protection',
  refPrefix: 'Q',
  bounds: { minX: -3, minY: -8, maxX: 3, maxY: 8 },
  terminals: [top('1', '1', 0, -7, 'power'), bottom('2', '2', 0, 7, 'power')],
  internals: {
    ...NO_INTERNALS,
    actuators: [{ id: 'Q', kind: 'manual', action: 'maintained' }],
    contacts: [{ a: '1', b: '2', normal: 'NO', actuator: 'Q' }],
  },
  props: [REF, LABEL, CLOSED_INITIALLY],
};

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

export const DEVICE_DEFINITIONS: readonly DeviceDefinition[] = [
  SUPPLY_1P,
  BREAKER_1P,
  CONTACTOR_3P,
  PUSHBUTTON_NO,
  PUSHBUTTON_NC,
  SWITCH_NO,
  PILOT_LAMP,
  BULB,
];

/** Registro por defecto del catálogo de tablero. */
export const boardRegistry = createDeviceRegistry(DEVICE_DEFINITIONS);
