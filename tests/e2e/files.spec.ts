import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { docJson, loadExample, openApp, place } from './helpers';

test('guardar, recargar y abrir: la topología es idéntica', async ({ page }) => {
  await openApp(page);
  await loadExample(page, 'seal-in');
  const original = await docJson(page);

  await page.getByTestId('menu-file').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('menu-save').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const path = await download.path();
  const text = await readFile(path, 'utf8');
  expect(JSON.parse(text).schemaVersion).toBe(1);

  await page.reload();
  await page.waitForFunction(() => !!window.__e2e);
  expect(Object.keys((await docJson(page)).components)).toHaveLength(0);

  await page.getByTestId('menu-file').click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('menu-open').click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path);
  await expect(page.locator('[data-component-id]')).toHaveCount(Object.keys(original.components).length);
  const reopened = await docJson(page);
  expect(reopened.components).toEqual(original.components);
  expect(reopened.segments).toEqual(original.segments);
  expect(reopened.vertices).toEqual(original.vertices);
});

test('abrir un archivo inválido muestra un error legible', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('menu-file').click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('menu-open').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'roto.json', mimeType: 'application/json', buffer: Buffer.from('{ esto no es json') });
  await expect(page.getByTestId('status-message')).toContainText('No se pudo abrir el archivo');
});

test('autoguardado: tras recargar se recupera el trabajo y se puede empezar uno nuevo', async ({ page }) => {
  await openApp(page, '&autosave');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.__e2e);
  await place(page, 'lamp', 0, 0);
  await page.reload(); // pagehide fuerza el guardado pendiente
  await page.waitForFunction(() => !!window.__e2e);
  await expect(page.getByTestId('toast')).toContainText('Se recuperó tu trabajo anterior');
  await expect(page.locator('[data-component-id]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Empezar uno nuevo' }).click();
  await expect(page.locator('[data-component-id]')).toHaveCount(0);
});

test.describe('exportación (R3 Q3.7)', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await loadExample(page, 'lamp');
  });

  const exportFile = async (page: import('@playwright/test').Page, testId: string) => {
    await page.getByTestId('menu-export').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId(testId).click();
    const download = await downloadPromise;
    return { name: download.suggestedFilename(), data: await readFile(await download.path()) };
  };

  test('SVG: diagrama completo, sin grid ni UI de edición', async ({ page }) => {
    const { name, data } = await exportFile(page, 'export-svg');
    expect(name).toMatch(/\.svg$/);
    const svg = data.toString('utf8');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toContain('grid-dots');
    expect((svg.match(/data-component-id/g) ?? []).length).toBe(3);
  });

  test('PNG válido', async ({ page }) => {
    const { name, data } = await exportFile(page, 'export-png');
    expect(name).toMatch(/\.png$/);
    expect(data.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(data.length).toBeGreaterThan(1000);
  });

  test('PDF válido', async ({ page }) => {
    const { name, data } = await exportFile(page, 'export-pdf-a4');
    expect(name).toMatch(/\.pdf$/);
    expect(data.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  test('exportar durante la simulación conserva los colores del estado', async ({ page }) => {
    await page.getByTestId('toggle-sim').click();
    const { data } = await exportFile(page, 'export-svg');
    expect(data.toString('utf8')).toContain('#2563eb'); // neutro en azul
  });
});

test('todos los ejemplos cargan sin problemas bloqueantes', async ({ page }) => {
  await openApp(page);
  for (const id of ['lamp', 'seal-in', 'ton', 'tof', 'selector']) {
    await loadExample(page, id);
    await expect(page.getByTestId('diagnostics').locator('[data-severity="blocking"]')).toHaveCount(0);
    await expect(page.locator('[data-component-id]').first()).toBeVisible();
  }
});
