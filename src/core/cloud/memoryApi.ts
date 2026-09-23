/**
 * `CloudApi` en memoria sobre el mismo `CloudService` que usa el servidor. Lo usan las pruebas de
 * integración y la app en modo E2E: las reglas son las reales, solo falta el HTTP.
 */
import { CloudService, type CloudServiceDeps } from './service';
import { MemoryDocStore } from './store';
import type { CloudApi } from './types';

export interface MemoryCloud {
  readonly api: CloudApi;
  readonly service: CloudService;
}

export function createMemoryCloud(deps: Partial<CloudServiceDeps> = {}, identity: string | null = null): MemoryCloud {
  const service = new CloudService(new MemoryDocStore(), { now: () => Date.now(), ...deps });
  const by = (name: string | null): string | null => identity ?? name;
  const api: CloudApi = {
    me: async () => ({ ok: true, value: { name: identity } }),
    list: async () => ({ ok: true, value: service.list() }),
    trash: async () => ({ ok: true, value: service.trash() }),
    get: async (id) => service.get(id),
    create: async (input) => service.create({ ...input, by: by(input.by) }),
    save: async (id, input) => service.save(id, { ...input, by: by(input.by) }),
    rename: async (id, name) => service.rename(id, name),
    remove: async (id) => service.remove(id),
    restore: async (id) => service.restore(id),
    lease: async (id, input) => service.lease(id, { ...input, name: by(input.name) }),
    release: async (id, session) => service.release(id, session),
    state: async (id, session) => service.state(id, session),
  };
  return { api, service };
}
