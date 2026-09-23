/**
 * API HTTP de los tableros (PLAN §24.4) sobre `node:http`, sin framework.
 *
 * Devuelve un manejador `(req, res) => Promise<boolean>`: `false` si la ruta no es de la API, para
 * que el servidor de Vite (desarrollo) o el propio servidor sigan con otra cosa.
 *
 * Verificaciones de cada petición, en orden:
 *   1. cabecera `X-Simulador: 1` (una página ajena no puede ponerla sin CORS, que no se habilita);
 *   2. `Sec-Fetch-Site`, si viene, debe ser del mismo origen;
 *   3. en las escrituras, `Content-Type: application/json` y, si viene, `Origin` del mismo host;
 *   4. cuerpo acotado en bytes y validado con zod; el tablero, con el parser del núcleo.
 * Los errores salen como `{ error: CODE }`, sin detalles internos.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { API_HEADER, API_HEADER_VALUE, API_PREFIX, DOC_ID_PATTERN, ERROR_STATUS, SESSION_HEADER } from '../src/core/cloud/protocol';
import type { CloudService } from '../src/core/cloud/service';
import type { CloudErrorCode, CloudResult } from '../src/core/cloud/types';

export interface ApiOptions {
  readonly service: CloudService;
  /**
   * Cabecera con el nombre de quien entra, puesta por la red (Tailscale: `tailscale-user-name`).
   * Si viene, manda sobre el apodo que envía el navegador. `null` la ignora.
   */
  readonly identityHeader?: string | null;
  /** Límite del cuerpo de la petición, en bytes. */
  readonly maxBodyBytes: number;
  readonly onError?: (error: unknown) => void;
}

class HttpError extends Error {
  constructor(readonly code: CloudErrorCode) {
    super(code);
  }
}

const Name = z.string().max(1000);
const Nick = z.string().max(200).nullable().optional();
const Session = z.string().max(200);

const CreateBody = z
  .object({ name: Name, content: z.string().optional(), cloneOf: z.string().max(64).optional(), by: Nick })
  .strict();
const SaveBody = z
  .object({ content: z.string(), baseVersion: z.number().int().nonnegative(), session: Session, by: Nick })
  .strict();
const RenameBody = z.object({ name: Name }).strict();
const LeaseBody = z.object({ session: Session, name: Nick, take: z.boolean() }).strict();
const ReleaseBody = z.object({ session: Session }).strict();

const SAME_SITE = new Set(['same-origin', 'none']);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(text);
}

function reply<T>(res: ServerResponse, result: CloudResult<T>, okStatus = 200): void {
  if (result.ok) send(res, okStatus, result.value);
  else send(res, ERROR_STATUS[result.code], { error: result.code });
}

const header = (req: IncomingMessage, name: string): string | undefined => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

/** Decodifica un encoded-word de RFC 2047 (`=?utf-8?q?…?=` o `=?utf-8?b?…?=`), como los manda Tailscale. */
export function decodeHeaderWord(value: string): string {
  return value.replace(/=\?utf-8\?([qb])\?([^?]*)\?=/gi, (_all, kind: string, text: string) => {
    try {
      if (kind.toLowerCase() === 'b') return Buffer.from(text, 'base64').toString('utf8');
      const bytes = text
        .replace(/%/g, '%25')
        .replace(/_/g, ' ')
        .replace(/=([0-9a-f]{2})/gi, (_m, hex: string) => `%${hex}`);
      return decodeURIComponent(bytes);
    } catch {
      return '';
    }
  });
}

/** El `Origin` de una escritura debe apuntar al mismo host al que llegó la petición. */
function sameHost(req: IncomingMessage): boolean {
  const origin = header(req, 'origin');
  if (origin === undefined) return true;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const candidates = [header(req, 'host'), header(req, 'x-forwarded-host')]
    .filter((h): h is string => typeof h === 'string')
    .flatMap((h) => h.split(','))
    .map((h) => h.trim().toLowerCase());
  return candidates.includes(host);
}

async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  const declared = Number(header(req, 'content-length') ?? '0');
  if (declared > limit) throw new HttpError('TOO_LARGE');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > limit) throw new HttpError('TOO_LARGE');
    chunks.push(buffer);
  }
  if (size === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HttpError('INVALID_INPUT');
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError('INVALID_INPUT');
  return parsed.data;
}

