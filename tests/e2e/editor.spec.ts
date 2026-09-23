import { expect, test } from '@playwright/test';
import { clickAt, dragAt, newBoard, openApp, place, state, wire } from './helpers';

test.describe('edición del tablero', () => {
  test('coloca aparatos desde la biblioteca', async ({ page }) => {
    await openApp(page);
    await newBoard(page);
    expect((await state(page)).devices).toBe(0);
    await place(page, 'supply-1p', 10, 10);
    await place(page, 'pilot-lamp', 10, 46);
    expect((await state(page)).devices).toBe(2);
  });

  test('un cable une dos bornes y la goma lo borra entero', async ({ page }) => {
    await openApp(page);
    await newBoard(page);
    await place(page, 'supply-1p', 10, 10);
    await place(page, 'pilot-lamp', 10, 46);
    await wire(page, [8, 17], [10, 39]); // L de la acometida → X1 del piloto
    expect((await state(page)).wires).toBe(1);

    await page.getByTestId('tool-erase').click();
    await clickAt(page, 10, 30);
    expect((await state(page)).wires).toBe(0);
    expect((await state(page)).devices).toBe(2);
  });

  test('girar con R rueda el aparato y el cable lo sigue [R5 §19]', async ({ page }) => {
    await openApp(page);
    await newBoard(page);
    await place(page, 'supply-1p', 10, 10);
    await place(page, 'pilot-lamp', 10, 46);
    await wire(page, [8, 17], [10, 39]); // L de la acometida → X1 del piloto

    await page.getByTestId('tool-select').click();
    await clickAt(page, 10, 46);
    await page.keyboard.press('r');

    const lamp = page.locator('[data-device][data-ref=""]').last();
    await expect(page.locator('[data-rotation="90"]')).toHaveCount(1);
    expect((await state(page)).wires).toBe(1);
    await expect(lamp).toBeVisible();
  });

  test('borrar un aparato borra sus cables', async ({ page }) => {
    await openApp(page);
    await newBoard(page);
    await place(page, 'supply-1p', 10, 10);
    await place(page, 'pilot-lamp', 10, 46);
    await wire(page, [8, 17], [10, 39]);
    await page.getByTestId('tool-erase').click();
    await clickAt(page, 10, 46);
    const after = await state(page);
    expect(after.devices).toBe(1);
    expect(after.wires).toBe(0);
  });

  test('deshacer y rehacer devuelven el documento', async ({ page }) => {
    await openApp(page);
    await newBoard(page);
    await place(page, 'supply-1p', 10, 10);
    expect((await state(page)).devices).toBe(1);
    await page.keyboard.press('Control+z');
    expect((await state(page)).devices).toBe(0);
    await page.keyboard.press('Control+y');
    expect((await state(page)).devices).toBe(1);
  });

  test('no se puede colocar un aparato encima de otro', async ({ page }) => {
    await openApp(page);
    await newBoard(page);
    await place(page, 'pilot-lamp', 10, 10);
    await place(page, 'pilot-lamp', 12, 10);
    expect((await state(page)).devices).toBe(1);
  });

  test('mover un aparato conserva su cable', async ({ page }) => {
    await openApp(page);
    await newBoard(page);
    await place(page, 'supply-1p', 10, 10);
    await place(page, 'pilot-lamp', 10, 46);
    await wire(page, [8, 17], [10, 39]);
    await clickAt(page, 10, 46);
    await dragAt(page, [10, 46], [26, 46]);
    const after = await state(page);
    expect(after.devices).toBe(2);
    expect(after.wires).toBe(1);
    const json = await page.evaluate(() => window.__e2e!.documentJson());
    expect(json).toContain('"x": 26');
  });
});
