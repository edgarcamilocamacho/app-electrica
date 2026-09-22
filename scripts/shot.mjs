/**
 * Captura del lienzo para revisar el dibujo de los aparatos a ojo.
 * Uso: node scripts/shot.mjs [ejemplo] [salida.png]   (ejemplo: catalogo | arranque | temporizador)
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const example = process.argv[2] ?? 'catalogo';
const out = process.argv[3] ?? '/tmp/claude-1000/shot.png';
/** Referencia a la que acercarse (opcional): recorta ese aparato con margen. */
const focus = process.argv[4];
const port = 5199;
const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(port), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  for (let i = 0; i < 60; i += 1) {
    try {
      await page.goto(`http://localhost:${port}/?e2e=1`, { timeout: 1000 });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  await page.waitForSelector('[data-testid="board-canvas"]');
  await page.evaluate((name) => globalThis.__e2e.loadExample(name), example);
  await page.getByTestId('fit-view').click().catch(() => {});
  await page.waitForTimeout(300);
  const canvas = page.locator('[data-testid="board-canvas"]');
  if (focus) {
    const box = await page.locator(`[data-ref="${focus}"]`).boundingBox();
    const pad = 40;
    await page.screenshot({
      path: out,
      clip: { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad },
    });
  } else {
    await canvas.screenshot({ path: out });
  }
  await browser.close();
  console.log(out);
} finally {
  process.kill(-server.pid);
}
