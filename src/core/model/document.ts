import { add, rotateDir, rotateOffset, rotateRect, type Rect } from './geometry';
import type { IdGen } from './ids';
import type { CircuitDocument, ComponentInstance, Dir, Id, Point, WireVertex } from './types';
import { SCHEMA_VERSION } from './types';
import type { Registry } from '../registry/types';

/** Contexto que reciben todas las operaciones puras del núcleo. */
export interface OpContext {
  readonly ids: IdGen;
  readonly registry: Registry;
}

export function createEmptyDocument(name = '', now = '1970-01-01T00:00:00.000Z'): CircuitDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: { name, createdAt: now, modifiedAt: now },
    components: {},
    vertices: {},
    segments: {},
    annotations: {},
  };
}

export function terminalKey(componentId: Id, terminalId: string): string {
  return `${componentId}:${terminalId}`;
}

/** Posición absoluta de un terminal de un componente. */
export function terminalPosition(
  component: ComponentInstance,
  terminalId: string,
  registry: Registry,
): Point {
  const def = registry.require(component.type);
  const terminal = def.terminals.find((t) => t.id === terminalId);
  if (!terminal) throw new Error(`El tipo ${component.type} no tiene el terminal ${terminalId}`);
  return add(component.position, rotateOffset(terminal.offset, component.rotation));
}

/** Dirección de salida de un terminal, ya rotada. */
export function terminalDirection(
  component: ComponentInstance,
  terminalId: string,
  registry: Registry,
): Dir {
  const def = registry.require(component.type);
  const terminal = def.terminals.find((t) => t.id === terminalId);
  if (!terminal) throw new Error(`El tipo ${component.type} no tiene el terminal ${terminalId}`);
  return rotateDir(terminal.dir, component.rotation);
}

export interface TerminalInfo {
  readonly componentId: Id;
  readonly terminalId: string;
  readonly position: Point;
  readonly dir: Dir;
}

/** Todos los terminales de un componente, con posición y dirección absolutas. */
export function componentTerminals(component: ComponentInstance, registry: Registry): TerminalInfo[] {
  const def = registry.require(component.type);
  return def.terminals.map((t) => ({
    componentId: component.id,
    terminalId: t.id,
    position: add(component.position, rotateOffset(t.offset, component.rotation)),
    dir: rotateDir(t.dir, component.rotation),
  }));
}

/** Caja absoluta del símbolo de un componente. */
export function componentBounds(component: ComponentInstance, registry: Registry): Rect {
  const r = rotateRect(registry.require(component.type).bounds, component.rotation);
  return {
    minX: r.minX + component.position.x,
    minY: r.minY + component.position.y,
    maxX: r.maxX + component.position.x,
    maxY: r.maxY + component.position.y,
  };
}

export function vertexPosition(doc: CircuitDocument, vertex: WireVertex, registry: Registry): Point {
  if (vertex.kind === 'point') return vertex.position;
  const component = doc.components[vertex.componentId];
  if (!component) throw new Error(`Vértice ${vertex.id} ligado a un componente inexistente`);
  return terminalPosition(component, vertex.terminalId, registry);
}

export function vertexPositionById(doc: CircuitDocument, vertexId: Id, registry: Registry): Point {
  const vertex = doc.vertices[vertexId];
  if (!vertex) throw new Error(`Vértice inexistente: ${vertexId}`);
  return vertexPosition(doc, vertex, registry);
}

/** Mapa vértice → segmentos incidentes. */
export function buildAdjacency(doc: CircuitDocument): Map<Id, Id[]> {
  const adj = new Map<Id, Id[]>();
  for (const id of Object.keys(doc.vertices)) adj.set(id, []);
  for (const seg of Object.values(doc.segments)) {
    adj.get(seg.a)?.push(seg.id);
    if (seg.b !== seg.a) adj.get(seg.b)?.push(seg.id);
  }
  return adj;
}

/** Índice terminal → vértice que lo materializa (si existe). */
export function terminalVertexIndex(doc: CircuitDocument): Map<string, Id> {
  const index = new Map<string, Id>();
  for (const v of Object.values(doc.vertices)) {
    if (v.kind === 'terminal') index.set(terminalKey(v.componentId, v.terminalId), v.id);
  }
  return index;
}

export function otherEnd(segment: { a: Id; b: Id }, vertexId: Id): Id {
  return segment.a === vertexId ? segment.b : segment.a;
}
