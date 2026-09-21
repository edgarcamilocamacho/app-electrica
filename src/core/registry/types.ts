import type { Dir, Point } from '../model/types';
import type { Rect } from '../model/geometry';

export type ComponentCategory = 'sources' | 'manual' | 'relays' | 'contacts' | 'timers' | 'loads';

export interface TerminalDef {
  readonly id: string;
  /** Desplazamiento respecto de la posición del componente, sin rotar. */
  readonly offset: Point;
  /** Dirección de salida preferida del cable, sin rotar. */
  readonly dir: Dir;
}

export type ContactNormal = 'NO' | 'NC';
export type TimerType = 'TON' | 'TOF';

export type DeviceBehavior =
  | { readonly kind: 'source' }
  | { readonly kind: 'switch'; readonly normal: ContactNormal; readonly action: 'maintained' | 'momentary' | 'latching' }
  | { readonly kind: 'selector' }
  | { readonly kind: 'coil' }
  | { readonly kind: 'timer'; readonly timerType: TimerType }
  | { readonly kind: 'contact'; readonly normal: ContactNormal; readonly linkTo: 'coil' | 'timer' }
  | { readonly kind: 'load' };

/** Descriptor de una propiedad editable; el panel de propiedades se genera a partir de estos. */
export type PropSpec =
  | { readonly key: string; readonly kind: 'text'; readonly default: string }
  | { readonly key: string; readonly kind: 'ref'; readonly default: string }
  | { readonly key: string; readonly kind: 'link'; readonly default: string }
  | { readonly key: string; readonly kind: 'boolean'; readonly default: boolean }
  | { readonly key: string; readonly kind: 'durationMs'; readonly default: number; readonly min: number; readonly max: number }
  | { readonly key: string; readonly kind: 'choice'; readonly default: string | number; readonly options: readonly (string | number)[] };

export interface ComponentDefinition {
  readonly type: string;
  readonly category: ComponentCategory;
  /** Prefijo de referencia por defecto (K, S, H…). Vacío para contactos: su ref deriva del vínculo. */
  readonly refPrefix: string;
  readonly terminals: readonly TerminalDef[];
  /** Caja del símbolo relativa a la posición, sin rotar. Para selección y exportación. */
  readonly bounds: Rect;
  readonly behavior: DeviceBehavior;
  readonly props: readonly PropSpec[];
}

export interface Registry {
  get(type: string): ComponentDefinition | undefined;
  require(type: string): ComponentDefinition;
  all(): readonly ComponentDefinition[];
}
