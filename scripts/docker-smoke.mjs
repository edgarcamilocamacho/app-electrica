#!/usr/bin/env node
/* global window -- se usa dentro de callbacks de page.evaluate, que corren en el navegador */
/**
 * Prueba de humo sobre los contenedores reales (PLAN §16.3, §24.6), con `compose.yaml` en un
 * proyecto aparte (`simulador-humo`) que se borra al terminar, volumen incluido:
 *   1. construye las imágenes con un BUILD_ID y levanta web + api en un puerto libre;
 *   2. verifica /healthz, version.json, la política de caché y las cabeceras de seguridad;
 *   3. verifica la API a través de nginx: cabecera propia, origen, Content-Type y tamaño;
 *   4. verifica el endurecimiento: usuarios sin root, solo lectura, API sin salida a internet;
 *   5. verifica que un tablero sobrevive a reconstruir y recrear los contenedores [R6 §13];
 *   6. opcionalmente corre E2E contra los contenedores (--e2e);
 *   7. opcionalmente (--upgrade) cambia el build con la página abierta y verifica que el cliente
 *      lo detecta, recarga los assets nuevos y conserva el tablero.
 *
 * Uso: node scripts/docker-smoke.mjs [--e2e] [--upgrade] [--keep]
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

const args = new Set(process.argv.slice(2));
const project = process.env.SMOKE_PROJECT ?? 'simulador-humo';
const buildId = process.env.BUILD_ID ?? `humo-${Date.now().toString(36)}`;

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

const port = await freePort();
const base = `http://127.0.0.1:${port}`;

function compose(composeArgs, { env = {}, quiet = false, allowFail = false } = {}) {
  const result = spawnSync('docker', ['compose', '-p', project, ...composeArgs], {
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    env: { ...process.env, SIMULADOR_PUERTO: String(port), BUILD_ID: buildId, ...env },
  });
  if (result.status !== 0 && !allowFail) throw new Error(`docker compose ${composeArgs.join(' ')} falló`);
  return { status: result.status, out: (result.stdout ?? '').trim(), err: (result.stderr ?? '').trim() };
}

const exec = (service, command, opts) => compose(['exec', '-T', service, ...command], { quiet: true, allowFail: true, ...opts });

async function waitFor(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { headers: { 'X-Simulador': '1' } });
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

const API = { 'X-Simulador': '1', 'Content-Type': 'application/json' };
const EMPTY_BOARD = JSON.stringify({
  schemaVersion: 2,
  metadata: { name: 'Humo', createdAt: '2026-01-01T00:00:00.000Z', modifiedAt: '2026-01-01T00:00:00.000Z' },
  devices: {},
  wires: {},
  annotations: {},
});

async function api(method, path, body, headers = API) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* no JSON */
  }
  return { status: res.status, headers: res.headers, json };
}

console.log(`Construyendo y levantando ${project} (BUILD_ID=${buildId}) en ${base}…`);
compose(['down', '-v', '--remove-orphans'], { quiet: true, allowFail: true });
compose(['up', '-d', '--build']);

