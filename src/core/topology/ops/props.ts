import type { OpContext } from '../../model/document';
import type { CircuitDocument, Id, Point } from '../../model/types';
import type { PropSpec } from '../../registry/types';

/**
 * Cambios que no tocan la topología: propiedades de componentes y texto de anotaciones.
 * Los valores se sanean contra el descriptor de cada propiedad.
 */

export function sanitizeProp(spec: PropSpec, value: unknown): unknown {
  switch (spec.kind) {
    case 'text':
    case 'ref':
    case 'link':
      return typeof value === 'string' ? value.trim().slice(0, 64) : spec.default;
    case 'boolean':
      return typeof value === 'boolean' ? value : spec.default;
    case 'durationMs': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return spec.default;
      return Math.min(spec.max, Math.max(spec.min, Math.round(n)));
    }
    case 'choice':
      return spec.options.includes(value as string | number) ? value : spec.default;
  }
}

export function updateComponentProps(
  doc: CircuitDocument,
  componentId: Id,
  patch: Readonly<Record<string, unknown>>,
  ctx: OpContext,
): CircuitDocument {
  const component = doc.components[componentId];
  if (!component) return doc;
  const def = ctx.registry.require(component.type);
  const props: Record<string, unknown> = { ...component.props };
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    const spec = def.props.find((p) => p.key === key);
    if (!spec) continue;
    const clean = sanitizeProp(spec, value);
    if (!Object.is(props[key], clean)) {
      props[key] = clean;
      changed = true;
    }
  }
  if (!changed) return doc;
  return { ...doc, components: { ...doc.components, [componentId]: { ...component, props } } };
}

export function addAnnotation(doc: CircuitDocument, position: Point, text: string, ctx: OpContext): { doc: CircuitDocument; id: Id } {
  const id = ctx.ids.next('n');
  return { doc: { ...doc, annotations: { ...doc.annotations, [id]: { id, position, text } } }, id };
}

export function updateAnnotationText(doc: CircuitDocument, annotationId: Id, text: string): CircuitDocument {
  const annotation = doc.annotations[annotationId];
  if (!annotation || annotation.text === text) return doc;
  return { ...doc, annotations: { ...doc.annotations, [annotationId]: { ...annotation, text: text.slice(0, 500) } } };
}
