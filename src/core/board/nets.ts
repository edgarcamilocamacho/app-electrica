/**
 * Redes del tablero: un borne se une a otro **solo** si un cable los une [R5 §4]. Sin vértices
 * compartidos, la partición es un union-find directo sobre los extremos de los cables.
 */
import { UnionFind } from '../connectivity/unionFind';
import type { Id } from '../model/types';
import type { BoardDocument, TerminalRef } from './model';
import { terminalKey, terminalOf } from './model';
import type { DeviceRegistry } from './registry';

export type NetId = string;

export interface NetIndex {
  /** Red de un borne. Un borne sin cables tiene su propia red. */
  netOf(ref: TerminalRef): NetId;
  /** Bornes de cada red, en orden determinista. */
  readonly nets: ReadonlyMap<NetId, readonly TerminalRef[]>;
  /** ¿Los dos bornes están en la misma red? */
  connected(a: TerminalRef, b: TerminalRef): boolean;
}

export function computeNets(doc: BoardDocument, registry: DeviceRegistry): NetIndex {
  const uf = new UnionFind();
  const refs = new Map<string, TerminalRef>();

  const addTerminal = (ref: TerminalRef): void => {
    const key = terminalKey(ref);
    if (!refs.has(key)) {
      refs.set(key, ref);
      uf.add(key);
    }
  };

  for (const device of Object.values(doc.devices)) {
    const def = registry.get(device.type);
    if (!def) continue;
    for (const terminal of def.terminals) addTerminal({ deviceId: device.id, terminalId: terminal.id });
  }
  for (const wire of Object.values(doc.wires)) {
    const a = terminalOf(wire.a);
    const b = terminalOf(wire.b);
    // Una punta suelta no une nada: el cable queda a medio conectar.
    if (!a || !b) continue;
    addTerminal(a);
    addTerminal(b);
    uf.union(terminalKey(a), terminalKey(b));
  }

  const nets = new Map<NetId, TerminalRef[]>();
  for (const key of [...refs.keys()].sort()) {
    const root = uf.find(key);
    const list = nets.get(root);
    if (list) list.push(refs.get(key)!);
    else nets.set(root, [refs.get(key)!]);
  }

  return {
    netOf: (ref) => uf.find(terminalKey(ref)),
    nets,
    connected: (a, b) => uf.find(terminalKey(a)) === uf.find(terminalKey(b)),
  };
}

/** Firma determinista de la partición, para comparar dos documentos en los tests. */
export function netSignature(doc: BoardDocument, registry: DeviceRegistry): string[] {
  const index = computeNets(doc, registry);
  return [...index.nets.values()]
    .map((refs) => refs.map(terminalKey).sort().join(' '))
    .filter((net) => net.length > 0)
    .sort();
}

/** Bornes de un aparato que están conectados a algo. */
export function connectedTerminals(doc: BoardDocument, deviceId: Id): readonly TerminalRef[] {
  const out: TerminalRef[] = [];
  for (const wire of Object.values(doc.wires)) {
    for (const end of [wire.a, wire.b]) {
      const ref = terminalOf(end);
      if (ref?.deviceId === deviceId) out.push(ref);
    }
  }
  return out;
}
