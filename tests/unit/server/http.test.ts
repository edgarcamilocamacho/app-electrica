/**
 * API real sobre HTTP en un puerto libre: rutas, verificaciones de origen, límites y persistencia.
 */
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serializeBoard } from '../../../src/core/board/persistence';
import { createBackend, type Backend } from '../../../server/backend';
import { decodeHeaderWord } from '../../../server/http';
import { BoardBuilder } from '../../fixtures/board';

const SESSION_A = 'sesion-aaaa';
const SESSION_B = 'sesion-bbbb';

function boardJson(lamps = 0): string {
  const b = new BoardBuilder();
  b.device('supply-1p', 0, 0);
  for (let i = 0; i < lamps; i += 1) b.device('pilot-lamp', 20 + i * 10, 0);
  return serializeBoard(b.doc);
}

interface Running {
  readonly base: string;
  readonly backend: Backend;
  close(): Promise<void>;
}

async function start(dataDir = ':memory:'): Promise<Running> {
  const backend = createBackend({ dataDir, log: () => {} });
  const server: Server = createServer((req, res) => {
    void backend.handle(req, res).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    backend,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          backend.close();
          resolve();
        });
      }),
  };
}

const HEADERS = { 'X-Simulador': '1', 'Content-Type': 'application/json' };

