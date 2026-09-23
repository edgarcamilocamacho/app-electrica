/**
 * Almacenamiento local tolerante a fallos: en modo privado o con el almacenamiento bloqueado,
 * las lecturas devuelven null y las escrituras se ignoran sin romper la app.
 */
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** Claves guardadas que empiezan con `prefix`. */
  keys(prefix: string): string[];
}

export const browserStorage: KeyValueStorage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* sin almacenamiento disponible */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* sin almacenamiento disponible */
    }
  },
  keys(prefix) {
    try {
      const found: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(prefix)) found.push(key);
      }
      return found;
    } catch {
      return [];
    }
  },
};

export function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
    keys: (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix)),
  };
}
