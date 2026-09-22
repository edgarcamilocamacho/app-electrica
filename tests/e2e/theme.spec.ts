import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openApp, place, wire } from './helpers';

const background = (page: Page, selector: string) =>
  page.evaluate((sel) => getComputedStyle(document.querySelector(sel)!).backgroundColor, selector);
const wireStroke = (page: Page) => page.locator('[data-segment-id]').first().getAttribute('stroke');

const LIGHT_BG = 'rgb(241, 245, 249)';
const DARK_BG = 'rgb(11, 17, 32)';
const LIGHT_PAPER = 'rgb(251, 253, 255)';
const DARK_PAPER = 'rgb(14, 21, 34)';
const LIGHT_WIRE = '#1f2937';
const DARK_WIRE = '#cbd5e1';

test.describe('sistema en modo oscuro', () => {
  test.use({ colorScheme: 'dark' });

  test('sin elección guardada arrancan oscuros la interfaz, el lienzo y las miniaturas', async ({ page }) => {
    await openApp(page);
    await wire(page, [0, 0], [10, 0]);
    expect(await background(page, 'body')).toBe(DARK_BG);
    expect(await background(page, '[data-testid="canvas"]')).toBe(DARK_PAPER);
    expect(await background(page, '.lib-thumb')).toBe(DARK_PAPER);
    expect(await wireStroke(page)).toBe(DARK_WIRE);
    await expect(page.getByTestId('theme-toggle')).toHaveAttribute('data-theme-mode', 'dark');
  });

  test('la exportación sale con la paleta clara aunque la app esté oscura', async ({ page }) => {
    await openApp(page);
    await place(page, 'lamp', 0, 0);
    await wire(page, [0, -3], [0, -8]);
    await page.getByTestId('menu-export').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-svg').click();
    const svg = (await readFile(await (await downloadPromise).path())).toString('utf8');
    expect(svg).toContain(`stroke="${LIGHT_WIRE}"`);
    expect(svg).not.toContain(DARK_WIRE);
  });
});

test('el botón alterna el tema del lienzo y la elección sobrevive a una recarga', async ({ page }) => {
  await openApp(page);
  await wire(page, [0, 0], [10, 0]);
  expect(await background(page, 'body')).toBe(LIGHT_BG);
  expect(await wireStroke(page)).toBe(LIGHT_WIRE);
  await page.getByTestId('theme-toggle').click();
  expect(await background(page, 'body')).toBe(DARK_BG);
  expect(await background(page, '[data-testid="canvas"]')).toBe(DARK_PAPER);
  expect(await wireStroke(page)).toBe(DARK_WIRE);
  await page.reload();
  // theme-init.js lo aplica antes de que arranque la app.
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await expect(page.getByTestId('theme-toggle')).toHaveAttribute('data-theme-mode', 'dark');
  await page.getByTestId('theme-toggle').click();
  expect(await background(page, '[data-testid="canvas"]')).toBe(LIGHT_PAPER);
});
