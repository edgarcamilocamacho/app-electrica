import { expect } from 'vitest';
import { computeNets, terminalPartition } from '../../src/core/connectivity/nets';
import { vertexPosition } from '../../src/core/model/document';
import type { CircuitDocument, Id } from '../../src/core/model/types';
import type { Registry } from '../../src/core/registry/types';
import { defaultRegistry } from '../../src/core/registry/catalog';
import { classifyVertices, type VertexClass } from '../../src/core/topology/classify';
import { computeViolations } from '../../src/core/topology/validity';
import type { EditResult } from '../../src/core/topology/ops';
import { normalFormViolations } from './invariants';

const reg = defaultRegistry;

/** Tramos del documento como "x1,y1-x2,y2" normalizados y ordenados. */
export function spans(doc: CircuitDocument, registry: Registry = reg): string[] {
  return Object.values(doc.segments)
    .map((s) => {
      const a = vertexPosition(doc, doc.vertices[s.a]!, registry);
      const b = vertexPosition(doc, doc.vertices[s.b]!, registry);
      const [p, q] = a.x < b.x || (a.x === b.x && a.y < b.y) ? [a, b] : [b, a];
      return `${p.x},${p.y}-${q.x},${q.y}`;
    })
    .sort();
}

export function vertexAt(doc: CircuitDocument, x: number, y: number, registry: Registry = reg): Id | undefined {
  return Object.values(doc.vertices).find((v) => {
    const p = vertexPosition(doc, v, registry);
    return p.x === x && p.y === y;
  })?.id;
}

export function classAt(doc: CircuitDocument, x: number, y: number): VertexClass | undefined {
  const id = vertexAt(doc, x, y);
  return id ? classifyVertices(doc, reg).get(id) : undefined;
}

export function sameNet(doc: CircuitDocument, a: [Id, string], b: [Id, string]): boolean {
  const nets = computeNets(doc);
  return nets.netOfTerminal(a[0], a[1]) === nets.netOfTerminal(b[0], b[1]);
}

export function netCount(doc: CircuitDocument): number {
  const nets = computeNets(doc);
  return new Set(nets.netOfSegment.values()).size;
}

export const partition = (doc: CircuitDocument) => terminalPartition(doc, reg);

/** Resultado válido, en forma normal y sin ambigüedades. */
export function expectValid(result: EditResult): CircuitDocument {
  expect(result.violations.map((v) => v.key), 'violaciones').toEqual([]);
  expect(result.failedSegments, 'rutas fallidas').toEqual([]);
  expect(result.ok).toBe(true);
  expect(normalFormViolations(result.doc, reg), 'forma normal').toEqual([]);
  return result.doc;
}

export function expectNoAmbiguity(doc: CircuitDocument): void {
  expect(computeViolations(doc, reg).map((v) => v.key)).toEqual([]);
}
