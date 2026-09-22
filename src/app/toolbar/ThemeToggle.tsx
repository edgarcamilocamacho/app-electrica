import { t } from '../i18n/t';
import { useTheme } from '../ThemeProvider';
import { Icons } from './icons';

/** Alterna entre modo claro y oscuro. El ícono muestra el modo al que se pasa. */
export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const label = t(mode === 'dark' ? 'toolbar.themeLight' : 'toolbar.themeDark');
  return (
    <button type="button" className="tb-button" title={label} aria-label={label} data-testid="theme-toggle" data-theme-mode={mode} onClick={toggle}>
      {mode === 'dark' ? Icons.sun : Icons.moon}
    </button>
  );
}
