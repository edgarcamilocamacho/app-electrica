/**
 * Turno de edición: un editor por tablero a la vez [R6 §5] (PLAN §24.3).
 *
 * El turno pertenece a una sesión (una pestaña) y vence si no late durante `LEASE_TTL_MS`.
 * Pedirlo lo concede si está libre, vencido o ya es propio; tomarlo lo concede siempre.
 */
import { LEASE_TTL_MS, type EditorInfo } from './types';

export interface Lease {
  readonly session: string;
  readonly name: string | null;
  readonly seenAt: number;
}

export const leaseAlive = (lease: Lease | null, now: number): lease is Lease =>
  lease !== null && now - lease.seenAt < LEASE_TTL_MS;

export const leaseHeldBy = (lease: Lease | null, session: string, now: number): boolean =>
  leaseAlive(lease, now) && lease.session === session;

export const editorOf = (lease: Lease | null, now: number): EditorInfo | null =>
  leaseAlive(lease, now) ? { name: lease.name } : null;

export interface LeaseDecision {
  readonly granted: boolean;
  /** El turno tal como queda. */
  readonly lease: Lease | null;
}

export function decideLease(
  current: Lease | null,
  request: { readonly session: string; readonly name: string | null; readonly take: boolean },
  now: number,
): LeaseDecision {
  const free = !leaseAlive(current, now) || current.session === request.session;
  if (free || request.take) {
    return { granted: true, lease: { session: request.session, name: request.name, seenAt: now } };
  }
  return { granted: false, lease: current };
}
