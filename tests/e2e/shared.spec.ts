/**
 * Dos personas sobre el mismo tablero, contra la API real de `pnpm preview` [R6 §5, §6].
 *
 * El servidor es compartido por todas las pruebas: cada una crea su propio tablero con un nombre
 * único y lo deja como «último abierto» en el navegador de cada persona, para que ninguna página
 * de otra prueba lo abra.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { newBoard, openApp, place, state, waitIdle } from './helpers';

const API = { 'X-Simulador': '1', 'Content-Type': 'application/json' };

async function person(browser: Browser, name: string, docId: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ([nick, id]) => {
      localStorage.setItem('simulador:apodo', nick!);
      localStorage.setItem('simulador:ultimo', id!);
    },
    [name, docId],
  );
  const page = await context.newPage();
  await openApp(page, '&backend=server');
  return page;
}

const sync = (page: Page) => page.evaluate(() => window.__e2e!.syncNow());

test.describe('tablero compartido', () => {
  test('uno edita, el otro mira en vivo y toma la edición al instante', async ({ browser, request, page }, info) => {
    // Un tablero propio de esta prueba, vacío.
    await openApp(page);
    await newBoard(page);
    const content = await page.evaluate(() => window.__e2e!.documentJson());
    const name = `Compartido ${info.project.name} ${Date.now()}`;
    const created = await request.post('/api/docs', { headers: API, data: { name, content } });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const ana = await person(browser, 'Ana', id);
    await expect(ana.getByTestId('doc-name')).toHaveText(name);
    await expect(ana.getByTestId('save-status')).toHaveText('Guardado');

    const beto = await person(browser, 'Beto', id);
    await expect(beto.getByTestId('doc-name')).toHaveText(name);
    await expect(beto.getByTestId('cloud-banner')).toContainText('Ana está editando este tablero.');
    await expect(beto.getByTestId('tool-wire')).toBeDisabled();
    await expect(beto.locator(`[data-testid="file-item"][data-name="${name}"]`)).toContainText('Ana está editando');

    // Ana agrega una acometida y un piloto; Beto los ve sin recargar.
    await place(ana, 'supply-1p', 10, 10);
    await place(ana, 'pilot-lamp', 30, 20);
    await expect.poll(async () => (await state(ana)).devices).toBe(2);
    await sync(ana);
    await expect(ana.getByTestId('save-status')).toHaveText('Guardado');
    await sync(beto);
    await expect.poll(async () => (await state(beto)).devices).toBe(2);

    // En solo lectura se puede simular.
    await beto.getByTestId('simulate').click();
    await expect(beto.getByTestId('mode')).toHaveText('SIMULACIÓN');
    await beto.getByTestId('stop').click();
    await expect(beto.getByTestId('mode')).toHaveText('EDICIÓN');

    // Beto toma la edición; Ana pasa a solo lectura y se entera.
    await beto.getByTestId('take-edit').click();
    await waitIdle(beto);
    await expect(beto.getByTestId('cloud-banner')).toHaveCount(0);
    await expect(beto.getByTestId('tool-wire')).toBeEnabled();
    await sync(ana);
    await expect(ana.getByTestId('cloud-banner')).toContainText('Beto está editando este tablero.');
    await expect(ana.getByTestId('cloud-notice')).toContainText('Beto tomó la edición');
    await expect(ana.getByTestId('tool-wire')).toBeDisabled();

    await ana.context().close();
    await beto.context().close();
  });
});
