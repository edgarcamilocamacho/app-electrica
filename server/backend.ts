/**
 * Arma el backend de los tableros: SQLite, servicio, manejador HTTP y mantenimiento (purga de la
 * papelera y copias de seguridad). Lo usan el servidor de producción (`main.ts`) y el de desarrollo
 * de Vite (`devPlugin.ts`), así que los dos se comportan igual (PLAN §24.1).
 */
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CloudService } from '../src/core/cloud/service';
import { CLOUD_LIMITS } from '../src/core/cloud/types';
import { createApiHandler } from './http';
import { SqliteDocStore } from './sqliteStore';

export interface BackendOptions {
  /** Directorio de datos, o `:memory:` para una base que se pierde al cerrar (E2E). */
  readonly dataDir: string;
  readonly identityHeader?: string | null;
  readonly backupKeep?: number;
  readonly log?: (message: string) => void;
}

export interface Backend {
  readonly handle: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
  readonly service: CloudService;
  readonly store: SqliteDocStore;
  /** Purga la papelera y, si hay directorio de datos, deja una copia de la base. */
  maintenance(): void;
  backupNow(): string | null;
  close(): void;
}

/** Margen para las comillas y escapes del JSON que envuelve al tablero. */
const BODY_OVERHEAD = 64 * 1024;

export function createBackend(options: BackendOptions): Backend {
  const memory = options.dataDir === ':memory:';
  const store = new SqliteDocStore(memory ? ':memory:' : join(options.dataDir, 'tableros.sqlite'));
  const service = new CloudService(store, { now: () => Date.now() });
  const log = options.log ?? ((message: string) => console.log(message));
  const handle = createApiHandler({
    service,
    identityHeader: options.identityHeader,
    // El JSON del tablero viaja como texto dentro de otro JSON: sus comillas se escapan.
    maxBodyBytes: CLOUD_LIMITS.maxContentBytes * 2 + BODY_OVERHEAD,
    onError: (error) => log(`[api] error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`),
  });

  const backupNow = (): string | null => {
    if (memory) return null;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
    return store.backup(join(options.dataDir, 'copias'), stamp, options.backupKeep ?? 14);
  };

  return {
    handle,
    service,
    store,
    backupNow,
    maintenance() {
      const purged = service.purgeTrash();
      if (purged > 0) log(`[api] papelera: ${purged} tablero(s) eliminado(s) por antigüedad`);
      const copy = backupNow();
      if (copy) log(`[api] copia de seguridad: ${copy}`);
    },
    close: () => store.close(),
  };
}
