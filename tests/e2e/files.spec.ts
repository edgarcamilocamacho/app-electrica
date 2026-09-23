import { expect, test } from '@playwright/test';
import { cloudState, fileMenu, openApp, state, waitIdle } from './helpers';

test.describe('importar y exportar [R6 §4]', () => {
  test('exportar JSON descarga el tablero con el nombre de la lista', async ({ page }) => {
    await openApp(page);
    const download = page.waitForEvent('download');
    await fileMenu(page, 'Exportar JSON');
    const file = await download;
    expect(file.suggestedFilename()).toBe('Arranque-directo.json');
  });

  test('exportar deja una imagen PNG', async ({ page }) => {
    await openApp(page);
    const download = page.waitForEvent('download');
    await fileMenu(page, 'Imagen PNG');
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.png$/);
  });

  test('un archivo de la versión clásica no se importa [R5 §15]', async ({ page }) => {
    await openApp(page);
    const before = await state(page);
    const chooser = page.waitForEvent('filechooser');
    await fileMenu(page, /^Importar/);
    await (await chooser).setFiles({
      name: 'clasico.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, metadata: {}, components: {}, vertices: {}, segments: {} })),
    });
    await expect(page.getByTestId('cloud-notice')).toContainText('clásica');
    expect((await state(page)).devices).toBe(before.devices);
    await expect(page.getByTestId('file-item')).toHaveCount(1);
  });

  test('importar agrega un tablero nuevo a la lista y lo abre', async ({ page }) => {
    await openApp(page);
    const json = await page.evaluate(() => window.__e2e!.documentJson());
    const devices = (await state(page)).devices;
    const chooser = page.waitForEvent('filechooser');
    await fileMenu(page, /^Importar/);
    await (await chooser).setFiles({ name: 'Mi tablero.json', mimeType: 'application/json', buffer: Buffer.from(json) });
    await expect(page.getByTestId('file-item')).toHaveCount(2);
    await waitIdle(page);
    expect((await cloudState(page)).name).toBe('Mi tablero');
    await expect(page.getByTestId('doc-name')).toHaveText('Mi tablero');
    expect((await state(page)).devices).toBe(devices);
  });
});
