import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseTheme, effectiveTheme, storedTheme, THEME_KEY } from '../../src/app/themeMode';
import { memoryStorage } from '../../src/platform/storage';

function mockSystem(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark && query.includes('dark'), addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe('tema de la interfaz (R4 §5)', () => {
  it('sin elección guardada sigue al sistema; sin matchMedia es claro', () => {
    const storage = memoryStorage();
    expect(effectiveTheme(storage)).toBe('light');
    mockSystem(true);
    expect(effectiveTheme(storage)).toBe('dark');
    mockSystem(false);
    expect(effectiveTheme(storage)).toBe('light');
  });

  it('elegir un tema lo guarda, lo fija en <html> y le gana al sistema', () => {
    const storage = memoryStorage();
    mockSystem(true);
    chooseTheme(storage, 'light');
    expect(storage.get(THEME_KEY)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(effectiveTheme(storage)).toBe('light');
  });

  it('un valor guardado desconocido se ignora', () => {
    const storage = memoryStorage();
    storage.set(THEME_KEY, 'sepia');
    expect(storedTheme(storage)).toBeNull();
  });
});
