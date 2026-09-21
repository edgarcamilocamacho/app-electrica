#!/usr/bin/env node
/* global window -- se usa dentro de callbacks de page.evaluate, que corren en el navegador */
/**
 * Prueba de humo sobre la imagen real (PLAN §16.3):
 *   1. construye la imagen con un BUILD_ID;
 *   2. la levanta en un puerto libre;
 *   3. verifica /healthz, el version.json y la política de caché por ruta;
 *   4. opcionalmente corre E2E contra el contenedor (--e2e);
 *   5. opcionalmente (--upgrade) reemplaza el contenedor por otro build con la página abierta y
 *      verifica que el cliente detecta la versión nueva y, al recargar, carga los assets nuevos.
 *
 * Uso: node scripts/docker-smoke.mjs [--skip-build] [--e2e] [--upgrade] [--keep]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

const args = new Set(process.argv.slice(2));
const image = process.env.SMOKE_IMAGE ?? 'simulador-control-electrico:smoke';
const buildId = process.env.BUILD_ID ?? `smoke-${Date.now().toString(36)}`;

function sh(cmd, cmdArgs, opts = {}) {
  return execFileSync(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...opts }).trim();
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitFor(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* todavía arrancando */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Tiempo agotado esperando ${url}`);
}

const failures = [];
function check(condition, message) {
  if (condition) console.log(`  ✓ ${message}`);
  else {
    console.log(`  ✗ ${message}`);
    failures.push(message);
  }
}

if (!args.has('--skip-build')) {
  console.log(`Construyendo ${image} (BUILD_ID=${buildId})…`);
  execFileSync('docker', ['build', '--build-arg', `BUILD_ID=${buildId}`, '-t', image, '.'], { stdio: 'inherit' });
}

const port = await freePort();
const container = sh('docker', ['run', '-d', '--rm', '-p', `${port}:8080`, image]);
const base = `http://127.0.0.1:${port}`;
console.log(`Contenedor ${container.slice(0, 12)} en ${base}`);

try {
  await waitFor(`${base}/healthz`);

  const health = await fetch(`${base}/healthz`);
  check(health.status === 200, '/healthz responde 200');

  const version = await fetch(`${base}/version.json`);
  const versionBody = await version.json();
  check(version.headers.get('cache-control') === 'no-store', '/version.json con Cache-Control: no-store');
  if (!args.has('--skip-build')) check(versionBody.buildId === buildId, `version.json trae el BUILD_ID (${buildId})`);

  const index = await fetch(`${base}/`);
  const html = await index.text();
  check(index.headers.get('cache-control') === 'no-store', '/ con Cache-Control: no-store');
  check((index.headers.get('content-security-policy') ?? '').includes("default-src 'self'"), 'CSP estricta presente');
  check(index.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');

  const assetMatch = html.match(/\/assets\/[^"']+\.js/);
  check(!!assetMatch, 'index.html referencia un asset con hash');
  if (assetMatch) {
    const asset = await fetch(`${base}${assetMatch[0]}`);
    check(asset.status === 200, `${assetMatch[0]} responde 200`);
    check(
      (asset.headers.get('cache-control') ?? '').includes('immutable'),
      'assets con Cache-Control inmutable',
    );
  }

  const missingAsset = await fetch(`${base}/assets/no-existe.js`);
  check(missingAsset.status === 404, 'asset inexistente responde 404 (no cae en index.html)');

  if (args.has('--e2e')) {
    console.log('Corriendo E2E contra el contenedor…');
    const result = spawnSync('pnpm', ['exec', 'playwright', 'test', '--project=chromium'], {
      stdio: 'inherit',
      env: { ...process.env, E2E_BASE_URL: base },
    });
    check(result.status === 0, 'E2E contra el contenedor');
  }
} finally {
  if (!args.has('--keep')) sh('docker', ['stop', container]);
}

if (args.has('--upgrade')) {
  console.log('Actualización en caliente: reemplazar el contenedor por otro build…');
  const upgradeId = `${buildId}-v2`;
  const upgradeImage = `${image}-v2`;
  execFileSync('docker', ['build', '--build-arg', `BUILD_ID=${upgradeId}`, '-t', upgradeImage, '.'], { stdio: 'inherit' });
  const upPort = await freePort();
  const upBase = `http://127.0.0.1:${upPort}`;
  const { chromium } = await import('@playwright/test');
  let first = sh('docker', ['run', '-d', '--rm', '-p', `${upPort}:8080`, image]);
  let second;
  const browser = await chromium.launch();
  try {
    await waitFor(`${upBase}/healthz`);
    const page = await browser.newPage();
    await page.goto(`${upBase}/?e2e=1`);
    await page.waitForFunction(() => !!window.__e2e);
    const scriptBefore = await page.locator('script[type="module"]').getAttribute('src');
    sh('docker', ['stop', first]);
    first = undefined;
    second = sh('docker', ['run', '-d', '--rm', '-p', `${upPort}:8080`, upgradeImage]);
    await waitFor(`${upBase}/healthz`);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByText('Hay una versión nueva').waitFor({ timeout: 10_000 });
    check(true, 'el cliente abierto detecta el build nuevo');
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Recargar' }).click()]);
    const scriptAfter = await page.locator('script[type="module"]').getAttribute('src');
    check(!!scriptBefore && !!scriptAfter && scriptBefore !== scriptAfter, `tras recargar se cargan los assets nuevos (${scriptAfter})`);
    const served = await (await fetch(`${upBase}/version.json`)).json();
    check(served.buildId === upgradeId, `el servidor sirve el build nuevo (${upgradeId})`);
  } catch (e) {
    check(false, `actualización en caliente: ${e instanceof Error ? e.message : e}`);
  } finally {
    await browser.close();
    if (first) sh('docker', ['stop', first]);
    if (second) sh('docker', ['stop', second]);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} verificación(es) fallaron.`);
  process.exit(1);
}
console.log('\nHumo del contenedor: todo OK.');
