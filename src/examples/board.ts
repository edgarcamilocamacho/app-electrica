/**
 * Circuito de ejemplo del tablero: arranque directo con retención y piloto de marcha.
 * Se construye con las operaciones reales, así que siempre cumple las reglas vigentes.
 */
import type { BoardDocument, WireColor, WireEnd } from '../core/board/model';
import { emptyBoard, toTerminal } from '../core/board/model';
import { connect, placeDevice, setDeviceProps, type OpContext } from '../core/board/ops';
import type { Point } from '../core/model/types';

const META = {
  name: 'Arranque directo',
  createdAt: '2026-09-22T00:00:00.000Z',
  modifiedAt: '2026-09-22T00:00:00.000Z',
};

interface Placed {
  readonly id: string;
  readonly doc: BoardDocument;
}

function place(doc: BoardDocument, ctx: OpContext, type: string, position: Point, ref: string): Placed {
  const placed = placeDevice(doc, { type, position }, ctx);
  const id = Object.keys(placed.doc.devices).find((key) => !doc.devices[key])!;
  const named = setDeviceProps(placed.doc, { deviceId: id, props: { ref } }, ctx);
  return { id, doc: named.doc };
}

function wire(doc: BoardDocument, ctx: OpContext, a: WireEnd, b: WireEnd, color: WireColor, bends?: readonly Point[]): BoardDocument {
  return connect(doc, { a, b, color, ...(bends ? { bends } : {}) }, ctx).doc;
}

const t = (deviceId: string, terminalId: string): WireEnd => toTerminal({ deviceId, terminalId });

/** Arranque directo: marcha, paro, retención por el contacto 13-14 y piloto por un polo. */
export function starterBoard(ctx: OpContext): BoardDocument {
  let doc = emptyBoard(META);

  const supply = place(doc, ctx, 'supply-1p', { x: 0, y: 0 }, 'G1');
  doc = supply.doc;
  const breaker = place(doc, ctx, 'breaker-1p', { x: 0, y: 28 }, 'Q1');
  doc = breaker.doc;
  const stop = place(doc, ctx, 'pushbutton-nc', { x: 22, y: 28 }, 'S0');
  doc = stop.doc;
  const start = place(doc, ctx, 'pushbutton-no', { x: 38, y: 28 }, 'S1');
  doc = start.doc;
  const contactor = place(doc, ctx, 'contactor-3p', { x: 64, y: 32 }, 'K1');
  doc = contactor.doc;
  const lamp = place(doc, ctx, 'pilot-lamp', { x: 96, y: 28 }, 'H1');
  doc = lamp.doc;

  const G = supply.id;
  const Q = breaker.id;
  const S0 = stop.id;
  const S1 = start.id;
  const K = contactor.id;
  const H = lamp.id;

  // Mando: L → Q1 → S0 → S1 → A1 ; A2 → N. Los cables rodean los aparatos en vez de cruzarlos.
  doc = wire(doc, ctx, t(G, 'L'), t(Q, '1'), 'brown');
  doc = wire(doc, ctx, t(Q, '2'), t(S0, '11'), 'red', [
    { x: 0, y: 46 },
    { x: 14, y: 46 },
    { x: 14, y: 16 },
    { x: 22, y: 16 },
  ]);
  doc = wire(doc, ctx, t(S0, '12'), t(S1, '13'), 'red', [
    { x: 22, y: 46 },
    { x: 30, y: 46 },
    { x: 30, y: 16 },
    { x: 38, y: 16 },
  ]);
  doc = wire(doc, ctx, t(S1, '14'), t(K, 'A1'), 'red', [
    { x: 38, y: 46 },
    { x: 50, y: 46 },
    { x: 50, y: 17 },
    { x: 58, y: 17 },
  ]);
  doc = wire(doc, ctx, t(K, 'A2'), t(G, 'N'), 'blue', [
    { x: 62, y: 13 },
    { x: -2, y: 13 },
  ]);

  // Retención con el contacto auxiliar 13-14.
  doc = wire(doc, ctx, t(S1, '13'), t(K, '13'), 'red', [
    { x: 38, y: 19 },
    { x: 68, y: 19 },
  ]);
  doc = wire(doc, ctx, t(K, '14'), t(K, 'A1'), 'red', [
    { x: 68, y: 50 },
    { x: 46, y: 50 },
    { x: 46, y: 15 },
    { x: 58, y: 15 },
  ]);

  // Potencia: L → 1/L1 ; 2/T1 → piloto ; piloto → N
  doc = wire(doc, ctx, t(G, 'L'), t(K, '1'), 'brown', [
    { x: 2, y: 10 },
    { x: 56, y: 10 },
  ]);
  doc = wire(doc, ctx, t(K, '2'), t(H, 'X1'), 'brown', [
    { x: 56, y: 56 },
    { x: 88, y: 56 },
    { x: 88, y: 16 },
    { x: 96, y: 16 },
  ]);
  doc = wire(doc, ctx, t(H, 'X2'), t(G, 'N'), 'blue', [
    { x: 96, y: 60 },
    { x: 8, y: 60 },
    { x: 8, y: 11 },
    { x: -2, y: 11 },
  ]);

  return doc;
}

/** Un aparato de cada tipo, en grilla: sirve para revisar el dibujo del catálogo. */
export function catalogBoard(ctx: OpContext): BoardDocument {
  let doc = emptyBoard({ ...META, name: 'Catálogo' });
  const perRow = 4;
  const cellW = 44;
  const cellH = 34;
  ctx.registry.all().forEach((def, i) => {
    const position = { x: (i % perRow) * cellW, y: Math.floor(i / perRow) * cellH };
    const placed = place(doc, ctx, def.type, position, `${def.refPrefix}${i + 1}`);
    doc = placed.doc;
  });
  return doc;
}
