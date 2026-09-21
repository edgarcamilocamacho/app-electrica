import type { OpContext } from '../../model/document';
import { nextContactRef, nextRef, usedRefs } from '../../model/refs';
import type { CircuitDocument, ComponentInstance, Id, Point, Rotation } from '../../model/types';
import { defaultProps } from '../../registry/catalog';
import { WorkGraph } from '../graph';
import { finalizeEdit, rejected, type EditResult } from './common';
import { landFreeTerminals } from './connect';

export interface PlaceRequest {
  readonly type: string;
  readonly position: Point;
  readonly rotation: Rotation;
  readonly props?: Readonly<Record<string, unknown>>;
}

export interface PlaceResult extends EditResult {
  readonly componentId?: Id;
}

/** Referencia inicial de un componente nuevo (K1, S2, K1.1…). */
export function initialRef(doc: CircuitDocument, type: string, props: Readonly<Record<string, unknown>>, ctx: OpContext): string {
  if (typeof props.ref === 'string' && props.ref !== '') return props.ref;
  const def = ctx.registry.require(type);
  const used = usedRefs(doc);
  if (def.behavior.kind === 'contact') {
    const link = typeof props.link === 'string' ? props.link : '';
    return link ? nextContactRef(link, used) : '';
  }
  return def.refPrefix ? nextRef(def.refPrefix, used) : '';
}

/**
 * Coloca un componente (PLAN §5.6). Cada terminal que cae exactamente sobre un conductor se
 * conecta; si los dos caen sobre el mismo tramo recto, se inserta en serie.
 */
export function placeComponent(doc: CircuitDocument, req: PlaceRequest, ctx: OpContext): PlaceResult {
  const def = ctx.registry.get(req.type);
  if (!def) return rejected(doc, 'INVALID_INPUT');
  const g = new WorkGraph(doc, ctx.registry);
  const id = ctx.ids.next('c');
  const props = { ...defaultProps(def), ...(req.props ?? {}) };
  props.ref = initialRef(doc, req.type, props, ctx);
  const component: ComponentInstance = { id, type: req.type, position: req.position, rotation: req.rotation, props };
  g.components[id] = component;
  landFreeTerminals(g, ctx, [id]);
  return { ...finalizeEdit(doc, g, ctx), componentId: id };
}
