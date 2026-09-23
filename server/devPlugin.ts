/**
 * Monta la API de tableros dentro del servidor de Vite [R6 §14] (PLAN §24.1):
 *   - `pnpm dev`: base en `.data/` (o en SIMULADOR_DATA), persiste entre arranques;
 *   - `pnpm preview`: base en memoria salvo que se indique otra, para los E2E.
 * Es el mismo backend que corre en producción; solo cambia quién atiende el HTTP.
 */
import { resolve } from 'node:path';
import { runnerImport, type Connect, type Plugin } from 'vite';
import type { Backend } from './backend.ts';

type BackendModule = typeof import('./backend.ts');

function mount(root: string, middlewares: Connect.Server, dataDir: string, onClose: (close: () => void) => void): void {
  let backend: Promise<Backend> | undefined;
  const get = (): Promise<Backend> => {
    // Carga perezosa y con el cargador de Vite: el config no empaqueta el backend, y `node:sqlite`
    // solo se abre si alguien usa la API.
    backend ??= runnerImport<BackendModule>(resolve(root, 'server/backend.ts'), {
      configFile: false,
      logLevel: 'error',
    }).then(({ module: { createBackend } }) => {
      const created = createBackend({ dataDir });
      onClose(() => created.close());
      return created;
    });
    return backend;
  };
  middlewares.use((req, res, next) => {
    if (!req.url?.startsWith('/api')) {
      next();
      return;
    }
    void get()
      .then((b) => b.handle(req, res))
      .then((handled) => {
        if (!handled) next();
      })
      .catch(next);
  });
}

export function cloudApiPlugin(): Plugin {
  return {
    name: 'cloud-api',
    configureServer(server) {
      if (process.env.VITEST) return;
      mount(server.config.root, server.middlewares, process.env.SIMULADOR_DATA ?? '.data', (close) => server.httpServer?.on('close', close));
    },
    configurePreviewServer(server) {
      mount(server.config.root, server.middlewares, process.env.SIMULADOR_DATA ?? ':memory:', (close) => server.httpServer.on('close', close));
    },
  };
}
