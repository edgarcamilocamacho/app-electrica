import { es } from './es';

/**
 * Convierte un diccionario anidado en la unión de rutas de sus hojas:
 * { a: { b: 'x' } } → 'a.b'. Una clave inexistente es un error de compilación.
 */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Misma forma que el diccionario base, con cualquier texto en las hojas. */
export type Messages<T = typeof es> = {
  [K in keyof T]: T[K] extends string ? string : Messages<T[K]>;
};

export type MessageKey = Leaves<typeof es>;
export type MessageParams = Record<string, string | number>;

let active: Messages = es;

/** Cambia el diccionario activo. V1 solo trae español; queda preparado para más idiomas. */
export function setMessages(messages: Messages): void {
  active = messages;
}

function lookup(key: string): string | undefined {
  let node: unknown = active;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Traduce una clave; `{nombre}` en el texto se reemplaza con `params.nombre`. */
export function t(key: MessageKey, params?: MessageParams): string {
  const template = lookup(key) ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Para claves que llegan como dato (códigos del núcleo). Devuelve undefined si no existe. */
export function tMaybe(key: string, params?: MessageParams): string | undefined {
  const template = lookup(key);
  if (template === undefined) return undefined;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
