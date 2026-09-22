import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { KeyValueStorage } from '../platform/storage';
import { DARK_PALETTE, LIGHT_PALETTE, PaletteContext } from './theme';
import { chooseTheme, effectiveTheme, storedTheme, systemDarkQuery, type ThemeMode } from './themeMode';

interface ThemeState {
  readonly mode: ThemeMode;
  toggle(): void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/**
 * Tema activo (R4 §5): el CSS ya lo sigue solo; esto se lo da a lo que se dibuja con colores
 * literales (lienzo y miniaturas de la biblioteca) y al botón de la barra.
 */
export function ThemeProvider({ storage, children }: { storage: KeyValueStorage; children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => effectiveTheme(storage));

  // Sin elección guardada el tema sigue al sistema.
  useEffect(() => {
    const query = systemDarkQuery();
    if (!query) return;
    const onChange = () => {
      if (!storedTheme(storage)) setMode(query.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [storage]);

  const toggle = useCallback(() => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    chooseTheme(storage, next);
    setMode(next);
  }, [mode, storage]);

  const state = useMemo(() => ({ mode, toggle }), [mode, toggle]);
  return (
    <ThemeContext.Provider value={state}>
      <PaletteContext.Provider value={mode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE}>{children}</PaletteContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext);
  if (!state) throw new Error('useTheme fuera de ThemeProvider');
  return state;
}
