/**
 * Servidor de la API de tableros para producción (PLAN §24.1). Sin dependencias en ejecución: se
 * empaqueta en un solo archivo con `pnpm build:server`.
 *
 * Variables de entorno:
 *   PORT (3000) · HOST (0.0.0.0) · DATA_DIR (/data, o `:memory:`)
 *   IDENTITY_HEADER (`tailscale-user-name`; vacía para ignorarla)
 *   BACKUP_KEEP (14) · MAINTENANCE_HOURS (24)
 *
 * `node server.js backup` deja una copia de la base en DATA_DIR/copias y termina.
 */
import { accessSync, constants } from 'node:fs';
import { createServer } from 'node:http';
import { createBackend } from './backend';

/** Versión de la app, inyectada al empaquetar (vite.server.config.ts). */
declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const env = process.env;
const dataDir = env.DATA_DIR ?? '/data';

// La carpeta de datos viene montada desde el host [R6 §15]: si su dueño no es el usuario con el
// que corre la API, SQLite fallaría con un mensaje críptico. Mejor decirlo claro.
if (dataDir !== ':memory:') {
  try {
    accessSync(dataDir, constants.W_OK);
  } catch {
    const uid = process.getuid?.() ?? '?';
    const gid = process.getgid?.() ?? '?';
    console.error(
      `[api] No puedo escribir en ${dataDir}. En el host, la carpeta de datos tiene que ser del usuario ${uid}:${gid}:\n` +
        `        sudo chown -R ${uid}:${gid} datos\n` +
        '      o indicar el dueño real con SIMULADOR_UID y SIMULADOR_GID.',
    );
    process.exit(1);
  }
}

const backend = createBackend({
  dataDir,
  identityHeader: env.IDENTITY_HEADER === undefined ? 'tailscale-user-name' : env.IDENTITY_HEADER || null,
  backupKeep: Number(env.BACKUP_KEEP ?? 14),
});

if (process.argv[2] === 'backup') {
  const copy = backend.backupNow();
  console.log(copy ?? 'Sin directorio de datos: no hay nada que copiar.');
  backend.close();
  process.exit(0);
}

const server = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end('ok\n');
    return;
  }
  void backend.handle(req, res).then((handled) => {
    if (handled) return;
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":"NOT_FOUND"}');
  });
});
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

const port = Number(env.PORT ?? 3000);
server.listen(port, env.HOST ?? '0.0.0.0', () => console.log(`[api] versión ${VERSION}, escuchando en el puerto ${port}`));

backend.maintenance();
const maintenance = setInterval(() => backend.maintenance(), Number(env.MAINTENANCE_HOURS ?? 24) * 3_600_000);

const shutdown = (): void => {
  clearInterval(maintenance);
  server.close(() => {
    backend.close();
    process.exit(0);
  });
  // Conexiones abiertas de más: no esperar para siempre.
  setTimeout(() => process.exit(0), 5_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
