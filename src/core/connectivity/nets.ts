import { compareIds } from '../model/ids';
import { terminalKey, vertexPosition } from '../model/document';
import type { CircuitDocument, Id } from '../model/types';
import type { Registry } from '../registry/types';
import { UnionFind } from './unionFind';

/**
 * Redes estáticas: componentes conexas del grafo de cableado (vértices unidos por segmentos).
 * Un terminal sin cables forma su propia red unitaria. PLAN §5.1 / §9.
 */
export type NetId = string;

export interface NetIndex {
  readonly netOfVertex: ReadonlyMap<Id, NetId>;
  readonly netOfSegment: ReadonlyMap<Id, NetId>;
  /** Red de un terminal (materializado o no). */
  netOfTerminal(componentId: Id, terminalId: string): NetId;
}

const unmaterializedNet = (componentId: Id, terminalId: string): NetId =>
  `t:${terminalKey(componentId, terminalId)}`;

export function computeNets(doc: CircuitDocument): NetIndex {
  const uf = new UnionFind();
  for (const id of Object.keys(doc.vertices)) uf.add(id);
  for (const seg of Object.values(doc.segments)) {
    if (doc.vertices[seg.a] && doc.vertices[seg.b]) uf.union(seg.a, seg.b);
  }

  // Id de red determinista: el menor id de vértice de cada componente conexa.
  const rootToNet = new Map<string, NetId>();
  for (const id of [...Object.keys(doc.vertices)].sort(compareIds)) {
    const root = uf.find(id);
    if (!rootToNet.has(root)) rootToNet.set(root, `n:${id}`);
  }

  const netOfVertex = new Map<Id, NetId>();
  const terminalNet = new Map<string, NetId>();
  for (const v of Object.values(doc.vertices)) {
    const net = rootToNet.get(uf.find(v.id))!;
    netOfVertex.set(v.id, net);
    if (v.kind === 'terminal') terminalNet.set(terminalKey(v.componentId, v.terminalId), net);
  }

  const netOfSegment = new Map<Id, NetId>();
  for (const seg of Object.values(doc.segments)) {
    const net = netOfVertex.get(seg.a);
    if (net) netOfSegment.set(seg.id, net);
  }

  return {
    netOfVertex,
    netOfSegment,
    netOfTerminal: (componentId, terminalId) =>
      terminalNet.get(terminalKey(componentId, terminalId)) ?? unmaterializedNet(componentId, terminalId),
  };
}

/**
 * Partición eléctrica sobre los terminales: grupos de terminales unidos por cableado.
 * Forma canónica (ordenada) para comparar documentos en tests.
 */
export function terminalPartition(doc: CircuitDocument, registry: Registry): string[][] {
  const nets = computeNets(doc);
  const groups = new Map<NetId, string[]>();
  for (const c of Object.values(doc.components)) {
    for (const t of registry.require(c.type).terminals) {
      const net = nets.netOfTerminal(c.id, t.id);
      const list = groups.get(net) ?? [];
      list.push(terminalKey(c.id, t.id));
      groups.set(net, list);
    }
  }
  return [...groups.values()].map((g) => g.sort()).sort((a, b) => (a.join('|') < b.join('|') ? -1 : 1));
}

/**
 * Firma de cada red: terminales + tramos unitarios de grid que cubre. Dos documentos con la misma
 * firma tienen la misma conectividad **y** la misma geometría por red (invariante de la
 * canonicalización, PLAN §4.5). Las redes sin terminales ni tramos (vértices huérfanos) no cuentan.
 */
export function netSignature(doc: CircuitDocument, registry: Registry): string[] {
  const nets = computeNets(doc);
  const terminals = new Map<NetId, Set<string>>();
  const edges = new Map<NetId, Set<string>>();
  const bucket = (map: Map<NetId, Set<string>>, net: NetId) => {
    let set = map.get(net);
    if (!set) {
      set = new Set();
      map.set(net, set);
    }
    return set;
  };

  for (const c of Object.values(doc.components)) {
    for (const t of registry.require(c.type).terminals) {
      bucket(terminals, nets.netOfTerminal(c.id, t.id)).add(terminalKey(c.id, t.id));
    }
  }
  for (const seg of Object.values(doc.segments)) {
    const va = doc.vertices[seg.a];
    const vb = doc.vertices[seg.b];
    if (!va || !vb) continue;
    const a = vertexPosition(doc, va, registry);
    const b = vertexPosition(doc, vb, registry);
    const set = bucket(edges, nets.netOfSegment.get(seg.id)!);
    if (a.y === b.y) {
      for (let x = Math.min(a.x, b.x); x < Math.max(a.x, b.x); x++) set.add(`H${x},${a.y}`);
    } else if (a.x === b.x) {
      for (let y = Math.min(a.y, b.y); y < Math.max(a.y, b.y); y++) set.add(`V${a.x},${y}`);
    } else {
      set.add(`D${a.x},${a.y}-${b.x},${b.y}`);
    }
  }

  const signatures: string[] = [];
  for (const net of new Set<NetId>([...terminals.keys(), ...edges.keys()])) {
    const t = [...(terminals.get(net) ?? [])].sort().join(',');
    const e = [...(edges.get(net) ?? [])].sort().join(';');
    if (t === '' && e === '') continue;
    signatures.push(`T[${t}] E[${e}]`);
  }
  return signatures.sort();
}
