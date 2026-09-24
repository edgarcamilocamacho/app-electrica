import { expect, test } from '@playwright/test';
import { advance, device, openApp, state } from './helpers';

test.describe('simulación del tablero', () => {
  test('el ejemplo arranca, retiene con el pulsador y enciende el piloto', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('simulate').click();
    await expect(page.getByTestId('mode')).toHaveText('SIMULACIÓN');
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'false');
    // En reposo, del contactor solo tiene tensión el polo de potencia que viene de la acometida [R7 §4].
    await expect(device(page, 'K1')).not.toHaveAttribute('data-lit', /A1/);

    // Mantener apretado S1 (marcha) y soltarlo: el contactor queda retenido.
    const s1 = await device(page, 'S1').boundingBox();
    await page.mouse.move(s1!.x + s1!.width / 2, s1!.y + s1!.height / 2);
    await page.mouse.down();
    await expect(device(page, 'K1')).toHaveAttribute('data-energized', 'true');
    await page.mouse.up();
    await expect(device(page, 'K1')).toHaveAttribute('data-energized', 'true');
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'true');
    // Retenido: la bobina y el contacto de retención se iluminan del color de sus cables.
    await expect(device(page, 'K1')).toHaveAttribute('data-lit', /\bA1\b.*\bA2\b/);
    await expect(device(page, 'K1')).toHaveAttribute('data-lit', /\b13\b.*\b14\b/);

    // Paro: todo se cae.
    const s0 = await device(page, 'S0').boundingBox();
    await page.mouse.move(s0!.x + s0!.width / 2, s0!.y + s0!.height / 2);
    await page.mouse.down();
    await expect(device(page, 'K1')).toHaveAttribute('data-energized', 'false');
    await page.mouse.up();
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'false');
    await expect(device(page, 'K1')).not.toHaveAttribute('data-lit', /A1/);

    // Al detener, no queda nada iluminado.
    await page.getByTestId('stop').click();
    await expect(device(page, 'K1')).toHaveAttribute('data-lit', '');
  });

  test('durante la simulación no se puede editar', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('simulate').click();
    await expect(page.getByTestId('library-pilot-lamp')).toBeDisabled();
    await expect(page.getByTestId('tool-erase')).toBeDisabled();
  });

  test('detener vuelve a edición', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('simulate').click();
    await page.getByTestId('stop').click();
    await expect(page.getByTestId('mode')).toHaveText('EDICIÓN');
    expect((await state(page)).mode).toBe('edit');
  });

  test('el tiempo avanza sin sleep y el temporizador cumple su preset', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__e2e!.loadExample('temporizador'));
    await page.getByTestId('simulate').click();
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'false');

    // S1 es un interruptor mantenido: un clic lo cierra y arranca la cuenta del TON.
    const s1 = await device(page, 'S1').boundingBox();
    await page.mouse.click(s1!.x + s1!.width / 2, s1!.y + s1!.height / 2);
    await advance(page, 4900);
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'false');
    await advance(page, 200);
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'true');
  });

  test('cada clic pasa el selector a la siguiente posición [R5 §23]', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => window.__e2e!.loadExample('selector'));
    await page.getByTestId('simulate').click();
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'false');
    await expect(device(page, 'H2')).toHaveAttribute('data-energized', 'false');

    const click = async (): Promise<void> => {
      const box = await device(page, 'S1').boundingBox();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    };

    // Arranca en 0: I y II se alcanzan con uno y dos clics; el tercero vuelve a apagar todo.
    await click();
    await expect(device(page, 'H2')).toHaveAttribute('data-energized', 'true');
    await click();
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'true');
    await expect(device(page, 'H2')).toHaveAttribute('data-energized', 'false');
    await click();
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'false');
  });

  test('un corto congela todo en ERROR y solo se sale volviendo a editar', async ({ page }) => {
    await openApp(page);
    const json = JSON.stringify({
      schemaVersion: 2,
      metadata: { name: 'Corto', createdAt: '2026-01-01T00:00:00.000Z', modifiedAt: '2026-01-01T00:00:00.000Z' },
      devices: { d1: { type: 'supply-1p', position: { x: 10, y: 10 }, props: { ref: 'G1', label: '' } } },
      wires: {
        w1: {
          a: { deviceId: 'd1', terminalId: 'L' },
          b: { deviceId: 'd1', terminalId: 'N' },
          bends: [{ x: 12, y: 26 }, { x: 8, y: 26 }],
          color: 'red',
          gauge: 1,
        },
      },
      annotations: {},
    });
    await page.evaluate((text) => window.__e2e!.loadJson(text), json);
    await page.getByTestId('simulate').click();
    await expect(page.getByTestId('error-panel')).toBeVisible();
    await expect(page.getByTestId('mode')).toHaveText('ERROR');
    await page.getByRole('button', { name: 'Volver a editar' }).click();
    await expect(page.getByTestId('mode')).toHaveText('EDICIÓN');
  });
});
