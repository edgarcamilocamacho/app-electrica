/**
 * Cliente HTTP de la API de tableros (PLAN §24.4). Cada petición lleva la cabecera propia
 * `X-Simulador`; sin red o sin respuesta devuelve `NETWORK`, nunca lanza.
 */
import { API_HEADER, API_HEADER_VALUE, API_PREFIX, SESSION_HEADER, isCloudErrorCode } from '../core/cloud/protocol';
import type { CloudApi, CloudResult } from '../core/cloud/types';

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export function createHttpCloudApi(fetchFn: FetchFn = (input, init) => window.fetch(input, init)): CloudApi {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    extra: { headers?: Record<string, string>; keepalive?: boolean } = {},
  ): Promise<CloudResult<T>> {
    const headers: Record<string, string> = { [API_HEADER]: API_HEADER_VALUE, ...extra.headers };
    const writes = method !== 'GET';
    if (writes) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await fetchFn(`${API_PREFIX}${path}`, {
        method,
        headers,
        cache: 'no-store',
        credentials: 'same-origin',
        ...(writes ? { body: JSON.stringify(body ?? {}) } : {}),
        ...(extra.keepalive ? { keepalive: true } : {}),
      });
    } catch {
      return { ok: false, code: 'NETWORK' };
    }
    const json: unknown = await res.json().catch(() => null);
    if (res.ok) return { ok: true, value: json as T };
    const code = (json as { error?: unknown } | null)?.error;
    if (isCloudErrorCode(code)) return { ok: false, code };
    // Un proxy caído (502, 503, 504) cuenta como falta de red: se reintenta.
    return { ok: false, code: res.status >= 502 && res.status <= 504 ? 'NETWORK' : 'SERVER' };
  }

  const doc = (id: string) => `/docs/${encodeURIComponent(id)}`;

  return {
    me: () => request('GET', '/me'),
    list: () => request('GET', '/docs'),
    trash: () => request('GET', '/trash'),
    get: (id) => request('GET', doc(id)),
    create: (input) => request('POST', '/docs', input),
    save: (id, input) => request('PUT', doc(id), input),
    rename: (id, name) => request('PATCH', doc(id), { name }),
    remove: (id) => request('DELETE', doc(id)),
    restore: (id) => request('POST', `${doc(id)}/restore`),
    lease: (id, input) => request('POST', `${doc(id)}/lease`, input),
    // `keepalive`: la liberación sale aunque la pestaña se esté cerrando.
    release: (id, session) => request('POST', `${doc(id)}/release`, { session }, { keepalive: true }),
    state: (id, session) => request('GET', `${doc(id)}/state`, undefined, { headers: { [SESSION_HEADER]: session } }),
  };
}
