import { compareIds } from '../model/ids';
import type { CircuitDocument, Id } from '../model/types';
import type { Registry } from '../registry/types';

/**
 * Vínculos lógicos bobina/timer ↔ contacto (spec §8.5, PLAN §11). Los contactos comunes se
 * vinculan solo a bobinas; los temporizados, solo a timers (R3 Q3.4).
 */
export type LinkTargetKind = 'coil' | 'timer';

export type LinkResolution =
  | { readonly status: 'ok'; readonly targetId: Id }
  | { readonly status: 'empty' }
  | { readonly status: 'missing'; readonly link: string }
  | { readonly status: 'ambiguous'; readonly link: string; readonly candidates: readonly Id[] }
  | { readonly status: 'wrong-type'; readonly link: string; readonly targetId: Id; readonly expected: LinkTargetKind };

export interface RefIndex {
  /** ref → componentes destino de vínculo (bobinas y timers) con esa ref. */
  readonly targets: ReadonlyMap<string, readonly Id[]>;
  resolve(contactId: Id): LinkResolution;
  /** Contactos vinculados (con éxito) a cada destino. */
  readonly contactsOf: ReadonlyMap<Id, readonly Id[]>;
}

export function targetKindOf(doc: CircuitDocument, id: Id, registry: Registry): LinkTargetKind | undefined {
  const c = doc.components[id];
  if (!c) return undefined;
  const kind = registry.require(c.type).behavior.kind;
  return kind === 'coil' ? 'coil' : kind === 'timer' ? 'timer' : undefined;
}

export function buildRefIndex(doc: CircuitDocument, registry: Registry): RefIndex {
  const targets = new Map<string, Id[]>();
  const ids = Object.keys(doc.components).sort(compareIds);
  for (const id of ids) {
    const c = doc.components[id]!;
    const kind = registry.require(c.type).behavior.kind;
    const ref = typeof c.props.ref === 'string' ? c.props.ref : '';
    if ((kind === 'coil' || kind === 'timer') && ref !== '') {
      targets.set(ref, [...(targets.get(ref) ?? []), id]);
    }
  }

  const resolve = (contactId: Id): LinkResolution => {
    const c = doc.components[contactId];
    if (!c) return { status: 'empty' };
    const behavior = registry.require(c.type).behavior;
    if (behavior.kind !== 'contact') return { status: 'empty' };
    const link = typeof c.props.link === 'string' ? c.props.link.trim() : '';
    if (link === '') return { status: 'empty' };
    const candidates = targets.get(link) ?? [];
    if (candidates.length === 0) return { status: 'missing', link };
    if (candidates.length > 1) return { status: 'ambiguous', link, candidates };
    const targetId = candidates[0]!;
    if (targetKindOf(doc, targetId, registry) !== behavior.linkTo) {
      return { status: 'wrong-type', link, targetId, expected: behavior.linkTo };
    }
    return { status: 'ok', targetId };
  };

  const contactsOf = new Map<Id, Id[]>();
  for (const id of ids) {
    const r = resolve(id);
    if (r.status === 'ok') contactsOf.set(r.targetId, [...(contactsOf.get(r.targetId) ?? []), id]);
  }

  return { targets, resolve, contactsOf };
}
