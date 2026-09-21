/**
 * Almacenamiento local tolerante a fallos: en modo privado o con el almacenamiento bloqueado,
 * las lecturas devuelven null y las escrituras se ignoran sin romper la app.
 */
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
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
};

export function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
  };
}

export const AUTOSAVE_KEY = 'simulador-control:autosave:v1';

export interface AutosaveEntry {
  readonly savedAt: string;
  readonly fileName: string;
  readonly text: string;
}

export function readAutosave(storage: KeyValueStorage): AutosaveEntry | null {
  const raw = storage.get(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AutosaveEntry>;
    if (typeof parsed.text !== 'string' || typeof parsed.savedAt !== 'string') return null;
    return { savedAt: parsed.savedAt, fileName: parsed.fileName ?? '', text: parsed.text };
  } catch {
    return null;
  }
}

export function writeAutosave(storage: KeyValueStorage, entry: AutosaveEntry): void {
  storage.set(AUTOSAVE_KEY, JSON.stringify(entry));
}
