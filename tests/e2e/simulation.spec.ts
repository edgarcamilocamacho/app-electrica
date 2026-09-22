import { expect, test } from '@playwright/test';
import { advance, device, openApp, state } from './helpers';

test.describe('simulación del tablero', () => {
  test('el ejemplo arranca, retiene con el pulsador y enciende el piloto', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('simulate').click();
    await expect(page.getByTestId('mode')).toHaveText('SIMULACIÓN');
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'false');

    // Mantener apretado S1 (marcha) y soltarlo: el contactor queda retenido.
    const s1 = await device(page, 'S1').boundingBox();
    await page.mouse.move(s1!.x + s1!.width / 2, s1!.y + s1!.height / 2);
    await page.mouse.down();
    await expect(device(page, 'K1')).toHaveAttribute('data-energized', 'true');
    await page.mouse.up();
    await expect(device(page, 'K1')).toHaveAttribute('data-energized', 'true');
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'true');

    // Paro: todo se cae.
    const s0 = await device(page, 'S0').boundingBox();
    await page.mouse.move(s0!.x + s0!.width / 2, s0!.y + s0!.height / 2);
    await page.mouse.down();
    await expect(device(page, 'K1')).toHaveAttribute('data-energized', 'false');
    await page.mouse.up();
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'false');
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
    // Circuito mínimo con TON cargado por JSON, para no depender del ejemplo.
    const json = JSON.stringify({
      schemaVersion: 2,
      metadata: { name: 'TON', createdAt: '2026-01-01T00:00:00.000Z', modifiedAt: '2026-01-01T00:00:00.000Z' },
      devices: {
        d1: { type: 'supply-1p', position: { x: 10, y: 10 }, props: { ref: 'G1', label: '' } },
        d2: { type: 'timer-ton', position: { x: 10, y: 44 }, props: { ref: 'T1', label: '', presetMs: 2000 } },
        d3: { type: 'pilot-lamp', position: { x: 46, y: 44 }, props: { ref: 'H1', label: '', color: 'green' } },
      },
      wires: {
        w1: {
          a: { deviceId: 'd1', terminalId: 'L' },
          b: { deviceId: 'd2', terminalId: '7' },
          bends: [{ x: 8, y: 24 }, { x: 4, y: 24 }],
          color: 'red',
          gauge: 1,
        },
        w2: {
          a: { deviceId: 'd2', terminalId: '2' },
          b: { deviceId: 'd1', terminalId: 'N' },
          bends: [{ x: 4, y: 58 }, { x: 24, y: 58 }, { x: 24, y: 20 }, { x: 12, y: 20 }],
          color: 'blue',
          gauge: 1,
        },
        w3: {
          a: { deviceId: 'd1', terminalId: 'L' },
          b: { deviceId: 'd2', terminalId: '8' },
          bends: [{ x: 8, y: 26 }, { x: 12, y: 26 }],
          color: 'red',
          gauge: 1,
        },
        w4: {
          a: { deviceId: 'd2', terminalId: '6' },
          b: { deviceId: 'd3', terminalId: 'X1' },
          bends: [{ x: 8, y: 30 }, { x: 46, y: 30 }],
          color: 'red',
          gauge: 1,
        },
        w5: {
          a: { deviceId: 'd3', terminalId: 'X2' },
          b: { deviceId: 'd1', terminalId: 'N' },
          bends: [{ x: 46, y: 62 }, { x: 28, y: 62 }, { x: 28, y: 20 }, { x: 12, y: 20 }],
          color: 'blue',
          gauge: 1,
        },
      },
      annotations: {},
    });
    const loaded = await page.evaluate((text) => window.__e2e!.loadJson(text), json);
    expect(loaded).toBe(true);

    await page.getByTestId('simulate').click();
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'false');
    await advance(page, 1900);
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'false');
    await advance(page, 200);
    await expect(device(page, 'H1')).toHaveAttribute('data-energized', 'true');
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
          bends: [{ x: 8, y: 26 }, { x: 12, y: 26 }],
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
