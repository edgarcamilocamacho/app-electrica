/**
 * Barra de tableros y guardado automático [R6 §2, §3, §7, §8], con el backend en memoria de la
 * página (PLAN §24.1).
 */
import { expect, test, type Page } from '@playwright/test';
import { cloudState, newBoard, openApp, place, state, waitIdle } from './helpers';

const items = (page: Page) => page.getByTestId('file-item');
const item = (page: Page, name: string) => page.locator(`[data-testid="file-item"][data-name="${name}"]`);

async function rowAction(page: Page, name: string, action: string): Promise<void> {
  await item(page, name).getByRole('button', { name: `Acciones de ${name}` }).click();
  await page.getByRole('menuitem', { name: action }).click();
}

test.describe('barra de tableros', () => {
  test('arranca con el ejemplo; Nuevo crea un tablero vacío y lo abre', async ({ page }) => {
    await openApp(page);
    await expect(items(page)).toHaveCount(1);
    await expect(item(page, 'Arranque directo')).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('save-status')).toHaveText('Guardado');

    await page.getByTestId('files-new').click();
    await expect(items(page)).toHaveCount(2);
    await waitIdle(page);
    await expect(page.getByTestId('doc-name')).toHaveText('Tablero nuevo');
    await expect(item(page, 'Tablero nuevo')).toHaveAttribute('data-active', 'true');
    // El más reciente va primero.
    await expect(items(page).first()).toHaveAttribute('data-name', 'Tablero nuevo');
  });

  test('desde ejemplo crea una copia del ejemplo en la lista [R6 §9]', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Desde ejemplo' }).click();
    await page.getByRole('menuitem', { name: 'Selector de 3 posiciones' }).click();
    await expect(item(page, 'Selector de 3 posiciones')).toHaveAttribute('data-active', 'true');
  });

  test('buscar filtra la lista por nombre', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('files-new').click();
    await expect(items(page)).toHaveCount(2);
    await page.getByRole('searchbox', { name: 'Buscar tablero' }).fill('arran');
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first()).toHaveAttribute('data-name', 'Arranque directo');
    await page.getByRole('searchbox', { name: 'Buscar tablero' }).fill('nada');
    await expect(page.getByText('Ningún tablero coincide')).toBeVisible();
  });

  test('renombrar desde el menú; un nombre repetido recibe número [R6 §10]', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('files-new').click();
    await expect(items(page)).toHaveCount(2);
    await rowAction(page, 'Tablero nuevo', 'Renombrar');
    const input = page.getByRole('textbox', { name: 'Nombre del tablero' });
    await input.fill('Arranque directo');
    await input.press('Enter');
    await expect(item(page, 'Arranque directo (2)')).toBeVisible();
    await expect(page.getByTestId('doc-name')).toHaveText('Arranque directo (2)');
  });

  test('clonar abre la copia [R6 §7]', async ({ page }) => {
    await openApp(page);
    const devices = await page.evaluate(() => window.__e2e!.state().devices);
    await rowAction(page, 'Arranque directo', 'Clonar');
    await expect(item(page, 'Arranque directo (copia)')).toHaveAttribute('data-active', 'true');
    await waitIdle(page);
    expect(await page.evaluate(() => window.__e2e!.state().devices)).toBe(devices);
  });

  test('a la papelera y de vuelta [R6 §8]', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('files-new').click();
    await expect(items(page)).toHaveCount(2);
    await rowAction(page, 'Arranque directo', 'A la papelera');
    await expect(items(page)).toHaveCount(1);
    const trash = page.getByTestId('files-trash');
    await trash.getByText('Papelera (1)').click();
    await expect(trash).toContainText('Se borra en 30 días');
    await trash.getByRole('button', { name: 'Restaurar' }).click();
    await expect(items(page)).toHaveCount(2);
    await expect(item(page, 'Arranque directo')).toHaveAttribute('data-active', 'true');
  });

  test('la barra se oculta y se vuelve a mostrar', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('files-sidebar')).toBeVisible();
    await page.getByTestId('files-toggle').click();
    await expect(page.getByTestId('files-sidebar')).toHaveCount(0);
    await page.getByTestId('files-toggle').click();
    await expect(page.getByTestId('files-sidebar')).toBeVisible();
  });

  test('cada cambio se guarda solo [R6 §2]', async ({ page }) => {
    await openApp(page);
    await newBoard(page);
    const before = await cloudState(page);
    await place(page, 'pilot-lamp', 20, 20);
    expect((await state(page)).devices).toBe(1);
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', /pending|saving|saved/);
    await page.evaluate(() => window.__e2e!.syncNow());
    await expect(page.getByTestId('save-status')).toHaveText('Guardado');
    expect((await cloudState(page)).save).toBe('saved');
    expect((await cloudState(page)).id).toBe(before.id);
  });
});
