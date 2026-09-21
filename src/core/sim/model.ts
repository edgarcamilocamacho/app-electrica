import { computeNets, type NetId } from '../connectivity/nets';
import { buildRefIndex } from '../connectivity/refs';
import { compareIds } from '../model/ids';
import type { CircuitDocument, Id } from '../model/types';
import { MIN_PRESET_MS } from '../registry/catalog';
import type { ContactNormal, Registry, TimerType } from '../registry/types';

/**
 * Modelo de simulación derivado del documento: cada dispositivo con las redes estáticas de sus
 * terminales y sus vínculos ya resueltos. Se construye una vez al iniciar la simulación.
 */
export type SimDevice =
  | { readonly kind: 'source'; readonly id: Id; readonly line: NetId; readonly neutral: NetId }
  | {
      readonly kind: 'switch';
      readonly id: Id;
      readonly normal: ContactNormal;
      readonly action: 'maintained' | 'momentary' | 'latching';
      readonly a: NetId;
      readonly b: NetId;
      readonly initiallyActuated: boolean;
    }
  | {
      readonly kind: 'selector';
      readonly id: Id;
      readonly common: NetId;
      readonly out1: NetId;
      readonly out2: NetId;
      readonly initialPosition: 0 | 1 | 2;
    }
  | { readonly kind: 'coil'; readonly id: Id; readonly a: NetId; readonly b: NetId }
  | { readonly kind: 'timer'; readonly id: Id; readonly timerType: TimerType; readonly presetMs: number; readonly a: NetId; readonly b: NetId }
  | {
      readonly kind: 'contact';
      readonly id: Id;
      readonly normal: ContactNormal;
      readonly a: NetId;
      readonly b: NetId;
      /** Bobina o timer que lo acciona; undefined si el vínculo no se resolvió. */
      readonly target?: Id;
    }
  | { readonly kind: 'load'; readonly id: Id; readonly a: NetId; readonly b: NetId };

export interface SimModel {
  readonly devices: readonly SimDevice[];
  readonly byId: ReadonlyMap<Id, SimDevice>;
  /** Todas las redes estáticas (incluidas las unitarias de terminales sin cable). */
  readonly nets: readonly NetId[];
  /** Contactos accionados por cada bobina/timer. */
  readonly contactsOf: ReadonlyMap<Id, readonly Id[]>;
}

export function buildSimModel(doc: CircuitDocument, registry: Registry): SimModel {
  const nets = computeNets(doc);
  const refs = buildRefIndex(doc, registry);
  const devices: SimDevice[] = [];
  const allNets = new Set<NetId>();

  for (const id of Object.keys(doc.components).sort(compareIds)) {
    const c = doc.components[id]!;
    const def = registry.require(c.type);
    const net = (terminalId: string) => {
      const n = nets.netOfTerminal(id, terminalId);
      allNets.add(n);
      return n;
    };
    const [t0, t1, t2] = def.terminals.map((t) => t.id) as [string, string, string?];
    const b = def.behavior;
    switch (b.kind) {
      case 'source':
        devices.push({ kind: 'source', id, line: net(t0), neutral: net(t1) });
        break;
      case 'switch':
        devices.push({
          kind: 'switch',
          id,
          normal: b.normal,
          action: b.action,
          a: net(t0),
          b: net(t1),
          initiallyActuated: b.action === 'maintained' && c.props.initiallyActuated === true,
        });
        break;
      case 'selector': {
        const pos = c.props.initialPosition;
        devices.push({
          kind: 'selector',
          id,
          common: net(t0),
          out1: net(t1),
          out2: net(t2!),
          initialPosition: pos === 1 || pos === 2 ? pos : 0,
        });
        break;
      }
      case 'coil':
        devices.push({ kind: 'coil', id, a: net(t0), b: net(t1) });
        break;
      case 'timer': {
        const preset = typeof c.props.presetMs === 'number' ? c.props.presetMs : 5000;
        devices.push({ kind: 'timer', id, timerType: b.timerType, presetMs: Math.max(MIN_PRESET_MS, Math.round(preset)), a: net(t0), b: net(t1) });
        break;
      }
      case 'contact': {
        const r = refs.resolve(id);
        devices.push({ kind: 'contact', id, normal: b.normal, a: net(t0), b: net(t1), ...(r.status === 'ok' ? { target: r.targetId } : {}) });
        break;
      }
      case 'load':
        devices.push({ kind: 'load', id, a: net(t0), b: net(t1) });
        break;
    }
  }
  for (const n of nets.netOfVertex.values()) allNets.add(n);

  return {
    devices,
    byId: new Map(devices.map((d) => [d.id, d])),
    nets: [...allNets].sort(),
    contactsOf: refs.contactsOf,
  };
}
