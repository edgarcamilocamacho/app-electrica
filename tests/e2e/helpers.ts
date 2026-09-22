import { expect, type Page } from '@playwright/test';

/** Abre la app en modo E2E: reloj de simulación manual, sin selectores nativos de archivos. */
export async function openApp(page: Page, query = ''): Promise<void> {
  await page.goto(`/?e2e=1&noversion${query}`);
  await expect(page.getByTestId('canvas')).toBeVisible();
  await page.waitForFunction(() => !!window.__e2e);
  // Zoom 100 %: el lienzo visible cubre de sobra las coordenadas que usan las pruebas (±40).
  await page.evaluate(() => window.__e2e!.resetView());
}

export async function toScreen(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([wx, wy]) => window.__e2e!.worldToScreen(wx!, wy!), [x, y]);
}

/** Clic en coordenadas de grid del mundo. */
export async function clickAt(page: Page, x: number, y: number, modifiers: ('Shift')[] = []): Promise<void> {
  const p = await toScreen(page, x, y);
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.click(p.x, p.y);
  for (const m of modifiers) await page.keyboard.up(m);
}

/** Arrastre con el botón izquierdo entre dos puntos de grid del mundo. */
export async function dragAt(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const a = await toScreen(page, ...from);
  const b = await toScreen(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

export async function hoverAt(page: Page, x: number, y: number): Promise<void> {
  const p = await toScreen(page, x, y);
  await page.mouse.move(p.x, p.y);
}

export async function place(page: Page, type: string, x: number, y: number): Promise<void> {
  await page.getByTestId(`library-${type}`).click();
  await clickAt(page, x, y);
  await page.keyboard.press('Escape');
}

/** Traza un cable por puntos de grid; termina con Enter si el último punto no conecta. */
export async function wire(page: Page, ...pts: [number, number][]): Promise<void> {
  await page.keyboard.press('c');
  for (const [x, y] of pts) await clickAt(page, x, y);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
}

export async function advance(page: Page, ms: number): Promise<void> {
  await page.evaluate((v) => window.__e2e!.advance(v), ms);
}

export interface DocJson {
  components: Record<string, { type: string; position: { x: number; y: number }; rotation: number; props: Record<string, unknown> }>;
  vertices: Record<string, { kind: string; componentId?: string; terminalId?: string; position?: { x: number; y: number } }>;
  segments: Record<string, { a: string; b: string }>;
  annotations: Record<string, { text: string }>;
}

export async function docJson(page: Page): Promise<DocJson> {
  return JSON.parse(await page.evaluate(() => window.__e2e!.documentJson())) as DocJson;
}

export function byRef(page: Page, ref: string) {
  return page.locator(`[data-component-id][data-ref="${ref}"]`);
}

export async function loadExample(page: Page, id: string): Promise<void> {
  await page.getByTestId('menu-examples').click();
  await page.getByTestId(`example-${id}`).click();
}

export async function centerOf(page: Page, ref: string): Promise<{ x: number; y: number }> {
  const box = await byRef(page, ref).locator('g').first().boundingBox();
  if (!box) throw new Error(`Sin caja para ${ref}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Clic sobre el cuerpo de un componente (por su referencia). */
export async function clickRef(page: Page, ref: string): Promise<void> {
  const c = await centerOf(page, ref);
  await page.mouse.click(c.x, c.y);
}

/** ¿Están conectados dos terminales? (misma red en el documento serializado) */
export function connected(doc: DocJson, a: [string, string], b: [string, string]): boolean {
  const vertexOf = (cid: string, tid: string) =>
    Object.entries(doc.vertices).find(([, v]) => v.kind === 'terminal' && v.componentId === cid && v.terminalId === tid)?.[0];
  const start = vertexOf(...a);
  const goal = vertexOf(...b);
  if (!start || !goal) return false;
  const adj = new Map<string, string[]>();
  for (const s of Object.values(doc.segments)) {
    adj.set(s.a, [...(adj.get(s.a) ?? []), s.b]);
    adj.set(s.b, [...(adj.get(s.b) ?? []), s.a]);
  }
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const v = queue.shift()!;
    if (v === goal) return true;
    for (const n of adj.get(v) ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return false;
}

export function idOfRef(doc: DocJson, ref: string): string {
  const entry = Object.entries(doc.components).find(([, c]) => c.props.ref === ref);
  if (!entry) throw new Error(`No existe ${ref}`);
  return entry[0];
}
