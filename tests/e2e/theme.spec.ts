import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

const bodyBackground = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const canvasBackground = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="canvas"]')!).backgroundColor);

const LIGHT_BG = 'rgb(241, 245, 249)';
const DARK_BG = 'rgb(11, 17, 32)';
const PAPER = 'rgb(251, 253, 255)';

test.describe('sistema en modo oscuro', () => {
  test.use({ colorScheme: 'dark' });

  test('sin elección guardada la interfaz arranca oscura y el lienzo sigue claro', async ({ page }) => {
    await openApp(page);
    expect(await bodyBackground(page)).toBe(DARK_BG);
    expect(await canvasBackground(page)).toBe(PAPER);
    await expect(page.getByTestId('theme-toggle')).toHaveAttribute('data-theme-mode', 'dark');
  });
});

test('el botón alterna el tema y la elección sobrevive a una recarga', async ({ page }) => {
  await openApp(page);
  expect(await bodyBackground(page)).toBe(LIGHT_BG);
  await page.getByTestId('theme-toggle').click();
  expect(await bodyBackground(page)).toBe(DARK_BG);
  expect(await canvasBackground(page)).toBe(PAPER);
  await page.reload();
  // theme-init.js lo aplica antes de que arranque la app.
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await expect(page.getByTestId('theme-toggle')).toHaveAttribute('data-theme-mode', 'dark');
  await page.getByTestId('theme-toggle').click();
  expect(await bodyBackground(page)).toBe(LIGHT_BG);
});
