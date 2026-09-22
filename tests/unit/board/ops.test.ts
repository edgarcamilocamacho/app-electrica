import { describe, expect, it } from 'vitest';
import { boardRegistry } from '../../../src/core/board/catalog';
import { terminalPosition } from '../../../src/core/board/model';
import {
  connect,
  moveSelection,
  moveWireSegment,
  placeDevice,
  remove,
  setDeviceProps,
  setWireStyle,
  type OpContext,
} from '../../../src/core/board/ops';
import { computeNets } from '../../../src/core/board/nets';
import { isOrthogonalRoute, wireRoute } from '../../../src/core/board/wireGeometry';
import { createCounterIdGen } from '../../../src/core/model/ids';
import { BoardBuilder, ref, term } from '../../fixtures/board';

const ctx = (b?: BoardBuilder): OpContext => ({ ids: b ? b.ids : createCounterIdGen(), registry: boardRegistry });

const routeOf = (doc: Parameters<typeof wireRoute>[0], id: string) =>
  wireRoute(doc, boardRegistry, doc.wires[id]!);

describe('colocar aparatos', () => {
  it('coloca con las propiedades por defecto del tipo', () => {
    const b = new BoardBuilder();
    const result = placeDevice(b.doc, { type: 'contactor-3p', position: { x: 0, y: 0 } }, ctx(b));
    expect(result.ok).toBe(true);
    const device = Object.values(result.doc.devices)[0]!;
    expect(device.type).toBe('contactor-3p');
    expect(device.props.ref).toBe('');
  });

  it('rechaza colocar encima de otro aparato y deja la vista previa [W4]', () => {
    const b = new BoardBuilder();
    b.device('contactor-3p', 0, 0);
    const result = placeDevice(b.doc, { type: 'contactor-3p', position: { x: 4, y: 0 } }, ctx(b));
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain('W4');
    expect(Object.keys(result.doc.devices)).toHaveLength(2);
  });

  it('rechaza un tipo desconocido', () => {
    const b = new BoardBuilder();
    expect(placeDevice(b.doc, { type: 'motor', position: { x: 0, y: 0 } }, ctx(b)).reason).toBe('INVALID_INPUT');
  });
});

describe('cablear', () => {
  it('conecta dos bornes con ruta automática ortogonal', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    const result = connect(b.doc, { a: term(g, 'L'), b: term(h, 'X1') }, ctx(b));
    expect(result.ok).toBe(true);
    const wire = Object.values(result.doc.wires)[0]!;
    expect(isOrthogonalRoute(routeOf(result.doc, wire.id))).toBe(true);
    expect(computeNets(result.doc, boardRegistry).connected(ref(g, 'L'), ref(h, 'X1'))).toBe(true);
  });

  it('no permite un cable de un borne a sí mismo ni repetir el mismo par', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    expect(connect(b.doc, { a: term(g, 'L'), b: term(g, 'L') }, ctx(b)).reason).toBe('INVALID_INPUT');
    const first = connect(b.doc, { a: term(g, 'L'), b: term(h, 'X1') }, ctx(b));
    expect(connect(first.doc, { a: term(h, 'X1'), b: term(g, 'L') }, ctx(b)).reason).toBe('INVALID_INPUT');
  });

  it('guarda color y calibre y los cambia después [R5 §3, §5]', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    const created = connect(b.doc, { a: term(g, 'L'), b: term(h, 'X1'), color: 'black', gauge: 2 }, ctx(b));
    const id = Object.keys(created.doc.wires)[0]!;
    expect(created.doc.wires[id]!.color).toBe('black');
    expect(created.doc.wires[id]!.gauge).toBe(2);
    const restyled = setWireStyle(created.doc, { wireIds: [id], color: 'blue', gauge: 3 }, ctx(b));
    expect(restyled.ok).toBe(true);
    expect(restyled.doc.wires[id]!.color).toBe('blue');
    expect(restyled.doc.wires[id]!.gauge).toBe(3);
  });

  it('rechaza un cable que se solapa con otro de distinta red [W1]', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h1 = b.device('pilot-lamp', 40, 0);
    const h2 = b.device('pilot-lamp', 80, 0);
    const shared = [
      { x: 20, y: 20 },
      { x: 78, y: 20 },
    ];
    const first = connect(b.doc, { a: term(g, 'L'), b: term(h1, 'X2'), bends: [{ x: -2, y: 20 }, { x: 40, y: 20 }] }, ctx(b));
    const second = connect(first.doc, { a: term(g, 'N'), b: term(h2, 'X2'), bends: [{ x: 2, y: 20 }, ...shared] }, ctx(b));
    expect(second.ok).toBe(false);
    expect(second.violations.map((v) => v.code)).toContain('W1');
  });
});

