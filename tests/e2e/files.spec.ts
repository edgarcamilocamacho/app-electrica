import { expect, test } from '@playwright/test';
import { openApp, state } from './helpers';

test.describe('archivos', () => {
  test('guardar descarga el JSON del tablero', async ({ page }) => {
    await openApp(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Guardar/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.json$/);
  });

  test('exportar deja una imagen PNG', async ({ page }) => {
    await openApp(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Imagen PNG' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.png$/);
  });

  test('un archivo de la versión clásica no se abre [R5 §15]', async ({ page }) => {
    await openApp(page);
    const before = await state(page);
    const dialogMessage = new Promise<string>((resolve) => {
      page.once('dialog', (dialog) => {
        resolve(dialog.message());
        void dialog.dismiss();
      });
    });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /^Abrir/ }).click();
    await (await chooser).setFiles({
      name: 'clasico.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, metadata: {}, components: {}, vertices: {}, segments: {} })),
    });
    expect(await dialogMessage).toContain('clásica');
    expect((await state(page)).devices).toBe(before.devices);
  });

  test('abrir un tablero guardado lo restaura', async ({ page }) => {
    await openApp(page);
    const json = await page.evaluate(() => window.__e2e!.documentJson());
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
    expect((await state(page)).devices).toBe(0);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /^Abrir/ }).click();
    await (await chooser).setFiles({ name: 'tablero.json', mimeType: 'application/json', buffer: Buffer.from(json) });
    await expect.poll(async () => (await state(page)).devices).toBeGreaterThan(0);
  });
});