export function createApiHandler(options: ApiOptions): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  const { service, maxBodyBytes } = options;
  const identityHeader = options.identityHeader === undefined ? 'tailscale-user-name' : options.identityHeader;

  const identity = (req: IncomingMessage): string | null => {
    if (!identityHeader) return null;
    const raw = header(req, identityHeader);
    const name = raw ? decodeHeaderWord(raw).trim() : '';
    return name || null;
  };

  return async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== API_PREFIX && !url.pathname.startsWith(`${API_PREFIX}/`)) return false;
    const method = (req.method ?? 'GET').toUpperCase();

    try {
      if (header(req, API_HEADER) !== API_HEADER_VALUE) throw new HttpError('FORBIDDEN');
      const site = header(req, 'sec-fetch-site');
      if (site !== undefined && !SAME_SITE.has(site)) throw new HttpError('FORBIDDEN');
      const writes = WRITE_METHODS.has(method);
      if (writes) {
        const type = (header(req, 'content-type') ?? '').split(';')[0]!.trim().toLowerCase();
        if (type !== 'application/json') throw new HttpError('FORBIDDEN');
        if (!sameHost(req)) throw new HttpError('FORBIDDEN');
      }

      const parts = url.pathname.slice(API_PREFIX.length).split('/').filter(Boolean);
      const [resource, id, action] = parts;
      if (parts.length > 3 || (id !== undefined && !DOC_ID_PATTERN.test(id))) throw new HttpError('NOT_FOUND');
      const body = writes ? await readJson(req, maxBodyBytes) : undefined;
      const who = identity(req);

      if (resource === 'me' && parts.length === 1 && method === 'GET') {
        send(res, 200, { name: who });
        return true;
      }
      if (resource === 'trash' && parts.length === 1 && method === 'GET') {
        send(res, 200, service.trash());
        return true;
      }
      if (resource !== 'docs') throw new HttpError('NOT_FOUND');

      if (id === undefined) {
        if (method === 'GET') {
          send(res, 200, service.list());
          return true;
        }
        if (method === 'POST') {
          const input = parse(CreateBody, body);
          reply(
            res,
            service.create({
              name: input.name,
              ...(input.content !== undefined ? { content: input.content } : {}),
              ...(input.cloneOf !== undefined ? { cloneOf: input.cloneOf } : {}),
              by: who ?? input.by ?? null,
            }),
            201,
          );
          return true;
        }
        throw new HttpError('NOT_FOUND');
      }

      if (action === undefined) {
        if (method === 'GET') reply(res, service.get(id));
        else if (method === 'PUT') {
          const input = parse(SaveBody, body);
          reply(res, service.save(id, { ...input, by: who ?? input.by ?? null }));
        } else if (method === 'PATCH') reply(res, service.rename(id, parse(RenameBody, body).name));
        else if (method === 'DELETE') reply(res, service.remove(id));
        else throw new HttpError('NOT_FOUND');
        return true;
      }

      if (action === 'state' && method === 'GET') {
        reply(res, service.state(id, header(req, SESSION_HEADER) ?? ''));
        return true;
      }
      if (action === 'lease' && method === 'POST') {
        const input = parse(LeaseBody, body);
        reply(res, service.lease(id, { session: input.session, take: input.take, name: who ?? input.name ?? null }));
        return true;
      }
      if (action === 'release' && method === 'POST') {
        reply(res, service.release(id, parse(ReleaseBody, body).session));
        return true;
      }
      if (action === 'restore' && method === 'POST') {
        reply(res, service.restore(id));
        return true;
      }
      throw new HttpError('NOT_FOUND');
    } catch (error) {
      if (error instanceof HttpError) {
        // Un cuerpo demasiado grande se corta sin leer el resto.
        if (error.code === 'TOO_LARGE') res.setHeader('Connection', 'close');
        send(res, ERROR_STATUS[error.code], { error: error.code });
      } else {
        options.onError?.(error);
        if (!res.headersSent) send(res, 500, { error: 'SERVER' });
      }
      return true;
    }
  };
}