describe('API HTTP de tableros', () => {
  let app: Running;

  beforeEach(async () => {
    app = await start();
  });
  afterEach(async () => {
    await app.close();
  });

  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(`${app.base}${path}`, {
      method,
      headers: { ...HEADERS, ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? (JSON.parse(text) as Record<string, unknown>) : null };
  };

  it('crea, lista, abre, guarda con el turno y manda a la papelera', async () => {
    const created = await call('POST', '/api/docs', { name: 'Arranque', content: boardJson(), by: 'Ana' });
    expect(created.status).toBe(201);
    const id = created.body!.id as string;
    expect(created.body).toMatchObject({ name: 'Arranque', version: 1, updatedBy: 'Ana' });

    const list = await call('GET', '/api/docs');
    expect(list.status).toBe(200);
    expect(list.headers.get('cache-control')).toBe('no-store');
    expect((list.body as unknown as { id: string }[]).map((d) => d.id)).toEqual([id]);

    const lease = await call('POST', `/api/docs/${id}/lease`, { session: SESSION_A, name: 'Ana', take: false });
    expect(lease.body).toEqual({ granted: true, version: 1, editor: { name: 'Ana' } });

    const other = await call('PUT', `/api/docs/${id}`, { content: boardJson(1), baseVersion: 1, session: SESSION_B });
    expect(other).toMatchObject({ status: 409, body: { error: 'NOT_EDITOR' } });

    const saved = await call('PUT', `/api/docs/${id}`, { content: boardJson(1), baseVersion: 1, session: SESSION_A, by: 'Ana' });
    expect(saved.status).toBe(200);
    expect(saved.body!.version).toBe(2);

    const state = await call('GET', `/api/docs/${id}/state`, undefined, { 'X-Simulador-Session': SESSION_A });
    expect(state.body).toMatchObject({ version: 2, editing: true, editor: { name: 'Ana' } });

    const doc = await call('GET', `/api/docs/${id}`);
    expect(doc.body!.content).toBe(boardJson(1));

    expect((await call('DELETE', `/api/docs/${id}`)).status).toBe(200);
    expect((await call('GET', '/api/docs')).body).toEqual([]);
    expect(((await call('GET', '/api/trash')).body as unknown as { id: string }[])[0]!.id).toBe(id);
    expect((await call('POST', `/api/docs/${id}/restore`)).body).toMatchObject({ id, name: 'Arranque' });
  });

  it('tomar el turno deja al anterior sin poder guardar, y soltarlo lo libera', async () => {
    const id = (await call('POST', '/api/docs', { name: 'T', content: boardJson() })).body!.id as string;
    await call('POST', `/api/docs/${id}/lease`, { session: SESSION_A, take: false });
    expect((await call('POST', `/api/docs/${id}/lease`, { session: SESSION_B, take: false })).body!.granted).toBe(false);
    expect((await call('POST', `/api/docs/${id}/lease`, { session: SESSION_B, take: true })).body!.granted).toBe(true);
    await call('POST', `/api/docs/${id}/release`, { session: SESSION_B });
    expect((await call('GET', '/api/docs')).body![0]).toMatchObject({ editor: null });
  });

  it('el nombre de la red (Tailscale) manda sobre el apodo del navegador', async () => {
    const headers = { 'Tailscale-User-Name': '=?utf-8?q?Mar=C3=ADa_P=C3=A9rez?=' };
    expect((await call('GET', '/api/me', undefined, headers)).body).toEqual({ name: 'María Pérez' });
    expect((await call('GET', '/api/me')).body).toEqual({ name: null });
    const created = await call('POST', '/api/docs', { name: 'T', content: boardJson(), by: 'Apodo' }, headers);
    expect(created.body!.updatedBy).toBe('María Pérez');
  });

  describe('verificaciones de origen', () => {
    it('sin la cabecera propia responde 403, también en las lecturas', async () => {
      const res = await fetch(`${app.base}/api/docs`);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'FORBIDDEN' });
    });

    it('rechaza peticiones de otro sitio', async () => {
      expect((await call('GET', '/api/docs', undefined, { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403);
      expect((await call('GET', '/api/docs', undefined, { 'Sec-Fetch-Site': 'same-origin' })).status).toBe(200);
      const foreign = await call('POST', '/api/docs', { name: 'X', content: boardJson() }, { Origin: 'https://malo.example' });
      expect(foreign.status).toBe(403);
      const host = new URL(app.base).host;
      const own = await call('POST', '/api/docs', { name: 'X', content: boardJson() }, { Origin: `http://${host}` });
      expect(own.status).toBe(201);
      const forwarded = await call(
        'POST',
        '/api/docs',
        { name: 'Y', content: boardJson() },
        { Origin: 'https://simulador.example.ts.net', 'X-Forwarded-Host': 'simulador.example.ts.net' },
      );
      expect(forwarded.status).toBe(201);
    });

    it('una escritura sin Content-Type JSON responde 403 (un formulario no puede hacerla)', async () => {
      const res = await fetch(`${app.base}/api/docs`, {
        method: 'POST',
        headers: { 'X-Simulador': '1', 'Content-Type': 'text/plain' },
        body: JSON.stringify({ name: 'X', content: boardJson() }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('entrada inválida', () => {
    it('rechaza JSON roto, campos de más, tableros inválidos e ids raros', async () => {
      const broken = await fetch(`${app.base}/api/docs`, { method: 'POST', headers: HEADERS, body: '{"name":' });
      expect(broken.status).toBe(400);
      expect((await call('POST', '/api/docs', { name: 'X', content: boardJson(), extra: 1 })).status).toBe(400);
      expect((await call('POST', '/api/docs', { name: 'X', content: '{"schemaVersion":2}' })).body).toEqual({
        error: 'INVALID_DOCUMENT',
      });
      expect((await call('GET', '/api/docs/..%2F..%2Fetc')).status).toBe(404);
      expect((await call('GET', '/api/docs/a/b/c/d')).status).toBe(404);
      expect((await call('GET', '/api/nada')).status).toBe(404);
    });

    it('corta un cuerpo demasiado grande con 413', async () => {
      const huge = 'x'.repeat(4_300_000);
      const res = await call('POST', '/api/docs', { name: 'X', content: huge });
      expect(res.status).toBe(413);
    });

    it('un tablero de más de 2 MB se rechaza aunque el cuerpo entre', async () => {
      const b = new BoardBuilder();
      b.device('supply-1p', 0, 0);
      const doc = { ...b.doc, annotations: { n1: { id: 'n1', position: { x: 0, y: 40 }, text: 'x'.repeat(2_100_000) } } };
      const res = await call('POST', '/api/docs', { name: 'X', content: serializeBoard(doc) });
      expect(res.body).toEqual({ error: 'TOO_LARGE' });
    });
  });

  it('las rutas fuera de /api no son de la API', async () => {
    const res = await fetch(`${app.base}/index.html`);
    expect(res.status).toBe(404);
  });
});

describe('persistencia y copias de seguridad', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'simulador-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('los tableros sobreviven a un reinicio y la copia queda en copias/', async () => {
    let app = await start(dir);
    const created = await fetch(`${app.base}/api/docs`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ name: 'Persistente', content: boardJson(2) }),
    });
    const id = ((await created.json()) as { id: string }).id;
    const copy = app.backend.backupNow();
    await app.close();

    app = await start(dir);
    const res = await fetch(`${app.base}/api/docs/${id}`, { headers: HEADERS });
    expect(((await res.json()) as { name: string }).name).toBe('Persistente');
    await app.close();

    expect(copy).toMatch(/copias\/tableros-.*\.sqlite$/);
    expect(readdirSync(join(dir, 'copias'))).toHaveLength(1);
  });

  it('conserva solo las últimas copias', () => {
    const backend = createBackend({ dataDir: dir, backupKeep: 2, log: () => {} });
    for (const stamp of ['20260101-000000', '20260102-000000', '20260103-000000']) {
      backend.store.backup(join(dir, 'copias'), stamp, 2);
    }
    backend.close();
    expect(readdirSync(join(dir, 'copias')).sort()).toEqual(['tableros-20260102-000000.sqlite', 'tableros-20260103-000000.sqlite']);
  });
});

describe('cabeceras de identidad', () => {
  it('decodifica las palabras codificadas de RFC 2047', () => {
    expect(decodeHeaderWord('Ana')).toBe('Ana');
    expect(decodeHeaderWord('=?utf-8?q?Jos=C3=A9?=')).toBe('José');
    expect(decodeHeaderWord('=?utf-8?b?w5FhbmR1?=')).toBe('Ñandu');
  });
});
