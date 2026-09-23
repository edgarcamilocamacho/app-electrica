/**
 * Nombres de los tableros: únicos entre los activos, sin distinguir mayúsculas. Si uno ya existe se
 * le agrega un número al final, «Nombre (2)» [R6 §10].
 */
import { CLOUD_LIMITS } from './types';

/** Limpia un nombre: sin caracteres de control, espacios colapsados, largo acotado. */
export function cleanName(raw: string, maxLength: number = CLOUD_LIMITS.maxNameLength): string {
  const cleaned = raw
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...cleaned].slice(0, maxLength).join('').trim();
}

/** Clave para comparar nombres: mismo nombre sin importar mayúsculas. */
export const nameKey = (name: string): string => cleanName(name).toLowerCase();

const NUMBERED = /^(.*\S) \((\d{1,6})\)$/;

/**
 * Primer nombre libre a partir de `base`: el mismo, o con «(2)», «(3)»… Si `base` ya termina en un
 * número entre paréntesis, se sigue desde ese número en vez de agregar otro.
 */
export function uniqueName(base: string, taken: (key: string) => boolean, maxLength: number = CLOUD_LIMITS.maxNameLength): string {
  const name = cleanName(base, maxLength);
  if (!taken(nameKey(name))) return name;
  const match = NUMBERED.exec(name);
  const stem = match ? match[1]! : name;
  let n = match ? Number(match[2]) + 1 : 2;
  for (;;) {
    const suffix = ` (${n})`;
    const room = maxLength - suffix.length;
    const candidate = `${[...stem].slice(0, room).join('').trimEnd()}${suffix}`;
    if (!taken(nameKey(candidate))) return candidate;
    n += 1;
  }
}

/** Largo en bytes UTF-8, sin depender de TextEncoder (el núcleo no tiene DOM). */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}
