import type { CircuitDocument } from './types';

/** Referencias usadas en el documento (props.ref de todos los componentes). */
export function usedRefs(doc: CircuitDocument, extra: Iterable<string> = []): Set<string> {
  const refs = new Set<string>(extra);
  for (const c of Object.values(doc.components)) {
    const ref = c.props.ref;
    if (typeof ref === 'string' && ref !== '') refs.add(ref);
  }
  return refs;
}

/** Próxima referencia libre con un prefijo: K1, K2… */
export function nextRef(prefix: string, used: ReadonlySet<string>): string {
  for (let n = 1; ; n++) {
    const candidate = `${prefix}${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Próxima referencia libre para un contacto vinculado: K1.1, K1.2… */
export function nextContactRef(link: string, used: ReadonlySet<string>): string {
  return nextRef(`${link}.`, used);
}

/** Separa una referencia en prefijo y número: "KT12" → ["KT", 12]. */
export function splitRef(ref: string): [string, number] | undefined {
  const m = /^(.*?)(\d+)$/.exec(ref);
  return m ? [m[1]!, Number(m[2])] : undefined;
}
