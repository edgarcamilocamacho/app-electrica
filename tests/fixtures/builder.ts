import { createEmptyDocument, type OpContext } from '../../src/core/model/document';
import { createCounterIdGen } from '../../src/core/model/ids';
import type { CircuitDocument, ComponentInstance, Id, Point, Rotation, WireVertex } from '../../src/core/model/types';
import { defaultProps, defaultRegistry } from '../../src/core/registry/catalog';

export function makeCtx(): OpContext {
  return { ids: createCounterIdGen(), registry: defaultRegistry };
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Construye documentos a mano para tests, con ids deterministas. */
export class DocBuilder {
  private readonly doc: Mutable<CircuitDocument>;
  private readonly components: Record<Id, ComponentInstance> = {};
  private readonly vertices: Record<Id, WireVertex> = {};
  private readonly segments: Record<Id, { id: Id; a: Id; b: Id }> = {};

  constructor(readonly ctx: OpContext = makeCtx()) {
    this.doc = { ...createEmptyDocument('test') };
  }

  component(type: string, x: number, y: number, rotation: Rotation = 0, props: Record<string, unknown> = {}): Id {
    const id = this.ctx.ids.next('c');
    const def = this.ctx.registry.require(type);
    this.components[id] = { id, type, position: { x, y }, rotation, props: { ...defaultProps(def), ...props } };
    return id;
  }

  point(x: number, y: number): Id {
    const id = this.ctx.ids.next('v');
    this.vertices[id] = { id, kind: 'point', position: { x, y } };
    return id;
  }

  terminal(componentId: Id, terminalId: string): Id {
    const existing = Object.values(this.vertices).find(
      (v) => v.kind === 'terminal' && v.componentId === componentId && v.terminalId === terminalId,
    );
    if (existing) return existing.id;
    const id = this.ctx.ids.next('v');
    this.vertices[id] = { id, kind: 'terminal', componentId, terminalId };
    return id;
  }

  seg(a: Id, b: Id): Id {
    const id = this.ctx.ids.next('s');
    this.segments[id] = { id, a, b };
    return id;
  }

  /** Cadena de segmentos por puntos o ids de vértice existentes. Devuelve los vértices usados. */
  wire(...stops: (Point | Id)[]): Id[] {
    const ids = stops.map((s) => (typeof s === 'string' ? s : this.point(s.x, s.y)));
    for (let i = 1; i < ids.length; i++) this.seg(ids[i - 1]!, ids[i]!);
    return ids;
  }

  build(): CircuitDocument {
    return {
      ...this.doc,
      components: { ...this.components },
      vertices: { ...this.vertices },
      segments: { ...this.segments },
    };
  }
}

/** PRNG determinista (mulberry32) para pruebas de propiedades. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (r: () => number, min: number, max: number): number =>
  min + Math.floor(r() * (max - min + 1));
