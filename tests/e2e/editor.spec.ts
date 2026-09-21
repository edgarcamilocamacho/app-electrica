import { expect, test } from '@playwright/test';
import { byRef, centerOf, clickAt, clickRef, connected, docJson, hoverAt, idOfRef, openApp, place, wire } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('colocar: el componente sigue al cursor, R rota antes de colocar, se repite y Esc termina', async ({ page }) => {
  await page.getByTestId('library-lamp').click();
  await hoverAt(page, 10, 10);
  await page.keyboard.press('r');
  await clickAt(page, 10, 10);
  await clickAt(page, 20, 10);
  await expect(page.getByTestId('canvas')).toHaveAttribute('data-tool', 'place');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('canvas')).toHaveAttribute('data-tool', 'select');
  const doc = await docJson(page);
  const lamps = Object.values(doc.components);
  expect(lamps).toHaveLength(2);
  expect(lamps.every((c) => c.rotation === 90)).toBe(true);
  expect(lamps.map((c) => c.props.ref).sort()).toEqual(['H1', 'H2']);
});

test('cable: derivar desde un cable crea un punto de unión; los cruces no conectan', async ({ page }) => {
  await wire(page, [0, 0], [20, 0]);
  await wire(page, [10, -6], [10, 6]); // cruce perpendicular
  await expect(page.locator('[data-vertex-class="junction"]')).toHaveCount(0);
  await wire(page, [4, 0], [4, 8]); // arranca en el medio del primer cable
  await expect(page.locator('[data-vertex-class="junction"]')).toHaveCount(1);
  const doc = await docJson(page);
  expect(Object.keys(doc.segments)).toHaveLength(4);
});

test('cable terminado en el vacío deja extremos libres visibles', async ({ page }) => {
  await wire(page, [0, 0], [0, 8]);
  await expect(page.locator('[data-vertex-class="free-end"]')).toHaveCount(2);
});

test('Mover (M): clic toma, clic suelta, y la conexión se conserva', async ({ page }) => {
  await place(page, 'coil', 10, -5);
  await place(page, 'lamp', 10, 5);
  await wire(page, [10, -2], [10, 2]);
  await page.keyboard.press('m');
  await clickRef(page, 'H1');
  await hoverAt(page, 14, 7);
  await hoverAt(page, 16, 9);
  await clickAt(page, 16, 9);
  const doc = await docJson(page);
  const lamp = doc.components[idOfRef(doc, 'H1')]!;
  expect(lamp.position).toEqual({ x: 16, y: 9 });
  expect(connected(doc, [idOfRef(doc, 'K1'), 'A2'], [idOfRef(doc, 'H1'), 'X1'])).toBe(true);
});

test('Mover: una posición inválida no suelta y muestra el motivo; Esc devuelve todo', async ({ page }) => {
  await place(page, 'coil', 10, -5);
  await place(page, 'lamp', 10, 5);
  await wire(page, [10, -2], [10, 2]);
  await wire(page, [0, 20], [30, 20]);
  const before = await docJson(page);
  await page.keyboard.press('m');
  await clickRef(page, 'H1');
  await hoverAt(page, 10, 23); // X1 (ya conectado) caería sobre otra red
  await clickAt(page, 10, 23);
  await expect(page.getByTestId('status-message')).toContainText('Posición inválida');
  await page.keyboard.press('Escape');
  expect(await docJson(page)).toEqual(before);
});

test('Mover un tramo: solo se desplaza en perpendicular', async ({ page }) => {
  await wire(page, [0, 0], [10, 0], [10, 6]);
  await page.keyboard.press('m');
  await clickAt(page, 5, 0);
  await hoverAt(page, 9, -3);
  await clickAt(page, 9, -3);
  const doc = await docJson(page);
  const ys = Object.values(doc.vertices).filter((v) => v.kind === 'point').map((v) => v.position!.y).sort((a, b) => a - b);
  expect(ys).toEqual([-3, -3, 6]);
});

test('soltar un interruptor sobre un cable lo inserta en serie', async ({ page }) => {
  await wire(page, [0, 0], [0, 20]);
  await place(page, 'switch-no', 0, 10);
  const doc = await docJson(page);
  expect(Object.keys(doc.segments)).toHaveLength(2);
  expect(connected(doc, [idOfRef(doc, 'S1'), '13'], [idOfRef(doc, 'S1'), '14'])).toBe(false);
});