try {
  await waitFor(`${base}/api/docs`);

  console.log('Estáticos y cabeceras');
  const health = await fetch(`${base}/healthz`);
  check(health.status === 200, '/healthz responde 200');

  const version = await fetch(`${base}/version.json`);
  const versionBody = await version.json();
  check(version.headers.get('cache-control') === 'no-store', '/version.json con Cache-Control: no-store');
  check(versionBody.buildId === buildId, `version.json trae el BUILD_ID (${buildId})`);

  const index = await fetch(`${base}/`);
  const html = await index.text();
  check(index.headers.get('cache-control') === 'no-store', '/ con Cache-Control: no-store');
  check((index.headers.get('content-security-policy') ?? '').includes("default-src 'self'"), 'CSP estricta presente');
  check(index.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');
  check(index.headers.get('server') === 'nginx', 'nginx no anuncia su versión');

  const assetMatch = html.match(/\/assets\/[^"']+\.js/);
  check(!!assetMatch, 'index.html referencia un asset con hash');
  if (assetMatch) {
    const asset = await fetch(`${base}${assetMatch[0]}`);
    check(asset.status === 200, `${assetMatch[0]} responde 200`);
    check((asset.headers.get('cache-control') ?? '').includes('immutable'), 'assets con Cache-Control inmutable');
  }
  const missingAsset = await fetch(`${base}/assets/no-existe.js`);
  check(missingAsset.status === 404, 'asset inexistente responde 404 (no cae en index.html)');
  const postStatic = await fetch(`${base}/`, { method: 'POST' });
  check(postStatic.status === 403, 'POST a los estáticos se rechaza');

  console.log('API a través de nginx');
  const noHeader = await fetch(`${base}/api/docs`);
  check(noHeader.status === 403, 'sin la cabecera X-Simulador responde 403');
  const list = await api('GET', '/api/docs');
  check(list.status === 200 && Array.isArray(list.json), 'con la cabecera lista los tableros');
  check(list.headers.get('cache-control') === 'no-store', 'la API no se cachea');
  check((list.headers.get('x-content-type-options') ?? '') === 'nosniff', 'la API manda nosniff una sola vez');
  const form = await api('POST', '/api/docs', { name: 'X', content: EMPTY_BOARD }, { 'X-Simulador': '1', 'Content-Type': 'text/plain' });
  check(form.status === 403, 'una escritura sin Content-Type JSON responde 403');
  const foreign = await api('POST', '/api/docs', { name: 'X', content: EMPTY_BOARD }, { ...API, Origin: 'https://malo.example' });
  check(foreign.status === 403, 'una escritura con Origin ajeno responde 403');
  const own = await api('POST', '/api/docs', { name: 'Propio', content: EMPTY_BOARD }, { ...API, Origin: base });
  check(own.status === 201, 'una escritura con el Origin propio (puerto incluido) pasa');
  const crossSite = await api('GET', '/api/docs', undefined, { ...API, 'Sec-Fetch-Site': 'cross-site' });
  check(crossSite.status === 403, 'una petición de otro sitio responde 403');
  const huge = await api('POST', '/api/docs', { name: 'X', content: 'x'.repeat(6_000_000) });
  check(huge.status === 413, 'un cuerpo de más de 5 MB responde 413');
  const created = await api('POST', '/api/docs', { name: 'Humo persistente', content: EMPTY_BOARD });
  check(created.status === 201, 'crea un tablero');
  const docId = created.json?.id;

  console.log('Endurecimiento');
  check(exec('api', ['id', '-u']).out === '1000', 'la API corre sin root (uid 1000)');
  check(exec('web', ['id', '-u']).out === '101', 'nginx corre sin root (uid 101)');
  check(exec('api', ['touch', '/app/intento']).status !== 0, 'el sistema de archivos de la API es de solo lectura');
  check(exec('web', ['touch', '/usr/share/nginx/html/intento']).status !== 0, 'el de nginx también');
  check(exec('api', ['sh', '-c', 'touch /data/.prueba && rm /data/.prueba']).status === 0, 'la API solo escribe en /data');
  const egress = exec('api', [
    'node',
    '-e',
    "fetch('https://example.com',{signal:AbortSignal.timeout(4000)}).then(()=>process.exit(0),()=>process.exit(1))",
  ]);
  check(egress.status === 1, 'la API no tiene salida a internet');
  check(exec('api', ['sh', '-c', 'command -v npm']).status !== 0, 'la imagen de la API no trae npm');

  console.log('Actualizar conserva los tableros [R6 §13]');
  compose(['up', '-d', '--build', '--force-recreate'], { env: { BUILD_ID: `${buildId}-b` }, quiet: true });
  await waitFor(`${base}/api/docs`);
  const after = await api('GET', `/api/docs/${docId}`);
  check(after.status === 200 && after.json?.name === 'Humo persistente', 'el tablero sigue después de recrear los contenedores');
  const newVersion = await (await fetch(`${base}/version.json`)).json();
  check(newVersion.buildId === `${buildId}-b`, 'y se sirve el build nuevo');

  if (args.has('--e2e')) {
    console.log('Corriendo E2E contra los contenedores…');
    const result = spawnSync('pnpm', ['exec', 'playwright', 'test', '--project=chromium'], {
      stdio: 'inherit',
      env: { ...process.env, E2E_BASE_URL: base },
    });
    check(result.status === 0, 'E2E contra los contenedores');
  }

  if (args.has('--upgrade')) {
    console.log('Actualización con la página abierta…');
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`${base}/`);
      await page.getByTestId('doc-name').waitFor();
      const scriptBefore = await page.locator('script[type="module"]').getAttribute('src');
      const upgradeId = `${buildId}-c`;
      compose(['up', '-d', '--build'], { env: { BUILD_ID: upgradeId }, quiet: true });
      await waitFor(`${base}/api/docs`);
      const dialog = page.waitForEvent('dialog', { timeout: 15_000 });
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      const prompt = await dialog;
      check(prompt.message().includes('Hay una versión nueva'), 'el cliente abierto detecta el build nuevo');
      await Promise.all([page.waitForEvent('load'), prompt.accept()]);
      const scriptAfter = await page.locator('script[type="module"]').getAttribute('src');
      check(!!scriptBefore && !!scriptAfter && scriptBefore !== scriptAfter, `tras recargar se cargan los assets nuevos (${scriptAfter})`);
      await page.getByTestId('doc-name').waitFor();
      check((await page.getByTestId('file-item').count()) >= 1, 'y la lista de tableros sigue ahí');
    } catch (e) {
      check(false, `actualización con la página abierta: ${e instanceof Error ? e.message : e}`);
    } finally {
      await browser.close();
    }
  }
} catch (e) {
  check(false, e instanceof Error ? e.message : String(e));
} finally {
  if (args.has('--keep')) console.log(`Quedó levantado en ${base} (docker compose -p ${project} down -v para borrarlo).`);
  else compose(['down', '-v', '--remove-orphans'], { quiet: true, allowFail: true });
}

if (failures.length) {
  console.error(`\n${failures.length} verificación(es) fallaron.`);
  process.exit(1);
}
console.log('\nHumo de los contenedores: todo OK.');
