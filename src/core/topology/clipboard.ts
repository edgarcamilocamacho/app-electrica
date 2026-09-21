import { componentBounds, type OpContext } from '../model/document';
import { samePoint } from '../model/geometry';
import { compareIds, sortIds } from '../model/ids';
import { nextContactRef, nextRef, splitRef, usedRefs } from '../model/refs';
import type { Selection } from '../model/selection';
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
import { WorkGraph } from './graph';
import { finalizeEdit, rejected, type EditResult } from './ops/common';
import { landFreeTerminals, splitSegmentAt } from './ops/connect';

/**
 * Copiar / pegar / duplicar (RESPONSE_ROUND_2 §13, PLAN §12). El fragmento conserva exactamente
 * la topología interna de lo seleccionado: un cable cuyo componente no se copió queda con extremo
 * libre en la copia.
 */
export interface Fragment {
  readonly components: readonly ComponentInstance[];
  readonly vertices: readonly WireVertex[];
  readonly segments: readonly WireSegment[];
  readonly annotations: readonly TextAnnotation[];
  /** Esquina superior izquierda del contenido: referencia para ubicar la copia. */
  readonly origin: Point;
}

export function copyFragment(doc: CircuitDocument, selection: Selection, registry: Registry): Fragment | undefined {
  const componentIds = new Set(selection.components.filter((id) => doc.components[id]));
  const segments = selection.segments.map((id) => doc.segments[id]).filter((s): s is WireSegment => !!s);
  const annotations = selection.annotations.map((id) => doc.annotations[id]).filter((n): n is TextAnnotation => !!n);
  if (componentIds.size + segments.length + annotations.length === 0) return undefined;

  const g = new WorkGraph(doc, registry);
  const vertexIds = new Set<Id>();
  for (const s of segments) {
    vertexIds.add(s.a);
    vertexIds.add(s.b);
  }
  const vertices: WireVertex[] = sortIds(vertexIds).map((id) => {
    const v = doc.vertices[id]!;
    if (v.kind === 'terminal' && !componentIds.has(v.componentId)) {
      return { id, kind: 'point', position: g.vertexPos(v) }; // terminal no copiado → extremo libre
    }
    return v;
  });
  const components = sortIds(componentIds).map((id) => doc.components[id]!);

  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of components) {
    const b = componentBounds(c, registry);
    xs.push(b.minX);
    ys.push(b.minY);
  }
  for (const v of vertices) {
    const p = g.vertexPos(v.kind === 'terminal' ? v : v);
    xs.push(p.x);
    ys.push(p.y);
  }
  for (const n of annotations) {
    xs.push(n.position.x);
    ys.push(n.position.y);
  }
  return { components, vertices, segments, annotations, origin: { x: Math.min(...xs), y: Math.min(...ys) } };
}

export interface PasteResult extends EditResult {
  readonly selection: Selection;
}

/**
 * Pega un fragmento desplazado `delta`. Ids nuevos, referencias sin colisión (I5):
 *   K1 → K2 · bobina + contactos copiados juntos → K2, K2.1… · contacto solo → sigue vinculado a su
 *   bobina original con el próximo número libre (K1.3).
 * Terminales libres y extremos libres que aterrizan exactamente sobre un conductor se conectan (I6).
 */
