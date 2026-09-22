/** Fixtures para documentos de tablero: aparatos y cables a mano, con ids deterministas. */
import { boardRegistry } from '../../src/core/board/catalog';
import type { BoardDocument, TerminalRef, WireColor, WireGauge } from '../../src/core/board/model';
import {
  DEFAULT_WIRE_COLOR,
  DEFAULT_WIRE_GAUGE,
  emptyBoard,
  terminalPosition,
} from '../../src/core/board/model';
import { defaultDeviceProps, findTerminal } from '../../src/core/board/registry';
import { autoRoute, bendsOf } from '../../src/core/board/wireGeometry';
import type { Point } from '../../src/core/model/types';

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
  private devices = 0;
  private wires = 0;

  device(type: string, x: number, y: number, props: Record<string, unknown> = {}): string {
    this.devices += 1;
    const id = `d${this.devices}`;
    const def = registry.require(type);
    this.doc = {
      ...this.doc,
      devices: {
        ...this.doc.devices,
        [id]: { id, type, position: { x, y }, props: { ...defaultDeviceProps(def), ...props } },
      },
    };
    return id;
  }

  /** Cable entre dos bornes. Sin codos explícitos usa la ruta automática. */
  wire(a: TerminalRef, b: TerminalRef, options: WireOptions = {}): string {
    this.wires += 1;
    const id = `w${this.wires}`;
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

  position(ref: TerminalRef): Point {
    return terminalPosition(this.doc, registry, ref);
  }

  private autoRouteBetween(a: TerminalRef, b: TerminalRef): Point[] {
    const da = registry.require(this.doc.devices[a.deviceId]!.type);
    const db = registry.require(this.doc.devices[b.deviceId]!.type);
    return autoRoute(
      this.position(a),
      findTerminal(da, a.terminalId)!.dir,
      this.position(b),
      findTerminal(db, b.terminalId)!.dir,
    );
  }
}

export const term = (deviceId: string, terminalId: string): TerminalRef => ({ deviceId, terminalId });
