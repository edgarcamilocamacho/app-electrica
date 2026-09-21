import { computeNets } from '../connectivity/nets';
import { buildRefIndex } from '../connectivity/refs';
import { compareIds } from '../model/ids';
import type { CircuitDocument, Id, Point } from '../model/types';
import type { Registry } from '../registry/types';
import { computeViolations } from '../topology/validity';

/**
 * Diagnósticos del documento (PLAN §8, RESPONSE_ROUND_2 §30.2). El núcleo devuelve códigos y
 * parámetros; la UI los traduce. Simular exige cero bloqueantes.
 *
 * Un diagnóstico bloqueante NO es un error de simulación: impide arrancar. Un corto u oscilación
 * ocurren durante la corrida y llevan a modo ERROR.
 */
export type Severity = 'blocking' | 'warning' | 'info';

export type DiagnosticCode =
  | 'OVERLAP' // V1
  | 'AMBIGUOUS_CONTACT' // V2 / V3
  | 'INVALID_GEOMETRY' // V5
  | 'REF_BROKEN'
  | 'REF_DUPLICATE'
  | 'REF_WRONG_TYPE'
  | 'REF_REPEATED'
  | 'REF_MISSING'
  | 'BYPASSED'
  | 'NO_CONTACTS';

export const SEVERITY: Readonly<Record<DiagnosticCode, Severity>> = {
  OVERLAP: 'blocking',
  AMBIGUOUS_CONTACT: 'blocking',
  INVALID_GEOMETRY: 'blocking',
  REF_BROKEN: 'blocking',
  REF_DUPLICATE: 'blocking',
  REF_WRONG_TYPE: 'blocking',
  REF_REPEATED: 'warning',
  REF_MISSING: 'warning',
  BYPASSED: 'warning',
  NO_CONTACTS: 'info',
};

export interface Diagnostic {
  readonly key: string;
  readonly code: DiagnosticCode;
  readonly severity: Severity;
  readonly params: Readonly<Record<string, string | number>>;
  readonly componentIds: readonly Id[];
  readonly segmentIds: readonly Id[];
  readonly vertexIds: readonly Id[];
  readonly at?: Point;
}

const refOf = (doc: CircuitDocument, id: Id): string => {
  const ref = doc.components[id]?.props.ref;
  return typeof ref === 'string' ? ref : '';
};

export function computeDiagnostics(doc: CircuitDocument, registry: Registry): Diagnostic[] {
  const out: Diagnostic[] = [];
  const add = (d: Omit<Diagnostic, 'severity' | 'componentIds' | 'segmentIds' | 'vertexIds'> & Partial<Diagnostic>) =>
    out.push({ severity: SEVERITY[d.code], componentIds: [], segmentIds: [], vertexIds: [], ...d });

  // Geometría ambigua.
  for (const v of computeViolations(doc, registry)) {
    const code = v.code === 'V1' ? 'OVERLAP' : v.code === 'V5' ? 'INVALID_GEOMETRY' : 'AMBIGUOUS_CONTACT';
    add({
      key: v.key,
      code,
      params: { x: v.at.x, y: v.at.y },
      at: v.at,
      segmentIds: v.segmentIds,
      vertexIds: v.vertexIds,
      componentIds: v.componentIds,
    });
  }

  // Referencias.
  const refs = buildRefIndex(doc, registry);
  const ids = Object.keys(doc.components).sort(compareIds);
  for (const id of ids) {
    const r = refs.resolve(id);
    const c = doc.components[id]!;
    if (registry.require(c.type).behavior.kind !== 'contact') continue;
    const ref = refOf(doc, id);
    if (r.status === 'empty' || r.status === 'missing') {
      add({ key: `REF_BROKEN|${id}`, code: 'REF_BROKEN', params: { ref, link: r.status === 'missing' ? r.link : '' }, componentIds: [id], at: c.position });
    } else if (r.status === 'wrong-type') {
      add({
        key: `REF_WRONG_TYPE|${id}`,
        code: 'REF_WRONG_TYPE',
        params: { ref, link: r.link, expected: r.expected },
        componentIds: [id, r.targetId],
        at: c.position,
      });
    }
  }
  for (const [ref, targetIds] of refs.targets) {
    if (targetIds.length > 1) {
      add({ key: `REF_DUPLICATE|${ref}`, code: 'REF_DUPLICATE', params: { ref, count: targetIds.length }, componentIds: targetIds });
    }
  }

  // Referencias repetidas en componentes que no son destino de vínculo (dos H1).
  const byRef = new Map<string, Id[]>();
  for (const id of ids) {
    const ref = refOf(doc, id);
    if (ref) byRef.set(ref, [...(byRef.get(ref) ?? []), id]);
  }
  for (const [ref, group] of byRef) {
    if (group.length < 2 || (refs.targets.get(ref)?.length ?? 0) > 1) continue;
    add({ key: `REF_REPEATED|${ref}`, code: 'REF_REPEATED', params: { ref, count: group.length }, componentIds: group });
  }

  // Bobinas y timers sin referencia, o sin contactos.
  for (const id of ids) {
    const kind = registry.require(doc.components[id]!.type).behavior.kind;
    if (kind !== 'coil' && kind !== 'timer') continue;
    const ref = refOf(doc, id);
    if (ref === '') add({ key: `REF_MISSING|${id}`, code: 'REF_MISSING', params: {}, componentIds: [id] });
    else if (!refs.contactsOf.get(id)?.length) {
      add({ key: `NO_CONTACTS|${id}`, code: 'NO_CONTACTS', params: { ref }, componentIds: [id] });
    }
  }

  // Componentes puenteados por el cableado.
  const nets = computeNets(doc);
  for (const id of ids) {
    const c = doc.components[id]!;
    const terminals = registry.require(c.type).terminals;
    const seen = new Map<string, string>();
    for (const t of terminals) {
      const net = nets.netOfTerminal(id, t.id);
      const first = seen.get(net);
      if (first !== undefined) {
        add({
          key: `BYPASSED|${id}|${first}|${t.id}`,
          code: 'BYPASSED',
          params: { ref: refOf(doc, id), a: first, b: t.id },
          componentIds: [id],
          at: c.position,
        });
        break;
      }
      seen.set(net, t.id);
    }
  }

  return out;
}

export const blockingDiagnostics = (diagnostics: readonly Diagnostic[]): Diagnostic[] =>
  diagnostics.filter((d) => d.severity === 'blocking');

export const canSimulate = (diagnostics: readonly Diagnostic[]): boolean =>
  !diagnostics.some((d) => d.severity === 'blocking');