export function pasteFragment(doc: CircuitDocument, fragment: Fragment, delta: Point, ctx: OpContext): PasteResult {
  const empty: Selection = { components: [], segments: [], annotations: [] };
  if (fragment.components.length + fragment.segments.length + fragment.annotations.length === 0) {
    return { ...rejected(doc, 'INVALID_INPUT'), selection: empty };
  }
  const g = new WorkGraph(doc, ctx.registry);
  const shift = (p: Point): Point => ({ x: p.x + delta.x, y: p.y + delta.y });

  // Referencias: primero los destinos de vínculo, para poder renombrar los contactos que los siguen.
  const used = usedRefs(doc);
  const renamed = new Map<string, string>();
  const componentMap = new Map<Id, Id>();
  const ordered = [...fragment.components].sort((a, b) => {
    const ka = ctx.registry.require(a.type).behavior.kind === 'contact' ? 1 : 0;
    const kb = ctx.registry.require(b.type).behavior.kind === 'contact' ? 1 : 0;
    return ka - kb || compareIds(a.id, b.id);
  });
  const newComponentIds: Id[] = [];
  for (const c of ordered) {
    const def = ctx.registry.require(c.type);
    const props: Record<string, unknown> = { ...c.props };
    const oldRef = typeof c.props.ref === 'string' ? c.props.ref : '';
    if (def.behavior.kind === 'contact') {
      const oldLink = typeof c.props.link === 'string' ? c.props.link : '';
      const link = renamed.get(oldLink) ?? oldLink;
      props.link = link;
      props.ref = link ? nextContactRef(link, used) : '';
    } else if (oldRef !== '' || def.refPrefix) {
      const prefix = splitRef(oldRef)?.[0] ?? def.refPrefix;
      const ref = prefix ? nextRef(prefix, used) : oldRef;
      props.ref = ref;
      if (oldRef) renamed.set(oldRef, ref);
    }
    if (typeof props.ref === 'string' && props.ref) used.add(props.ref);
    const id = ctx.ids.next('c');
    componentMap.set(c.id, id);
    g.components[id] = { id, type: c.type, position: shift(c.position), rotation: c.rotation, props };
    newComponentIds.push(id);
  }

  const vertexMap = new Map<Id, Id>();
  for (const v of fragment.vertices) {
    const id = ctx.ids.next('v');
    vertexMap.set(v.id, id);
    if (v.kind === 'point') g.addVertex({ id, kind: 'point', position: shift(v.position) });
    else g.addVertex({ id, kind: 'terminal', componentId: componentMap.get(v.componentId)!, terminalId: v.terminalId });
  }
  const newSegmentIds: Id[] = [];
  for (const s of fragment.segments) {
    const id = ctx.ids.next('s');
    g.addSegment({ id, a: vertexMap.get(s.a)!, b: vertexMap.get(s.b)! });
    newSegmentIds.push(id);
  }
  const newAnnotationIds: Id[] = [];
  for (const n of fragment.annotations) {
    const id = ctx.ids.next('n');
    g.annotations[id] = { id, position: shift(n.position), text: n.text };
    newAnnotationIds.push(id);
  }

  // Conexiones explícitas por la acción de pegar.
  const pastedVertices = new Set(vertexMap.values());
  const pastedComponents = new Set(newComponentIds);
  landFreeTerminals(g, ctx, newComponentIds, { movingVertices: pastedVertices, movingComponents: pastedComponents });
  for (const vid of sortIds(pastedVertices)) {
    const v = g.vertices[vid];
    if (!v || v.kind !== 'point' || g.degree(vid) !== 1) continue;
    landFreeEnd(g, ctx, vid, pastedVertices, pastedComponents);
  }

  const result = finalizeEdit(doc, g, ctx);
  const selection: Selection = {
    components: newComponentIds,
    segments: newSegmentIds.filter((id) => result.doc.segments[id]),
    annotations: newAnnotationIds,
  };
  return { ...result, selection };
}

/** Un extremo libre pegado que cae exactamente sobre un conductor estático se conecta. */
function landFreeEnd(g: WorkGraph, ctx: OpContext, vertexId: Id, pasted: ReadonlySet<Id>, pastedComponents: ReadonlySet<Id>): void {
  const p = g.pos(vertexId);
  const isStatic = (id: Id) => {
    if (pasted.has(id)) return false;
    const v = g.vertices[id];
    return !(v?.kind === 'terminal' && pastedComponents.has(v.componentId));
  };
  const target = sortIds(Object.keys(g.vertices)).find((id) => isStatic(id) && samePoint(g.pos(id), p));
  if (target) {
    g.replaceVertex(vertexId, target);
    return;
  }
  for (const cid of sortIds(Object.keys(g.components))) {
    if (pastedComponents.has(cid)) continue;
    const def = g.registry.require(g.components[cid]!.type);
    for (const t of def.terminals) {
      if (g.terminalVertex(cid, t.id)) continue;
      const tv = { id: ctx.ids.next('v'), kind: 'terminal' as const, componentId: cid, terminalId: t.id };
      const tp = g.vertexPos(tv);
      if (!samePoint(tp, p)) continue;
      g.addVertex(tv);
      g.replaceVertex(vertexId, tv.id);
      return;
    }
  }
  const seg = sortIds(Object.keys(g.segments)).find((id) => {
    const s = g.segments[id]!;
    if (!isStatic(s.a) || !isStatic(s.b)) return false;
    const a = g.pos(s.a);
    const b = g.pos(s.b);
    return (a.y === b.y && p.y === a.y && p.x > Math.min(a.x, b.x) && p.x < Math.max(a.x, b.x)) ||
      (a.x === b.x && p.x === a.x && p.y > Math.min(a.y, b.y) && p.y < Math.max(a.y, b.y));
  });
  if (seg) splitSegmentAt(g, ctx, seg, vertexId);
}
