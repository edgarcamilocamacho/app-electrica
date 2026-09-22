/**
 * Diagnósticos del tablero (PLAN §8, R2 §30.2, R5 §1). El núcleo devuelve códigos y parámetros;
 * la UI los traduce. Simular exige cero bloqueantes.
 *
 * Un diagnóstico bloqueante no es una falla de simulación: impide arrancar. El corto y la
 * oscilación ocurren durante la corrida y llevan a modo ERROR.
 */
import { compareIds } from '../model/ids';
import type { Id, Point } from '../model/types';
import type { BoardDocument } from './model';
import { terminalExists } from './model';
import type { DeviceRegistry } from './registry';
import { violations } from './validity';

export type Severity = 'blocking' | 'warning' | 'info';

export type BoardDiagnosticCode =
  | 'WIRE_OVERLAP' // W1
  | 'WIRE_ON_TERMINAL' // W2
  | 'BEND_ON_WIRE' // W3
  | 'DEVICE_OVERLAP' // W4
  | 'BROKEN_WIRE' // un cable que apunta a un borne inexistente (importación)
  | 'REF_REPEATED'
  | 'NO_SOURCE'
  | 'UNWIRED_DEVICE';

export const SEVERITY: Readonly<Record<BoardDiagnosticCode, Severity>> = {
  WIRE_OVERLAP: 'blocking',
  WIRE_ON_TERMINAL: 'blocking',
  BEND_ON_WIRE: 'blocking',
  DEVICE_OVERLAP: 'blocking',
  BROKEN_WIRE: 'blocking',
  REF_REPEATED: 'warning',
  NO_SOURCE: 'warning',
  UNWIRED_DEVICE: 'info',
};

export interface BoardDiagnostic {
  readonly key: string;
  readonly code: BoardDiagnosticCode;
  readonly severity: Severity;
  readonly params: Readonly<Record<string, string | number>>;
  readonly deviceIds: readonly Id[];
  readonly wireIds: readonly Id[];
  readonly at?: Point;
}

const VIOLATION_CODES: Record<string, BoardDiagnosticCode> = {
  W1: 'WIRE_OVERLAP',
  W2: 'WIRE_ON_TERMINAL',
  W3: 'BEND_ON_WIRE',
  W4: 'DEVICE_OVERLAP',
};

export function computeDiagnostics(doc: BoardDocument, registry: DeviceRegistry): BoardDiagnostic[] {
  const out: BoardDiagnostic[] = [];
  const add = (d: Omit<BoardDiagnostic, 'severity' | 'deviceIds' | 'wireIds'> & Partial<BoardDiagnostic>): void => {
    out.push({ deviceIds: [], wireIds: [], ...d, severity: SEVERITY[d.code] });
  };

  for (const violation of violations(doc, registry)) {
    const code = VIOLATION_CODES[violation.code];
    if (!code) continue;
    add({
      key: violation.key,
      code,
      params: {},
      deviceIds: violation.devices ?? [],
      wireIds: violation.wires ?? [],
      at: violation.at,
    });
  }

  for (const wire of Object.values(doc.wires)) {
    if (!terminalExists(doc, registry, wire.a) || !terminalExists(doc, registry, wire.b)) {
      add({ key: `BROKEN_WIRE:${wire.id}`, code: 'BROKEN_WIRE', params: {}, wireIds: [wire.id] });
    }
  }

  const byRef = new Map<string, Id[]>();
  for (const id of Object.keys(doc.devices).sort(compareIds)) {
    const ref = doc.devices[id]!.props.ref;
    if (typeof ref !== 'string' || ref.trim() === '') continue;
    const list = byRef.get(ref);
    if (list) list.push(id);
    else byRef.set(ref, [id]);
  }
  for (const [ref, devices] of byRef) {
    if (devices.length > 1) {
      add({ key: `REF_REPEATED:${ref}`, code: 'REF_REPEATED', params: { ref }, deviceIds: devices });
    }
  }

  const hasSource = Object.values(doc.devices).some((device) => {
    const def = registry.get(device.type);
    return (def?.internals.sources.length ?? 0) > 0;
  });
  if (!hasSource && Object.keys(doc.devices).length > 0) {
    add({ key: 'NO_SOURCE', code: 'NO_SOURCE', params: {} });
  }

  const wired = new Set<Id>();
  for (const wire of Object.values(doc.wires)) {
    wired.add(wire.a.deviceId);
    wired.add(wire.b.deviceId);
  }
  for (const id of Object.keys(doc.devices).sort(compareIds)) {
    if (!wired.has(id)) {
      add({ key: `UNWIRED_DEVICE:${id}`, code: 'UNWIRED_DEVICE', params: {}, deviceIds: [id] });
    }
  }

  return out;
}

export const blockingDiagnostics = (diagnostics: readonly BoardDiagnostic[]): BoardDiagnostic[] =>
  diagnostics.filter((d) => d.severity === 'blocking');
