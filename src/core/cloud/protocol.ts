/**
 * Protocolo HTTP de los tableros (PLAN §24.4): rutas, cabeceras y estado HTTP de cada error.
 * Lo usan el servidor y el cliente, para que no se desalineen.
 */
import type { CloudErrorCode } from './types';

export const API_PREFIX = '/api';

/**
 * Toda petición a la API la lleva. Una página de otro sitio no puede agregarla sin una consulta
 * CORS previa, que el servidor no autoriza: es la primera defensa contra peticiones cruzadas.
 */
export const API_HEADER = 'x-simulador';
export const API_HEADER_VALUE = '1';
/** Sesión (pestaña) que consulta el estado de un tablero. */
export const SESSION_HEADER = 'x-simulador-session';

/** Ids que acepta la API en una ruta: nunca se usan como ruta de archivo. */
export const DOC_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const ERROR_STATUS: Readonly<Record<CloudErrorCode, number>> = {
  NOT_FOUND: 404,
  IN_TRASH: 409,
  NOT_EDITOR: 409,
  STALE: 409,
  INVALID_DOCUMENT: 422,
  INVALID_NAME: 422,
  INVALID_INPUT: 400,
  TOO_LARGE: 413,
  QUOTA: 507,
  FORBIDDEN: 403,
  SERVER: 500,
  NETWORK: 503,
};

const CODES = new Set(Object.keys(ERROR_STATUS));
export const isCloudErrorCode = (value: unknown): value is CloudErrorCode => typeof value === 'string' && CODES.has(value);
