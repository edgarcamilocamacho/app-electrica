import { expect, test } from '@playwright/test';
import { advance, byRef, centerOf, clickAt, clickRef, loadExample, openApp, place, wire } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

const mode = (page: import('@playwright/test').Page) => page.getByTestId('mode');

test('§18.3: lámpara básica construida desde cero, simular, operar, detener y volver a editar', async ({ page }) => {
  await place(page, 'ac-source', 0, 10);
  await place(page, 'switch-no', 12, 3);
  await place(page, 'lamp', 12, 13);
  await wire(page, [0, 7], [0, -4], [12, -4], [12, 0]);
  await wire(page, [12, 6], [12, 10]);
  await wire(page, [12, 16], [12, 24], [0, 24], [0, 13]);
  await expect(page.getByTestId('diagnostics')).toContainText('Sin problemas');

  await page.getByTestId('toggle-sim').click();
  await expect(mode(page)).toHaveText('SIMULACIÓN');
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'false');
  await clickRef(page, 'S1');
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'true');
  await clickRef(page, 'S1');
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'false');

  // La edición estructural está bloqueada durante la simulación.
  await expect(page.getByTestId('tool-erase')).toBeDisabled();

  await page.getByTestId('toggle-sim').click();
  await expect(mode(page)).toHaveText('EDICIÓN');
  await place(page, 'lamp', 30, 10);
  await expect(page.locator('[data-component-id]')).toHaveCount(4);
});

test('autorretención: el pulsador de marcha sigue a pointer-down / pointer-up y el contactor retiene', async ({ page }) => {
  await loadExample(page, 'seal-in');
  await page.keyboard.press('e');
  await expect(mode(page)).toHaveText('SIMULACIÓN');
  const start = await centerOf(page, 'S3');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect(byRef(page, 'K1')).toHaveAttribute('data-energized', 'true');
  await page.mouse.up();
  await expect(byRef(page, 'K1')).toHaveAttribute('data-energized', 'true');
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'true');
  const stop = await centerOf(page, 'S2');
  await page.mouse.move(stop.x, stop.y);
  await page.mouse.down();
  await expect(byRef(page, 'K1')).toHaveAttribute('data-energized', 'false');
  await page.mouse.up();
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'false');
});

test('parada de emergencia: un clic enclava y corta; otro clic libera', async ({ page }) => {
  await loadExample(page, 'seal-in');
  await page.keyboard.press('e');
  const start = await centerOf(page, 'S3');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'true');
  await clickRef(page, 'S1');
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'false');
  await clickRef(page, 'S1');
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'false'); // no rearranca solo
});

test('temporizador TON: la lámpara enciende al vencer y el valor actual es visible', async ({ page }) => {
  await loadExample(page, 'ton');
  await page.getByTestId('toggle-sim').click();
  await clickRef(page, 'S1');
  await advance(page, 2900);
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'false');
  await expect(byRef(page, 'T1').locator('[data-timer-label]')).toHaveText('2,9 s / 3,0 s');
  await advance(page, 200);
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'true');
  await expect(page.getByTestId('sim-time')).toHaveText('t = 3,1 s');
});

test('temporizador TOF: la lámpara se apaga el tiempo después de abrir', async ({ page }) => {
  await loadExample(page, 'tof');
  await page.getByTestId('toggle-sim').click();
  await clickRef(page, 'S1');
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'true');
  await advance(page, 1000);
  await clickRef(page, 'S1');
  await advance(page, 2900);
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'true');
  await advance(page, 200);
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'false');
});

test('velocidad 4×: el tiempo de simulación avanza cuatro veces más rápido', async ({ page }) => {
  await loadExample(page, 'ton');
  await page.getByTestId('toggle-sim').click();
  await page.getByTestId('speed').selectOption('4');
  await clickRef(page, 'S1');
  await advance(page, 760);
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'true');
});

test('selector de 3 posiciones: el lado del clic elige I, 0 o II', async ({ page }) => {
  await loadExample(page, 'selector');
  await page.getByTestId('toggle-sim').click();
  const c = await centerOf(page, 'S1');
  const box = (await byRef(page, 'S1').locator('g').first().boundingBox())!;
  await page.mouse.click(box.x + 3, c.y);
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'true');
  await page.mouse.click(box.x + box.width - 3, c.y);
  await expect(byRef(page, 'H2')).toHaveAttribute('data-energized', 'true');
  await expect(byRef(page, 'H1')).toHaveAttribute('data-energized', 'false');
});

