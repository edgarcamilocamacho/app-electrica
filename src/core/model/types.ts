/**
 * Modelo de documento (PLAN §4.1). Serializable, plano, sin estado de runtime.
 * Coordenadas en unidades de grid enteras; y crece hacia abajo.
 */

export type Id = string;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type Rotation = 0 | 90 | 180 | 270;

/** Dirección cardinal (N = arriba, y negativa). */
export type Dir = 'N' | 'E' | 'S' | 'W';

export interface ComponentInstance {
  readonly id: Id;
  readonly type: string;
  readonly position: Point;
  readonly rotation: Rotation;
  readonly props: Readonly<Record<string, unknown>>;
}

/** Vértice con posición propia: esquina, junction o extremo libre. */
export interface PointVertex {
  readonly id: Id;
  readonly kind: 'point';
  readonly position: Point;
}

/** Vértice ligado a un terminal de componente: su posición se deriva del componente. */
export interface TerminalVertex {
  readonly id: Id;
  readonly kind: 'terminal';
  readonly componentId: Id;
  readonly terminalId: string;
}

export type WireVertex = PointVertex | TerminalVertex;

/** Tramo recto horizontal o vertical entre dos vértices: la unidad primitiva del cableado. */
export interface WireSegment {
  readonly id: Id;
  readonly a: Id;
  readonly b: Id;
}

export interface TextAnnotation {
  readonly id: Id;
  readonly position: Point;
  readonly text: string;
}

export interface DocumentMetadata {
  readonly name: string;
  readonly createdAt: string;
  readonly modifiedAt: string;
}

export interface ViewState {
  readonly pan: Point;
  readonly zoom: number;
}

export const SCHEMA_VERSION = 1 as const;

export interface CircuitDocument {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly metadata: DocumentMetadata;
  readonly components: Readonly<Record<Id, ComponentInstance>>;
  readonly vertices: Readonly<Record<Id, WireVertex>>;
  readonly segments: Readonly<Record<Id, WireSegment>>;
  readonly annotations: Readonly<Record<Id, TextAnnotation>>;
  readonly view?: ViewState;
}
