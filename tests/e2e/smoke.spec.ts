import { expect, test } from '@playwright/test';
import { openApp, state } from './helpers';

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

  test('ajustar la vista deja todo el diagrama visible', async ({ page }) => {
    await openApp(page);
    await page.getByTitle(/Ajustar la vista/).click();
    expect((await state(page)).zoom).toBeGreaterThan(0.2);
  });
});
