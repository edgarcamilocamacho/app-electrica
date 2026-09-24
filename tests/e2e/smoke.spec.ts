import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openApp, state } from './helpers';

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

test.describe('humo', () => {
  test('abre con el ejemplo cargado y sin errores de consola', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await openApp(page);
    const s = await state(page);
    expect(s.devices).toBeGreaterThan(0);
    expect(s.wires).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('la biblioteca ofrece el catálogo completo', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('library-contactor-3p')).toBeVisible();
    await expect(page.getByTestId('library-relay-8')).toBeVisible();
    await expect(page.getByTestId('library-timer-ton')).toBeVisible();
    await expect(page.getByTestId('library-ups')).toBeVisible();
  });

  test('la barra de estado muestra la versión de la app', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('app-version')).toHaveText(`v${version}`);
    await expect(page.getByTestId('app-version')).toHaveAttribute('title', new RegExp(`^Versión ${version.replace(/\./g, '\\.')} · build `));
    const manifest = (await (await page.request.get('/version.json')).json()) as { version: string };
    expect(manifest.version).toBe(version);
  });

  test('ajustar la vista deja todo el diagrama visible', async ({ page }) => {
    await openApp(page);
    await page.getByTitle(/Ajustar la vista/).click();
    expect((await state(page)).zoom).toBeGreaterThan(0.2);
  });
});
