import type { CircuitDocument, Point } from '../model/types';
import type { Registry } from '../registry/types';
import { WorkGraph } from './graph';
import { GeometryIndex } from './spatialIndex';

/**
 * ¿Hay algo a lo que un cable se engancharía en `p`? (vértice, terminal, o interior de un
 * segmento). Lo usa la herramienta Cable para decidir si un clic termina el trazado.
 */
export function hasConnectionTargetAt(doc: CircuitDocument, p: Point, registry: Registry): boolean {
  const index = GeometryIndex.forGraph(new WorkGraph(doc, registry));
  return index.at(p).length > 0 || index.segmentsThrough(p).length > 0;
}
