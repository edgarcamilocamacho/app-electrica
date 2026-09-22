import { expect, type Page } from '@playwright/test';

/** Abre la app en modo E2E: tiempo de simulación manual, sin selectores nativos de archivos. */
export async function openApp(page: Page, query = ''): Promise<void> {
  await page.goto(`/?e2e=1&noversion${query}`);
  await expect(page.getByTestId('board-canvas')).toBeVisible();
  await page.waitForFunction(() => !!window.__e2e);
  await page.evaluate(() => window.__e2e!.resetView());
}

/** Abre una entrada del menú Archivo. */
export async function fileMenu(page: Page, item: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: /Archivo/ }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

/** Tablero vacío, para las pruebas que construyen su propio circuito. */
export async function newBoard(page: Page): Promise<void> {
  await fileMenu(page, 'Nuevo');
  await page.evaluate(() => window.__e2e!.resetView());
}

export async function toScreen(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([wx, wy]) => window.__e2e!.worldToScreen(wx!, wy!), [x, y]);
}

export async function clickAt(page: Page, x: number, y: number): Promise<void> {
  const p = await toScreen(page, x, y);
  await page.mouse.click(p.x, p.y);
}

export async function dragAt(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const a = await toScreen(page, ...from);
  const b = await toScreen(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

/** Coloca un aparato desde la biblioteca. */
export async function place(page: Page, type: string, x: number, y: number): Promise<void> {
  await page.getByTestId(`library-${type}`).click();
  await clickAt(page, x, y);
}

/** Traza un cable de un borne a otro, con la herramienta Cable. */
export async function wire(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  await page.getByTestId('tool-wire').click();
  await clickAt(page, ...from);
  await clickAt(page, ...to);
  await page.getByTestId('tool-select').click();
}

export async function state(page: Page): Promise<{ mode: string; tool: string; zoom: number; devices: number; wires: number }> {
  return page.evaluate(() => window.__e2e!.state());
}

export async function advance(page: Page, ms: number): Promise<void> {
  await page.evaluate((value) => window.__e2e!.advance(value), ms);
}

export const device = (page: Page, ref: string) => page.locator(`[data-ref="${ref}"]`);
