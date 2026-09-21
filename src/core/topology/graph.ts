import { terminalPosition } from '../model/document';
import { compareIds } from '../model/ids';
import type {
  CircuitDocument,
  ComponentInstance,
  Id,
  Point,
  TextAnnotation,
  WireSegment,
  WireVertex,
} from '../model/types';
import type { Registry } from '../registry/types';

/**
 * Copia de trabajo mutable de un documento, con adyacencia mantenida. Las operaciones del núcleo
 * la usan internamente y devuelven un documento nuevo: los objetos no tocados se comparten con el
 * original (structural sharing), así los snapshots del historial cuestan poco.
 */
export class WorkGraph {
  readonly components: Record<Id, ComponentInstance>;
  readonly vertices: Record<Id, WireVertex>;
  readonly segments: Record<Id, WireSegment>;
  readonly annotations: Record<Id, TextAnnotation>;
  private readonly adj = new Map<Id, Set<Id>>();

  constructor(
    private readonly base: CircuitDocument,
    readonly registry: Registry,
  ) {
    this.components = { ...base.components };
    this.vertices = { ...base.vertices };
    this.segments = { ...base.segments };
    this.annotations = { ...base.annotations };
    for (const id of Object.keys(this.vertices)) this.adj.set(id, new Set());
    for (const seg of Object.values(this.segments)) {
      this.adj.get(seg.a)?.add(seg.id);
      this.adj.get(seg.b)?.add(seg.id);
    }
  }

  /** Vista de documento del estado actual (para consultas que esperan un CircuitDocument). */
  asDocument(): CircuitDocument {
    return {
      ...this.base,
      components: this.components,
      vertices: this.vertices,
      segments: this.segments,
      annotations: this.annotations,
    };
  }

  /** Documento final: copias congeladas de los registros de trabajo. */
  toDocument(): CircuitDocument {
    return {
      ...this.base,
      components: { ...this.components },
      vertices: { ...this.vertices },
      segments: { ...this.segments },
      annotations: { ...this.annotations },
    };
  }

  pos(vertexId: Id): Point {
    const v = this.vertices[vertexId];
    if (!v) throw new Error(`Vértice inexistente: ${vertexId}`);
    return this.vertexPos(v);
  }

  vertexPos(v: WireVertex): Point {
    if (v.kind === 'point') return v.position;
    const component = this.components[v.componentId];
    if (!component) throw new Error(`Vértice ${v.id} ligado a un componente inexistente`);
    return terminalPosition(component, v.terminalId, this.registry);
  }

  degree(vertexId: Id): number {
    return this.adj.get(vertexId)?.size ?? 0;
  }

  /** Segmentos incidentes, en orden determinista. */
  segmentsAt(vertexId: Id): Id[] {
    return [...(this.adj.get(vertexId) ?? [])].sort(compareIds);
  }

  addVertex(v: WireVertex): void {
    this.vertices[v.id] = v;
    if (!this.adj.has(v.id)) this.adj.set(v.id, new Set());
  }

  setVertex(v: WireVertex): void {
    this.vertices[v.id] = v;
  }

  removeVertex(vertexId: Id): void {
    if (this.degree(vertexId) > 0) throw new Error(`No se puede borrar el vértice ${vertexId}: tiene segmentos`);
    delete this.vertices[vertexId];
    this.adj.delete(vertexId);
  }

  addSegment(seg: WireSegment): void {
    this.segments[seg.id] = seg;
    this.adj.get(seg.a)?.add(seg.id);
    this.adj.get(seg.b)?.add(seg.id);
  }

  removeSegment(segmentId: Id): void {
    const seg = this.segments[segmentId];
    if (!seg) return;
    delete this.segments[segmentId];
    this.adj.get(seg.a)?.delete(segmentId);
    this.adj.get(seg.b)?.delete(segmentId);
  }

  /** Redirige todos los segmentos de `drop` hacia `keep` y elimina `drop`. */
  replaceVertex(drop: Id, keep: Id): void {
    if (drop === keep) return;
    for (const segId of this.segmentsAt(drop)) {
      const seg = this.segments[segId]!;
      this.removeSegment(segId);
      this.addSegment({ id: seg.id, a: seg.a === drop ? keep : seg.a, b: seg.b === drop ? keep : seg.b });
    }
    this.removeVertex(drop);
  }

  /** Vértice terminal que materializa un terminal de componente, si existe. */
  terminalVertex(componentId: Id, terminalId: string): Id | undefined {
    for (const v of Object.values(this.vertices)) {
      if (v.kind === 'terminal' && v.componentId === componentId && v.terminalId === terminalId) return v.id;
    }
    return undefined;
  }
}
