/**
 * Modelo de simulación del tablero (PLAN §22.4).
 *
 * El documento se traduce a **elementos**: fuentes, actuadores (bobina, temporizador o
 * accionamiento manual), contactos y cargas, cada uno con las redes de sus bornes. Un contacto
 * apunta a un actuador **del mismo aparato**: no hay vínculos por referencia [R5 §1].
 */
import { compareIds } from '../../model/ids';
import type { Id } from '../../model/types';
import { MIN_PRESET_MS } from '../catalog';
import type { BoardDocument } from '../model';
import { computeNets, type NetId } from '../nets';
import type { ContactNormal, DeviceRegistry, LoadLook, ManualAction, TimerType } from '../registry';

export type ElementId = string;

export interface SimSource {
  readonly id: ElementId;
  readonly deviceId: Id;
  /** Una red por fase; cada una inyecta la identidad `${id}:${índice}` [R2 §11, R5 §2]. */
  readonly phases: readonly NetId[];
  readonly neutral: NetId;
}

export type SimActuator =
  | { readonly kind: 'coil'; readonly id: ElementId; readonly deviceId: Id; readonly a: NetId; readonly b: NetId }
  | {
      readonly kind: 'timer';
      readonly id: ElementId;
      readonly deviceId: Id;
      readonly timerType: TimerType;
      readonly presetMs: number;
      readonly a: NetId;
      readonly b: NetId;
    }
  | {
      readonly kind: 'manual';
      readonly id: ElementId;
      readonly deviceId: Id;
      readonly action: ManualAction;
      readonly initialState: number;
    };

export interface SimContact {
  readonly id: ElementId;
  readonly deviceId: Id;
  readonly actuatorId: ElementId;
  readonly normal: ContactNormal;
  readonly a: NetId;
  readonly b: NetId;
  /** Solo en selectores: posición que cierra este contacto. */
  readonly position?: number;
}

export interface SimLoad {
  readonly id: ElementId;
  readonly deviceId: Id;
  readonly a: NetId;
  readonly b: NetId;
  readonly look: LoadLook;
}

export interface DeviceElements {
  readonly sources: readonly ElementId[];
  readonly actuators: readonly ElementId[];
  readonly contacts: readonly ElementId[];
  readonly loads: readonly ElementId[];
}

export interface BoardSimModel {
  readonly sources: readonly SimSource[];
  readonly actuators: readonly SimActuator[];
  readonly contacts: readonly SimContact[];
  readonly loads: readonly SimLoad[];
  /** Todas las redes, incluidas las de bornes sin cable. */
  readonly nets: readonly NetId[];
  readonly actuatorById: ReadonlyMap<ElementId, SimActuator>;
  readonly contactById: ReadonlyMap<ElementId, SimContact>;
  /** Contactos que mueve cada actuador. */
  readonly contactsOf: ReadonlyMap<ElementId, readonly ElementId[]>;
  readonly elementsOf: ReadonlyMap<Id, DeviceElements>;
  readonly deviceOf: ReadonlyMap<ElementId, Id>;
  /** Actuador manual de un aparato, si tiene: lo que responde a un clic del usuario. */
  readonly manualOf: ReadonlyMap<Id, ElementId>;
}

const DEFAULT_PRESET_MS = 5000;

export function buildBoardSimModel(doc: BoardDocument, registry: DeviceRegistry): BoardSimModel {
  const nets = computeNets(doc, registry);
  const sources: SimSource[] = [];
  const actuators: SimActuator[] = [];
  const contacts: SimContact[] = [];
  const loads: SimLoad[] = [];
  const elementsOf = new Map<Id, DeviceElements>();
  const deviceOf = new Map<ElementId, Id>();
  const manualOf = new Map<Id, ElementId>();
  const allNets = new Set<NetId>();

  for (const deviceId of Object.keys(doc.devices).sort(compareIds)) {
    const device = doc.devices[deviceId]!;
    const def = registry.get(device.type);
    if (!def) continue;
    const net = (terminalId: string): NetId => {
      const n = nets.netOf({ deviceId, terminalId });
      allNets.add(n);
      return n;
    };
    for (const terminal of def.terminals) net(terminal.id);

    const mine: DeviceElements = { sources: [], actuators: [], contacts: [], loads: [] };
    const own = mine as {
      sources: ElementId[];
      actuators: ElementId[];
      contacts: ElementId[];
      loads: ElementId[];
    };

    for (const source of def.internals.sources) {
      const id = `${deviceId}:${source.id}`;
      sources.push({ id, deviceId, phases: source.phases.map(net), neutral: net(source.neutral) });
      own.sources.push(id);
      deviceOf.set(id, deviceId);
    }

    for (const actuator of def.internals.actuators) {
      const id = `${deviceId}:${actuator.id}`;
      own.actuators.push(id);
      deviceOf.set(id, deviceId);
      if (actuator.kind === 'coil') {
        actuators.push({ kind: 'coil', id, deviceId, a: net(actuator.terminals[0]), b: net(actuator.terminals[1]) });
      } else if (actuator.kind === 'timer') {
        const raw = device.props.presetMs;
        const presetMs = Math.max(MIN_PRESET_MS, Math.round(typeof raw === 'number' ? raw : DEFAULT_PRESET_MS));
        actuators.push({
          kind: 'timer',
          id,
          deviceId,
          timerType: actuator.timerType,
          presetMs,
          a: net(actuator.terminals[0]),
          b: net(actuator.terminals[1]),
        });
      } else {
        actuators.push({
          kind: 'manual',
          id,
          deviceId,
          action: actuator.action,
          initialState: initialManualState(actuator.action, device.props),
        });
        manualOf.set(deviceId, id);
      }
    }

    for (const contact of def.internals.contacts) {
      const id = `${deviceId}:${contact.a}-${contact.b}`;
      contacts.push({
        id,
        deviceId,
        actuatorId: `${deviceId}:${contact.actuator}`,
        normal: contact.normal,
        a: net(contact.a),
        b: net(contact.b),
        ...(contact.position === undefined ? {} : { position: contact.position }),
      });
      own.contacts.push(id);
      deviceOf.set(id, deviceId);
    }

    for (const load of def.internals.loads) {
      const id = `${deviceId}:${load.a}-${load.b}`;
      loads.push({ id, deviceId, a: net(load.a), b: net(load.b), look: load.look });
      own.loads.push(id);
      deviceOf.set(id, deviceId);
    }

    elementsOf.set(deviceId, mine);
  }

  const contactsOf = new Map<ElementId, ElementId[]>();
  for (const contact of contacts) {
    const list = contactsOf.get(contact.actuatorId);
    if (list) list.push(contact.id);
    else contactsOf.set(contact.actuatorId, [contact.id]);
  }

  return {
    sources,
    actuators,
    contacts,
    loads,
    nets: [...allNets].sort(),
    actuatorById: new Map(actuators.map((a) => [a.id, a])),
    contactById: new Map(contacts.map((c) => [c.id, c])),
    contactsOf,
    elementsOf,
    deviceOf,
    manualOf,
  };
}

function initialManualState(action: ManualAction, props: Readonly<Record<string, unknown>>): number {
  if (action === 'maintained') return props.initiallyActuated === true ? 1 : 0;
  if (action === 'selector') {
    const pos = props.initialPosition;
    return pos === 1 || pos === 2 ? pos : 0;
  }
  // Momentáneo y enclavado (parada de emergencia, I2) arrancan sin accionar.
  return 0;
}
