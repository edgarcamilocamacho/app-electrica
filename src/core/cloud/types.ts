/**
 * Contrato de los tableros guardados en el servidor [R6] (PLAN §24).
 *
 * Lo comparten el servidor (`server/`), el cliente HTTP y el backend en memoria de las pruebas:
 * todos hablan en estos tipos y en estos códigos de error.
 */

/** Límites del almacenamiento [Técnica] (PLAN §24.4). */
export const CLOUD_LIMITS = {
  /** Tamaño máximo del JSON de un tablero, en bytes UTF-8. */
  maxContentBytes: 2_000_000,
  maxNameLength: 120,
  maxEditorNameLength: 60,
  maxDocs: 5000,
  /** Suma de los tableros activos y de la papelera. */
  maxTotalBytes: 1_000_000_000,
  maxSessionLength: 64,
} as const;

export type CloudLimits = { readonly [K in keyof typeof CLOUD_LIMITS]: number };

/** El turno de edición vence si quien edita deja de latir durante este tiempo [R6 §5]. */
export const LEASE_TTL_MS = 20_000;
/** Quien edita late con esta frecuencia. */
export const LEASE_HEARTBEAT_MS = 5_000;
/** Quien mira consulta el estado con esta frecuencia. */
export const VIEWER_POLL_MS = 2_000;
/** Lo que está en la papelera se elimina solo pasado este tiempo [R6 §8]. */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type CloudErrorCode =
  | 'NOT_FOUND'
  | 'IN_TRASH'
  /** Otra sesión tiene el turno de edición. */
  | 'NOT_EDITOR'
  /** El guardado parte de una versión que ya no es la última. */
  | 'STALE'
  | 'INVALID_DOCUMENT'
  | 'INVALID_NAME'
  | 'INVALID_INPUT'
  | 'TOO_LARGE'
  | 'QUOTA'
  /** La petición no pasó las verificaciones de origen (PLAN §24.4). */
  | 'FORBIDDEN'
  /** Falla del servidor, sin detalles. */
  | 'SERVER'
  /** No hubo respuesta: sin red o servidor caído. Solo lo produce el cliente. */
  | 'NETWORK';

export type CloudResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: CloudErrorCode };

/** Quién tiene el turno de edición. `name` es null si entró sin nombre. */
export interface EditorInfo {
  readonly name: string | null;
}

export interface DocSummary {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  /** Milisegundos desde la época. */
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly updatedBy: string | null;
  /** Quién lo está editando ahora, si alguien tiene el turno vigente. */
  readonly editor: EditorInfo | null;
}

export interface TrashSummary extends DocSummary {
  readonly deletedAt: number;
  /** Cuándo se elimina solo. */
  readonly purgeAt: number;
}

export interface DocFull extends DocSummary {
  readonly content: string;
  readonly deletedAt: number | null;
}

/** Lo que consulta quien mira un tablero, sin el contenido. */
export interface DocState {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly deletedAt: number | null;
  readonly editor: EditorInfo | null;
  /** La sesión que pregunta es la que tiene el turno. */
  readonly editing: boolean;
}

export interface LeaseResult {
  readonly granted: boolean;
  readonly version: number;
  readonly editor: EditorInfo | null;
}

export interface SaveResult {
  readonly version: number;
  readonly updatedAt: number;
}

export interface CreateInput {
  readonly name: string;
  /** JSON del tablero nuevo. */
  readonly content?: string;
  /** Clonar este tablero [R6 §7]. */
  readonly cloneOf?: string;
  readonly by: string | null;
}

export interface SaveInput {
  readonly content: string;
  readonly baseVersion: number;
  readonly session: string;
  readonly by: string | null;
}

export interface LeaseInput {
  readonly session: string;
  readonly name: string | null;
  /** Tomar el turno aunque lo tenga otro [R6 §5]. */
  readonly take: boolean;
}

/** Operaciones sobre los tableros; la implementan el cliente HTTP y el backend en memoria. */
export interface CloudApi {
  me(): Promise<CloudResult<{ readonly name: string | null }>>;
  list(): Promise<CloudResult<readonly DocSummary[]>>;
  trash(): Promise<CloudResult<readonly TrashSummary[]>>;
  get(id: string): Promise<CloudResult<DocFull>>;
  create(input: CreateInput): Promise<CloudResult<DocFull>>;
  save(id: string, input: SaveInput): Promise<CloudResult<SaveResult>>;
  rename(id: string, name: string): Promise<CloudResult<DocSummary>>;
  remove(id: string): Promise<CloudResult<null>>;
  restore(id: string): Promise<CloudResult<DocSummary>>;
  lease(id: string, input: LeaseInput): Promise<CloudResult<LeaseResult>>;
  release(id: string, session: string): Promise<CloudResult<null>>;
  state(id: string, session: string): Promise<CloudResult<DocState>>;
}
