import { describe, expect, it, vi } from 'vitest';
import { VersionChecker, type FetchLike } from '../../../src/platform/version';

const respond = (body: unknown, ok = true): FetchLike => async () => ({ ok, json: async () => body });

describe('detección de versión nueva (PLAN §16.2)', () => {
  it('avisa una sola vez cuando el build remoto es distinto', async () => {
    const onNewVersion = vi.fn();
    const c = new VersionChecker({ currentBuildId: 'a1', fetch: respond({ buildId: 'b2' }), onNewVersion, now: () => 7 });
    expect(await c.check()).toBe('b2');
    await c.check();
    expect(onNewVersion).toHaveBeenCalledTimes(1);
    expect(onNewVersion).toHaveBeenCalledWith('b2');
  });

  it('no avisa si el build coincide', async () => {
    const onNewVersion = vi.fn();
    const c = new VersionChecker({ currentBuildId: 'a1', fetch: respond({ buildId: 'a1' }), onNewVersion });
    await c.check();
    expect(onNewVersion).not.toHaveBeenCalled();
  });

  it('consulta sin caché y con parámetro anti-caché (proxies que ignoran cabeceras, R12)', async () => {
    const fetch = vi.fn(respond({ buildId: 'a1' }));
    const c = new VersionChecker({ currentBuildId: 'a1', fetch, onNewVersion: () => {}, now: () => 123 });
    await c.check();
    expect(fetch).toHaveBeenCalledWith('/version.json?t=123', { cache: 'no-store' });
  });

  it('sin red o con respuesta inválida no falla ni avisa', async () => {
    const onNewVersion = vi.fn();
    const failing: FetchLike = async () => {
      throw new Error('offline');
    };
    expect(await new VersionChecker({ currentBuildId: 'a', fetch: failing, onNewVersion }).check()).toBeUndefined();
    expect(await new VersionChecker({ currentBuildId: 'a', fetch: respond({}, false), onNewVersion }).check()).toBeUndefined();
    expect(await new VersionChecker({ currentBuildId: 'a', fetch: respond({ buildId: 5 }), onNewVersion }).check()).toBeUndefined();
    expect(onNewVersion).not.toHaveBeenCalled();
  });
});
