import { useEffect, useState } from 'react';
import { browserStorage } from '../../platform/storage';
import { t } from '../i18n/t';
import { chooseTheme, effectiveTheme, storedTheme, systemDarkQuery, type ThemeMode } from '../themeMode';
import { Icons } from './icons';

/** Alterna entre modo claro y oscuro. El ícono muestra el modo al que se pasa. */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => effectiveTheme(browserStorage));

  // Sin elección guardada el tema sigue al sistema, y el ícono también.
  useEffect(() => {
    const query = systemDarkQuery();
    if (!query) return;
    const onChange = () => {
      if (!storedTheme(browserStorage)) setMode(query.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
  const label = t(next === 'dark' ? 'toolbar.themeDark' : 'toolbar.themeLight');
  return (
    <button
      type="button"
      className="tb-button"
      title={label}
      aria-label={label}
      data-testid="theme-toggle"
      data-theme-mode={mode}
      onClick={() => {
        chooseTheme(browserStorage, next);
        setMode(next);
      }}
    >
      {next === 'dark' ? Icons.moon : Icons.sun}
    </button>
  );
}