test('cortocircuito: ERROR congelado, nodo en rojo y salida solo con acción explícita', async ({ page }) => {
  await place(page, 'ac-source', 0, 0);
  await wire(page, [0, -3], [0, -6], [5, -6], [5, 6], [0, 6], [0, 3]);
  await page.getByTestId('toggle-sim').click();
  await expect(mode(page)).toHaveText('ERROR');
  const panel = page.getByTestId('error-panel');
  await expect(panel).toHaveAttribute('data-fault', 'short');
  await expect(panel).toContainText('Cortocircuito');
  // Una <line> vertical tiene caja de ancho cero (Playwright la ve "oculta"): se cuentan.
  await expect(page.locator('line.wire-short')).not.toHaveCount(0);
  await advance(page, 5000);
  await expect(page.getByTestId('error-time')).toContainText('0,0 s');
  await page.keyboard.press('e'); // E no abandona el error
  await expect(mode(page)).toHaveText('ERROR');
  await page.getByTestId('error-back').click();
  await expect(mode(page)).toHaveText('EDICIÓN');
});

test('el ERROR conserva el tiempo transcurrido del temporizador', async ({ page }) => {
  await loadExample(page, 'ton');
  // Rama extra que une fase y neutro al cerrar S2.
  await place(page, 'switch-no', 30, 10);
  await wire(page, [30, -4], [30, 7]);
  await wire(page, [30, 13], [30, 24]);
  await page.getByTestId('toggle-sim').click();
  await clickRef(page, 'S1');
  await advance(page, 1500);
  await clickRef(page, 'S2');
  await expect(mode(page)).toHaveText('ERROR');
  await expect(byRef(page, 'T1').locator('[data-timer-label]')).toHaveText('1,5 s / 3,0 s');
  await advance(page, 4000);
  await expect(byRef(page, 'T1').locator('[data-timer-label]')).toHaveText('1,5 s / 3,0 s');
  await expect(page.getByTestId('error-time')).toContainText('1,5 s');
});

test('oscilación: K1 alimentado por su propio NC entra en ERROR sin colgarse', async ({ page }) => {
  await place(page, 'ac-source', 0, 10);
  await place(page, 'contact-nc', 12, 3);
  await place(page, 'coil', 12, 13);
  await page.keyboard.press('s');
  await clickAt(page, 12, 3);
  await page.getByTestId('prop-link').selectOption('K1');
  await wire(page, [0, 7], [0, -4], [12, -4], [12, 0]);
  await wire(page, [12, 6], [12, 10]);
  await wire(page, [12, 16], [12, 24], [0, 24], [0, 13]);
  await page.getByTestId('toggle-sim').click();
  await expect(mode(page)).toHaveText('ERROR');
  await expect(page.getByTestId('error-panel')).toHaveAttribute('data-fault', 'oscillation');
  await expect(page.getByTestId('error-panel')).toContainText('K1');
});

test('un diagnóstico bloqueante impide simular y se ve en el panel', async ({ page }) => {
  await place(page, 'contact-no', 0, 0);
  await page.getByTestId('toggle-sim').click();
  await expect(mode(page)).toHaveText('EDICIÓN');
  await expect(page.getByTestId('status-message')).toContainText('No se puede simular');
  await expect(page.locator('[data-severity="blocking"][data-code="REF_BROKEN"]')).toBeVisible();
});

test('un solapamiento importado se marca y bloquea la simulación', async ({ page }) => {
  const json = JSON.stringify({
    schemaVersion: 1,
    metadata: { name: 'solape', createdAt: '', modifiedAt: '' },
    components: {},
    vertices: {
      a: { kind: 'point', position: { x: 0, y: 0 } },
      b: { kind: 'point', position: { x: 10, y: 0 } },
      c: { kind: 'point', position: { x: 5, y: 0 } },
      d: { kind: 'point', position: { x: 15, y: 0 } },
    },
    segments: { s1: { a: 'a', b: 'b' }, s2: { a: 'c', b: 'd' } },
    annotations: {},
  });
  await page.evaluate((text) => window.__e2e!.loadJson(text), json);
  await expect(page.locator('[data-code="OVERLAP"]')).toBeVisible();
  await expect(page.locator('[data-marker]').first()).toBeVisible();
  await page.getByTestId('toggle-sim').click();
  await expect(mode(page)).toHaveText('EDICIÓN');
});