describe('mover', () => {
  it('mover un aparato conserva la conectividad y reacomoda el cable', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    const wireId = b.wire(term(g, 'L'), term(h, 'X1'));
    const result = moveSelection(b.doc, { devices: [h], delta: { x: 12, y: 0 } }, ctx(b));
    expect(result.ok).toBe(true);
    const route = routeOf(result.doc, wireId);
    expect(isOrthogonalRoute(route)).toBe(true);
    expect(route[route.length - 1]).toEqual(terminalPosition(result.doc, boardRegistry, ref(h, 'X1')));
    expect(computeNets(result.doc, boardRegistry).connected(ref(g, 'L'), ref(h, 'X1'))).toBe(true);
  });

  it('si se mueven los dos extremos, el cable viaja entero', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    const wireId = b.wire(term(g, 'L'), term(h, 'X1'));
    const before = routeOf(b.doc, wireId);
    const result = moveSelection(b.doc, { devices: [g, h], delta: { x: 10, y: 5 } }, ctx(b));
    const after = routeOf(result.doc, wireId);
    expect(after).toEqual(before.map((p) => ({ x: p.x + 10, y: p.y + 5 })));
  });

  it('mover un tramo en perpendicular genera los codos necesarios', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    const wireId = b.wire(term(g, 'L'), term(h, 'X1'));
    const route = routeOf(b.doc, wireId);
    const vertical = route.findIndex((p, i) => i + 1 < route.length && p.x === route[i + 1]!.x);
    const result = moveWireSegment(b.doc, { wireId, segmentIndex: vertical, delta: { x: 6, y: 0 } }, ctx(b));
    expect(result.ok).toBe(true);
    const moved = routeOf(result.doc, wireId);
    expect(isOrthogonalRoute(moved)).toBe(true);
    expect(moved[0]).toEqual(route[0]);
    expect(moved[moved.length - 1]).toEqual(route[route.length - 1]);
  });
});

describe('borrar', () => {
  it('borrar un aparato borra sus cables [R5 §4]', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    b.wire(term(g, 'L'), term(h, 'X1'));
    b.wire(term(g, 'N'), term(h, 'X2'));
    const result = remove(b.doc, { devices: [h] }, ctx(b));
    expect(result.ok).toBe(true);
    expect(Object.keys(result.doc.devices)).toEqual([g]);
    expect(Object.keys(result.doc.wires)).toHaveLength(0);
  });

  it('borrar un cable deja los aparatos en su lugar', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    const wireId = b.wire(term(g, 'L'), term(h, 'X1'));
    const result = remove(b.doc, { wires: [wireId] }, ctx(b));
    expect(Object.keys(result.doc.devices)).toHaveLength(2);
    expect(Object.keys(result.doc.wires)).toHaveLength(0);
  });
});

describe('propiedades', () => {
  it('cambia una propiedad del aparato', () => {
    const b = new BoardBuilder();
    const k = b.device('contactor-3p', 0, 0);
    const result = setDeviceProps(b.doc, { deviceId: k, props: { ref: 'K1' } }, ctx(b));
    expect(result.ok).toBe(true);
    expect(result.doc.devices[k]!.props.ref).toBe('K1');
  });
});
