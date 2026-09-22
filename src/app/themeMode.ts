import type { KeyValueStorage } from '../platform/storage';

/**
 * Tema de la interfaz (R4 §5). Sin elección guardada sigue al sistema (el CSS usa light-dark());
 * al elegir uno se guarda y se fija con data-theme en <html>. public/theme-init.js lo aplica antes
 * del primer pintado.
 */
export type ThemeMode = 'light' | 'dark';

/** La misma clave lee public/theme-init.js. */
export const THEME_KEY = 'simulador-control:theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function storedTheme(storage: KeyValueStorage): ThemeMode | null {
  const v = storage.get(THEME_KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

/** Consulta del sistema; puede faltar (jsdom). */
export function systemDarkQuery(): MediaQueryList | undefined {
  return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : undefined;
}

export function effectiveTheme(storage: KeyValueStorage): ThemeMode {
  return storedTheme(storage) ?? (systemDarkQuery()?.matches ? 'dark' : 'light');
}

export function chooseTheme(storage: KeyValueStorage, mode: ThemeMode): void {
  storage.set(THEME_KEY, mode);
  document.documentElement.dataset.theme = mode;
}
