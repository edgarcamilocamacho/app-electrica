import type { ComponentDefinition, PropSpec, Registry, TerminalDef } from './types';

/**
 * Catálogo V1 (PLAN §11). Todos los símbolos de dos terminales son verticales en rotación 0:
 * un terminal arriba (0,−3) y otro abajo (0,3), como en un diagrama de escalera.
 */

const TWO_TERMINALS = (top: string, bottom: string): TerminalDef[] => [
  { id: top, offset: { x: 0, y: -3 }, dir: 'N' },
  { id: bottom, offset: { x: 0, y: 3 }, dir: 'S' },
];

const STANDARD_BOUNDS = { minX: -2, minY: -3, maxX: 2, maxY: 3 };

const REF: PropSpec = { key: 'ref', kind: 'ref', default: '' };
const LABEL: PropSpec = { key: 'label', kind: 'text', default: '' };
const LINK: PropSpec = { key: 'link', kind: 'link', default: '' };
const INITIALLY_ACTUATED: PropSpec = { key: 'initiallyActuated', kind: 'boolean', default: false };
const PRESET: PropSpec = { key: 'presetMs', kind: 'durationMs', default: 5000, min: 100, max: 3_600_000 };

export const MIN_PRESET_MS = 100;
export const MAX_PRESET_MS = 3_600_000;

export const COMPONENT_DEFINITIONS: readonly ComponentDefinition[] = [
  {
    type: 'ac-source',
    category: 'sources',
    refPrefix: 'G',
    terminals: TWO_TERMINALS('L', 'N'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'source' },
    props: [REF, LABEL],
  },
  {
    type: 'switch-no',
    category: 'manual',
    refPrefix: 'S',
    terminals: TWO_TERMINALS('13', '14'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'switch', normal: 'NO', action: 'maintained' },
    props: [REF, LABEL, INITIALLY_ACTUATED],
  },
  {
    type: 'switch-nc',
    category: 'manual',
    refPrefix: 'S',
    terminals: TWO_TERMINALS('11', '12'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'switch', normal: 'NC', action: 'maintained' },
    props: [REF, LABEL, INITIALLY_ACTUATED],
  },
  {
    type: 'pushbutton-no',
    category: 'manual',
    refPrefix: 'S',
    terminals: TWO_TERMINALS('13', '14'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'switch', normal: 'NO', action: 'momentary' },
    props: [REF, LABEL],
  },
  {
    type: 'pushbutton-nc',
    category: 'manual',
    refPrefix: 'S',
    terminals: TWO_TERMINALS('11', '12'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'switch', normal: 'NC', action: 'momentary' },
    props: [REF, LABEL],
  },
  {
    type: 'emergency-stop',
    category: 'manual',
    refPrefix: 'S',
    terminals: TWO_TERMINALS('11', '12'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'switch', normal: 'NC', action: 'latching' },
    props: [REF, LABEL],
  },
  {
    type: 'selector-3',
    category: 'manual',
    refPrefix: 'S',
    terminals: [
      { id: 'C', offset: { x: 0, y: -3 }, dir: 'N' },
      { id: '1', offset: { x: -2, y: 3 }, dir: 'S' },
      { id: '2', offset: { x: 2, y: 3 }, dir: 'S' },
    ],
    bounds: { minX: -3, minY: -3, maxX: 3, maxY: 3 },
    behavior: { kind: 'selector' },
    props: [REF, LABEL, { key: 'initialPosition', kind: 'choice', default: 0, options: [1, 0, 2] }],
  },
  {
    type: 'coil',
    category: 'relays',
    refPrefix: 'K',
    terminals: TWO_TERMINALS('A1', 'A2'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'coil' },
    props: [REF, LABEL],
  },
  {
    type: 'contact-no',
    category: 'contacts',
    refPrefix: '',
    terminals: TWO_TERMINALS('13', '14'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'contact', normal: 'NO', linkTo: 'coil' },
    props: [LINK, REF, LABEL],
  },
  {
    type: 'contact-nc',
    category: 'contacts',
    refPrefix: '',
    terminals: TWO_TERMINALS('11', '12'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'contact', normal: 'NC', linkTo: 'coil' },
    props: [LINK, REF, LABEL],
  },
  {
    type: 'timer-ton',
    category: 'timers',
    refPrefix: 'T',
    terminals: TWO_TERMINALS('A1', 'A2'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'timer', timerType: 'TON' },
    props: [REF, LABEL, PRESET],
  },
  {
    type: 'timer-tof',
    category: 'timers',
    refPrefix: 'T',
    terminals: TWO_TERMINALS('A1', 'A2'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'timer', timerType: 'TOF' },
    props: [REF, LABEL, PRESET],
  },
  {
    type: 'timed-contact-no',
    category: 'timers',
    refPrefix: '',
    terminals: TWO_TERMINALS('17', '18'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'contact', normal: 'NO', linkTo: 'timer' },
    props: [LINK, REF, LABEL],
  },
  {
    type: 'timed-contact-nc',
    category: 'timers',
    refPrefix: '',
    terminals: TWO_TERMINALS('15', '16'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'contact', normal: 'NC', linkTo: 'timer' },
    props: [LINK, REF, LABEL],
  },
  {
    type: 'lamp',
    category: 'loads',
    refPrefix: 'H',
    terminals: TWO_TERMINALS('X1', 'X2'),
    bounds: STANDARD_BOUNDS,
    behavior: { kind: 'load' },
    props: [REF, LABEL, { key: 'color', kind: 'choice', default: 'red', options: ['red', 'green', 'amber', 'white', 'blue'] }],
  },
];

export function createRegistry(definitions: readonly ComponentDefinition[] = COMPONENT_DEFINITIONS): Registry {
  const byType = new Map(definitions.map((d) => [d.type, d]));
  return {
    get: (type) => byType.get(type),
    require(type) {
      const def = byType.get(type);
      if (!def) throw new Error(`Tipo de componente desconocido: ${type}`);
      return def;
    },
    all: () => definitions,
  };
}

/** Registro por defecto con el catálogo V1. */
export const defaultRegistry: Registry = createRegistry();

/** Propiedades iniciales de un tipo, según su descriptor. */
export function defaultProps(def: ComponentDefinition): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const spec of def.props) props[spec.key] = spec.default;
  return props;
}
