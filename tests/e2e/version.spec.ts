import { expect, test } from '@playwright/test';

test('una versión nueva desplegada se detecta y se ofrece recargar (spec §3.3)', async ({ page, request }) => {
  // El build real (dev, preview o contenedor) es el "actual"; después se simula un despliegue nuevo.
  let served = ((await (await request.get('/version.json')).json()) as { buildId: string }).buildId;
  await page.route('**/version.json*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ buildId: served }) }),
  );
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => !!window.__e2e);
  await expect(page.getByTestId('toast')).toHaveCount(0);

  served = 'build-nuevo';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('toast')).toContainText('Hay una versión nueva');

  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Recargar' }).click();
  await reloaded;
});

test('version.json se pide sin caché', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('version.json')) requests.push(r.url());
  });
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => !!window.__e2e);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0]).toMatch(/version\.json\?t=\d+/);
});
