import { customAlphabet } from 'nanoid';

/** Prefijo por clase de entidad: componente, vértice, segmento, anotación, aparato, cable. */
export type IdPrefix = 'c' | 'v' | 's' | 'n' | 'd' | 'w';

/**
 * Generador de ids inyectable: la app usa ids aleatorios; los tests, un contador
 * determinista. Así las operaciones puras dan siempre el mismo resultado.
 */
export interface IdGen {
  next(prefix: IdPrefix): string;
}

const randomPart = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

export function createRandomIdGen(): IdGen {
  return { next: (prefix) => `${prefix}_${randomPart()}` };
}

/** Ids `c1`, `v1`, `s1`… con un contador por prefijo. Solo para tests y fixtures. */
export function createCounterIdGen(): IdGen {
  const counters: Record<IdPrefix, number> = { c: 0, v: 0, s: 0, n: 0, d: 0, w: 0 };
  return {
    next(prefix) {
      counters[prefix] += 1;
      return `${prefix}${counters[prefix]}`;
    },
  };
}

/** Orden determinista de ids (numérico cuando ambos terminan en número). */
export function compareIds(a: string, b: string): number {
  const ma = /^(\D*)(\d+)$/.exec(a);
  const mb = /^(\D*)(\d+)$/.exec(b);
  if (ma && mb && ma[1] === mb[1]) return Number(ma[2]) - Number(mb[2]);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortIds<T extends string>(ids: Iterable<T>): T[] {
  return [...ids].sort(compareIds);
}
