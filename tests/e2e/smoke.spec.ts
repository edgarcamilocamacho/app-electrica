import { expect, test } from '@playwright/test';

test('la app carga en español', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Simulador de control eléctrico');
});

test('version.json expone el build', async ({ request }) => {
  const res = await request.get('/version.json');
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { buildId: string };
  expect(body.buildId.length).toBeGreaterThan(0);
});