test('Borrar (B): cada clic es una acción y Ctrl+Z restaura solo el último', async ({ page }) => {
  for (const x of [0, 10, 20, 30]) await place(page, 'lamp', x, 0);
  await page.keyboard.press('b');
  for (const ref of ['H1', 'H2', 'H3', 'H4']) await clickRef(page, ref);
  await expect(page.locator('[data-component-id]')).toHaveCount(0);
  await expect(page.getByTestId('canvas')).toHaveAttribute('data-tool', 'erase');
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-component-id]')).toHaveCount(1);
  await expect(byRef(page, 'H4')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-component-id]')).toHaveCount(2);
});

test('borrar un componente deja sus cables con extremos libres', async ({ page }) => {
  await place(page, 'lamp', 0, 0);
  await wire(page, [0, 3], [0, 9]);
  await page.keyboard.press('b');
  await clickRef(page, 'H1');
  await expect(page.locator('[data-component-id]')).toHaveCount(0);
  await expect(page.locator('[data-vertex-class="free-end"]')).toHaveCount(2);
});

test('selección con rectángulo y Supr: una sola acción de deshacer', async ({ page }) => {
  await place(page, 'lamp', 0, 0);
  await place(page, 'lamp', 8, 0);
  await page.keyboard.press('s');
  const a = await (await import('./helpers')).toScreen(page, -5, -6);
  const b = await (await import('./helpers')).toScreen(page, 12, 6);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-component-id]')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-component-id]')).toHaveCount(2);
});

test('rotar un componente seleccionado con R', async ({ page }) => {
  await place(page, 'coil', 0, 0);
  await page.keyboard.press('s');
  await clickRef(page, 'K1');
  await page.keyboard.press('r');
  const doc = await docJson(page);
  expect(Object.values(doc.components)[0]!.rotation).toBe(90);
});

test('copiar/pegar y duplicar renumeran referencias', async ({ page }) => {
  await place(page, 'coil', 0, 0);
  await page.keyboard.press('s');
  await clickRef(page, 'K1');
  await page.keyboard.press('Control+c');
  await hoverAt(page, 12, 0);
  await page.keyboard.press('Control+v');
  await clickAt(page, 12, 0);
  await page.keyboard.press('s');
  await clickRef(page, 'K2');
  await hoverAt(page, 24, 0);
  await page.keyboard.press('Control+d');
  await clickAt(page, 24, 0);
  const refs = Object.values((await docJson(page)).components).map((c) => c.props.ref).sort();
  expect(refs).toEqual(['K1', 'K2', 'K3']);
});

test('texto libre: se crea con T y se edita en el panel de propiedades', async ({ page }) => {
  await page.keyboard.press('t');
  await clickAt(page, 0, -10);
  const field = page.getByTestId('prop-text');
  await expect(field).toBeFocused();
  await field.fill('Circuito de mando');
  await expect(page.locator('[data-annotation-id]')).toHaveText('Circuito de mando');
});

test('propiedades: vincular un contacto a una bobina le asigna la referencia derivada', async ({ page }) => {
  await place(page, 'coil', 0, 0);
  await place(page, 'contact-no', 10, 0);
  await page.keyboard.press('s');
  await clickAt(page, 10, 0);
  await page.getByTestId('prop-link').selectOption('K1');
  await expect(byRef(page, 'K1.1')).toHaveCount(1);
});

test('atajos de herramientas en español: S, C, M, B, T', async ({ page }) => {
  const canvas = page.getByTestId('canvas');
  for (const [key, tool] of [['c', 'wire'], ['m', 'move'], ['b', 'erase'], ['t', 'text'], ['s', 'select']] as const) {
    await page.keyboard.press(key);
    await expect(canvas).toHaveAttribute('data-tool', tool);
  }
});

test('deshacer y rehacer desde la barra', async ({ page }) => {
  await place(page, 'lamp', 0, 0);
  await page.getByTestId('undo').click();
  await expect(page.locator('[data-component-id]')).toHaveCount(0);
  await page.getByTestId('redo').click();
  await expect(page.locator('[data-component-id]')).toHaveCount(1);
});

test('pan y zoom: la rueda cambia el zoom y la vista se ajusta al diagrama', async ({ page }) => {
  await place(page, 'lamp', 0, 0);
  const before = await page.evaluate(() => window.__e2e!.state().zoom);
  const c = await centerOf(page, 'H1');
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, -400);
  const after = await page.evaluate(() => window.__e2e!.state().zoom);
  expect(after).toBeGreaterThan(before);
  await page.getByTestId('fit-view').click();
  await expect(byRef(page, 'H1')).toBeInViewport();
});
