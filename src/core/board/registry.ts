/**
 * Catálogo declarativo de aparatos (PLAN §22.3).
 *
 * Cada tipo declara sus bornes y sus **elementos internos**: actuadores (bobina, temporizador o
 * accionamiento manual), contactos, cargas y fuentes. El motor eléctrico trabaja sobre esos
 * elementos, no sobre el tipo, y un contacto lo mueve un actuador **del mismo aparato**: no hay
 * vínculos por referencia [R5 §1].
 */
import type { Dir, Point } from '../model/types';
import type { Rect } from '../model/geometry';

export type DeviceCategory = 'sources' | 'protection' | 'manual' | 'relays' | 'timers' | 'loads';

/** Tamaño del tornillo: los de potencia se dibujan más grandes [R5 §9]. */
export type ScrewSize = 'power' | 'control';

export type ContactNormal = 'NO' | 'NC';
export type TimerType = 'TON' | 'TOF';
export type ManualAction = 'momentary' | 'maintained' | 'latching' | 'selector';
export type LoadLook = 'pilot' | 'bulb' | 'indicator';

export interface TerminalDef {
  readonly id: string;
  /** Marcación impresa junto al tornillo (`1/L1`, `A1`, `95`). */
  readonly label: string;
  /** Desplazamiento respecto de la posición del aparato. Los aparatos no rotan. */
  readonly offset: Point;
  /** Dirección de salida del cable. */
  readonly dir: Dir;
  readonly screw: ScrewSize;
}

export type ActuatorDef =
  | { readonly id: string; readonly kind: 'coil'; readonly terminals: readonly [string, string] }
  | {
      readonly id: string;
      readonly kind: 'timer';
      readonly timerType: TimerType;
      readonly terminals: readonly [string, string];
    }
  | { readonly id: string; readonly kind: 'manual'; readonly action: ManualAction };

export interface ContactDef {
  readonly a: string;
  readonly b: string;
  readonly normal: ContactNormal;
  /** Id del actuador del mismo aparato que lo mueve. */
  readonly actuator: string;
  /** Solo en selectores: posición que cierra este contacto. */
  readonly position?: number;
}

export interface LoadDef {
  readonly a: string;
  readonly b: string;
  readonly look: LoadLook;
}

export interface SourceDef {
  readonly id: string;
  /** Una fase por borne; cada una es una identidad `(sourceId, phaseIndex)` [R2 §11, R5 §2]. */
  readonly phases: readonly string[];
  /** Neutro común a todas las fases de esta fuente. */
  readonly neutral: string;
}

export interface DeviceInternals {
  readonly actuators: readonly ActuatorDef[];
  readonly contacts: readonly ContactDef[];
  readonly loads: readonly LoadDef[];
  readonly sources: readonly SourceDef[];
}

/** Descriptor de una propiedad editable; el panel de propiedades se genera a partir de estos. */
export type PropSpec =
  | { readonly key: string; readonly kind: 'text'; readonly default: string }
  | { readonly key: string; readonly kind: 'ref'; readonly default: string }
  | { readonly key: string; readonly kind: 'boolean'; readonly default: boolean }
  | { readonly key: string; readonly kind: 'durationMs'; readonly default: number; readonly min: number; readonly max: number }
  | {
      readonly key: string;
      readonly kind: 'choice';
      readonly default: string | number;
      readonly options: readonly (string | number)[];
    };

export interface DeviceDefinition {
  readonly type: string;
  readonly category: DeviceCategory;
  /** Prefijo de etiqueta por defecto (Q, K, S, H, G, T). */
  readonly refPrefix: string;
  /** Cuerpo del aparato relativo a su posición. */
  readonly bounds: Rect;
  readonly terminals: readonly TerminalDef[];
  readonly internals: DeviceInternals;
  readonly props: readonly PropSpec[];
}

export interface DeviceRegistry {
  get(type: string): DeviceDefinition | undefined;
  require(type: string): DeviceDefinition;
  all(): readonly DeviceDefinition[];
}

export function createDeviceRegistry(definitions: readonly DeviceDefinition[]): DeviceRegistry {
  const byType = new Map(definitions.map((d) => [d.type, d]));
  return {
    get: (type) => byType.get(type),
    require(type) {
      const def = byType.get(type);
      if (!def) throw new Error(`Tipo de aparato desconocido: ${type}`);
      return def;
    },
    all: () => definitions,
  };
}

/** Propiedades iniciales de un tipo, según su descriptor. */
export function defaultDeviceProps(def: DeviceDefinition): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const spec of def.props) props[spec.key] = spec.default;
  return props;
}

export function findTerminal(def: DeviceDefinition, id: string): TerminalDef | undefined {
  return def.terminals.find((t) => t.id === id);
}

/** Actuadores que necesitan un clic del usuario durante la simulación. */
export function manualActuators(def: DeviceDefinition): readonly ActuatorDef[] {
  return def.internals.actuators.filter((a) => a.kind === 'manual');
}
