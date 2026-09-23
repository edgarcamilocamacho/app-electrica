/** Fixtures para documentos de tablero: aparatos y cables a mano, con ids deterministas. */
import { boardRegistry } from '../../src/core/board/catalog';
import type { BoardDocument, TerminalRef, WireColor, WireEnd, WireGauge } from '../../src/core/board/model';
import {
  DEFAULT_WIRE_COLOR,
  DEFAULT_WIRE_GAUGE,
  emptyBoard,
  endPosition,
  terminalOf,
  toTerminal,
} from '../../src/core/board/model';
import { defaultDeviceProps, findTerminal } from '../../src/core/board/registry';
import { autoRoute, bendsOf } from '../../src/core/board/wireGeometry';
import { createCounterIdGen, type IdGen } from '../../src/core/model/ids';
import type { Point, Rotation } from '../../src/core/model/types';

const META = {
  name: 'Prueba',
  createdAt: '2026-01-01T00:00:00.000Z',
  modifiedAt: '2026-01-01T00:00:00.000Z',
};

export const registry = boardRegistry;

export interface WireOptions {
  readonly bends?: readonly Point[];
  readonly color?: WireColor;
  readonly gauge?: WireGauge;
}

export class BoardBuilder {
  doc: BoardDocument = emptyBoard(META);
  /** Mismo generador que usan las operaciones en los tests, para que no colisionen los ids. */
  readonly ids: IdGen = createCounterIdGen();

  device(type: string, x: number, y: number, props: Record<string, unknown> = {}, rotation: Rotation = 0): string {
    const id = this.ids.next('d');
    const def = registry.require(type);
    this.doc = {
      ...this.doc,
      devices: {
        ...this.doc.devices,
        [id]: { id, type, position: { x, y }, rotation, props: { ...defaultDeviceProps(def), ...props } },
      },
    };
    return id;
  }

  /** Cable entre dos bornes. Sin codos explícitos usa la ruta automática. */
  wire(a: WireEnd, b: WireEnd, options: WireOptions = {}): string {
    const id = this.ids.next('w');
    const bends = options.bends ?? bendsOf(this.autoRouteBetween(a, b));
    this.doc = {
      ...this.doc,
      wires: {
        ...this.doc.wires,
        [id]: {
          id,
          a,
          b,
          bends,
          color: options.color ?? DEFAULT_WIRE_COLOR,
          gauge: options.gauge ?? DEFAULT_WIRE_GAUGE,
        },
      },
    };
    return id;
  }

  position(end: WireEnd | TerminalRef): Point {
    const asEnd: WireEnd = 'kind' in end ? end : toTerminal(end);
    return endPosition(this.doc, registry, asEnd);
  }

  private autoRouteBetween(a: WireEnd, b: WireEnd): Point[] {
    const dirOf = (end: WireEnd): 'N' | 'E' | 'S' | 'W' => {
      const r = terminalOf(end);
      if (!r) return 'N';
      const def = registry.require(this.doc.devices[r.deviceId]!.type);
      return findTerminal(def, r.terminalId)!.dir;
    };
    return autoRoute(this.position(a), dirOf(a), this.position(b), dirOf(b));
  }
}

export const term = (deviceId: string, terminalId: string): WireEnd => toTerminal({ deviceId, terminalId });

/** Referencia cruda del borne, cuando hace falta la posición y no la punta del cable. */
export const ref = (deviceId: string, terminalId: string): TerminalRef => ({ deviceId, terminalId });
