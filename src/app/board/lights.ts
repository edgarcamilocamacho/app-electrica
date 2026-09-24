/**
 * Color con el que se ilumina el esquema interno de cada aparato durante la simulación [R7 §4]:
 * cada borne con tensión toma el color del cable que llega a él, así la tensión se ve seguir del
 * cable al conductor interno, a la cuchilla y al borne de salida.
 *
 * - Si al borne llegan varios cables, manda el más grueso; a igual calibre, el primero en el orden
 *   del documento (siempre el mismo).
 * - Un borne con tensión y sin cable propio (la salida de un contacto cerrado que no va a ningún
 *   lado) toma el color del borne con el que lo une un contacto cerrado.
 * - En un cortocircuito, el rojo de falla, sin brillo, igual que los cables.
 */
import type { BoardDocument, Wire } from '../../core/board/model';
import { terminalKey, terminalOf } from '../../core/board/model';
import type { NetIndex } from '../../core/board/nets';
import type { DeviceRegistry } from '../../core/board/registry';
import type { SimSnapshot } from '../../core/board/sim/engine';
import type { Id } from '../../core/model/types';
import type { TerminalLight } from './art/primitives';
import { BOARD_PALETTE, WIRE_TONES } from './theme';

export type DeviceLights = ReadonlyMap<string, TerminalLight>;

const NO_LIGHTS: DeviceLights = new Map();

/** El cable que pone el color de cada borne: el más grueso; a igual calibre, el primero. */
function colorWires(doc: BoardDocument): Map<string, Wire> {
  const byTerminal = new Map<string, Wire>();
  for (const wire of Object.values(doc.wires)) {
    for (const end of [wire.a, wire.b]) {
      const ref = terminalOf(end);
      if (!ref) continue;
      const key = terminalKey(ref);
      const current = byTerminal.get(key);
      if (!current || wire.gauge > current.gauge) byTerminal.set(key, wire);
    }
  }
  return byTerminal;
}

export function terminalLights(
  doc: BoardDocument,
  registry: DeviceRegistry,
  nets: NetIndex,
  sim: SimSnapshot | null | undefined,
): ReadonlyMap<Id, DeviceLights> {
  const result = new Map<Id, DeviceLights>();
  if (!sim) return result;
  const wires = colorWires(doc);

  for (const device of Object.values(doc.devices)) {
    const def = registry.get(device.type);
    if (!def) continue;
    const lights = new Map<string, TerminalLight>();
    const live = new Set<string>();
    for (const terminal of def.terminals) {
      const ref = { deviceId: device.id, terminalId: terminal.id };
      const potential = sim.netPotentials.get(nets.netOf(ref));
      if (!potential || potential.kind === 'floating') continue;
      live.add(terminal.id);
      if (potential.kind === 'short') {
        lights.set(terminal.id, { color: BOARD_PALETTE.short });
        continue;
      }
      const wire = wires.get(terminalKey(ref));
      if (wire) lights.set(terminal.id, { color: WIRE_TONES[wire.color].on, glow: WIRE_TONES[wire.color].glow });
    }

    // Lo que tiene tensión pero no cable: el color le llega por un contacto cerrado del aparato.
    const view = sim.devices.get(device.id);
    for (let changed = true; changed; ) {
      changed = false;
      for (const contact of def.internals.contacts) {
        if (view?.contacts.get(`${device.id}:${contact.a}-${contact.b}`) !== true) continue;
        for (const [from, to] of [
          [contact.a, contact.b],
          [contact.b, contact.a],
        ] as const) {
          const light = lights.get(from);
          if (light && live.has(to) && !lights.has(to)) {
            lights.set(to, light);
            changed = true;
          }
        }
      }
    }
    result.set(device.id, lights.size > 0 ? lights : NO_LIGHTS);
  }
  return result;
}
