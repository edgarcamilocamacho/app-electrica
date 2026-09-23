import { describe, expect, it } from 'vitest';
import { boardRegistry } from '../../../src/core/board/catalog';
import { computeNets } from '../../../src/core/board/nets';
import { createBoardStore, docOf, selectionOf, type BoardStore } from '../../../src/app/board/store';
import { terminalPosition } from '../../../src/core/board/model';
import { isOrthogonalRoute, wireRoute } from '../../../src/core/board/wireGeometry';
import { createCounterIdGen } from '../../../src/core/model/ids';
import { selectorBoard } from '../../../src/examples/board';

const makeStore = (): BoardStore =>
  createBoardStore({ ids: createCounterIdGen(), registry: boardRegistry, now: () => 0 });

const place = (store: BoardStore, type: string, x: number, y: number): string => {
  store.getState().startPlacing(type, { x, y });
  store.getState().place({ x, y });
  const doc = docOf(store.getState());
  return Object.keys(doc.devices)[Object.keys(doc.devices).length - 1]!;
};

/** ¿La ruta vuelve sobre sí misma? Eso es lo que se ve como "cuadrados raros". */
const hasReversal = (route: readonly { x: number; y: number }[]): boolean => {
  for (let i = 2; i < route.length; i += 1) {
    const a = route[i - 2]!;
    const b = route[i - 1]!;
    const c = route[i]!;
    const d1 = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
    const d2 = { x: Math.sign(c.x - b.x), y: Math.sign(c.y - b.y) };
    if (d1.x === -d2.x && d1.y === -d2.y && (d2.x !== 0 || d2.y !== 0)) return true;
  }
  return false;
};

const wireUp = (store: BoardStore, a: [string, string], b: [string, string]): void => {
  store.getState().beginWire({ deviceId: a[0], terminalId: a[1] });
  store.getState().finishWire({ deviceId: b[0], terminalId: b[1] });
};

describe('tienda del tablero — edición', () => {
  it('coloca un aparato, lo selecciona y deshacer lo saca', () => {
    const store = makeStore();
    const id = place(store, 'contactor-3p', 0, 0);
    expect(Object.keys(docOf(store.getState()).devices)).toEqual([id]);
    expect(selectionOf(store.getState()).devices).toEqual([id]);
    store.getState().undo();
    expect(Object.keys(docOf(store.getState()).devices)).toHaveLength(0);
    store.getState().redo();
    expect(Object.keys(docOf(store.getState()).devices)).toEqual([id]);
  });

  it('no coloca encima de otro aparato y deja la vista previa marcada', () => {
    const store = makeStore();
    place(store, 'contactor-3p', 0, 0);
    store.getState().startPlacing('contactor-3p', { x: 4, y: 0 });
    store.getState().place({ x: 4, y: 0 });
    expect(Object.keys(docOf(store.getState()).devices)).toHaveLength(1);
    expect(store.getState().preview?.ok).toBe(false);
    expect(store.getState().placing).toBeDefined();
  });

  it('cablea dos bornes y quedan en la misma red', () => {
    const store = makeStore();
    const g = place(store, 'supply-1p', 0, 0);
    const h = place(store, 'pilot-lamp', 0, 40);
    wireUp(store, [g, 'L'], [h, 'X1']);
    const doc = docOf(store.getState());
    expect(Object.keys(doc.wires)).toHaveLength(1);
    expect(
      computeNets(doc, boardRegistry).connected({ deviceId: g, terminalId: 'L' }, { deviceId: h, terminalId: 'X1' }),
    ).toBe(true);
    expect(store.getState().wiring).toBeUndefined();
  });

  it('el trazado siempre queda ortogonal, aunque los clics sean en diagonal', () => {
    const store = makeStore();
    const g = place(store, 'supply-1p', 0, 0);
    const h = place(store, 'pilot-lamp', 40, 40);
    store.getState().beginWire({ deviceId: g, terminalId: 'L' });
    // Clics en diagonal respecto del último punto: cada uno se resuelve en L.
    store.getState().addBend({ x: 14, y: 22 });
    store.getState().addBend({ x: 30, y: 31 });
    store.getState().finishWire({ deviceId: h, terminalId: 'X1' });

    const doc = docOf(store.getState());
    const wire = Object.values(doc.wires)[0]!;
    const route = wireRoute(doc, boardRegistry, wire);
    expect(isOrthogonalRoute(route)).toBe(true);
    expect(route[0]).toEqual(terminalPosition(doc, boardRegistry, { deviceId: g, terminalId: 'L' }));
    expect(route[route.length - 1]).toEqual(
      terminalPosition(doc, boardRegistry, { deviceId: h, terminalId: 'X1' }),
    );
  });

  it('el trazado nunca vuelve sobre sí mismo, aunque los clics vayan y vengan', () => {
    const store = makeStore();
    const q = place(store, 'breaker-1p', 0, 0);
    const k = place(store, 'contactor-3p', 50, 40);
    store.getState().beginWire({ deviceId: q, terminalId: '2' }); // borne de abajo: sale al sur
    store.getState().addBend({ x: 30, y: 20 });
    store.getState().addBend({ x: 30, y: 6 }); // el usuario vuelve hacia arriba
    store.getState().addBend({ x: 36, y: 6 });
    store.getState().finishWire({ deviceId: k, terminalId: '5' }); // borne de arriba: entra por arriba

    const doc = docOf(store.getState());
    const wire = Object.values(doc.wires)[0];
    expect(wire).toBeDefined();
    const route = wireRoute(doc, boardRegistry, wire!);
    expect(isOrthogonalRoute(route)).toBe(true);
    expect(hasReversal(route)).toBe(false);
  });

  it('un cable que pasaría por un borne ajeno se rechaza con motivo y el trazado sigue vivo', () => {
    const store = makeStore();
    const q = place(store, 'breaker-1p', 0, 0);
    const k = place(store, 'contactor-3p', 50, 40);
    store.getState().beginWire({ deviceId: q, terminalId: '2' });
    // Pasa justo por la columna del borne A1 del contactor (x = 44).
    store.getState().addBend({ x: 44, y: 20 });
    store.getState().addBend({ x: 44, y: 6 });
    store.getState().finishWire({ deviceId: k, terminalId: '5' });

    expect(Object.keys(docOf(store.getState()).wires)).toHaveLength(0);
    expect(store.getState().wiring).toBeDefined();
    expect(store.getState().status?.text).toContain('borne');
  });

  it('al pasar el cursor por un borne, el trazado avisa si no se va a poder conectar', () => {
    const store = makeStore();
    const q = place(store, 'breaker-1p', 0, 0);
    const k = place(store, 'contactor-3p', 50, 40);
    store.getState().beginWire({ deviceId: q, terminalId: '2' });
    store.getState().addBend({ x: 44, y: 20 });
    store.getState().addBend({ x: 44, y: 6 });
    store.getState().moveWireCursor({ x: 50, y: 33 }, { deviceId: k, terminalId: '5' });
    expect(store.getState().wiring?.invalid).toBeTruthy();

    store.getState().undoBend();
    store.getState().addBend({ x: 36, y: 6 });
    store.getState().moveWireCursor({ x: 50, y: 33 }, { deviceId: k, terminalId: '5' });
    expect(store.getState().wiring?.invalid).toBeUndefined();
  });

  it('el cable sale perpendicular al tornillo y Retroceso deshace el último codo', () => {
    const store = makeStore();
    const g = place(store, 'supply-1p', 0, 0);
    store.getState().beginWire({ deviceId: g, terminalId: 'L' });
    expect(store.getState().wiring?.points).toHaveLength(2);
    store.getState().addBend({ x: 20, y: 20 });
    expect(store.getState().wiring!.points.length).toBeGreaterThan(2);
    const before = store.getState().wiring!.points.length;
    store.getState().undoBend();
    expect(store.getState().wiring!.points).toHaveLength(before - 1);
  });

  it('el cable guarda el color y el calibre elegidos [R5 §3, §5]', () => {
    const store = makeStore();
    const g = place(store, 'supply-1p', 0, 0);
    const h = place(store, 'pilot-lamp', 0, 40);
    store.getState().setWireLook('green', 3);
    wireUp(store, [g, 'L'], [h, 'X1']);
    const wire = Object.values(docOf(store.getState()).wires)[0]!;
    expect(wire.color).toBe('green');
    expect(wire.gauge).toBe(3);
  });

  it('mover un aparato conserva sus cables; soltar en inválido lo devuelve', () => {
    const store = makeStore();
    const g = place(store, 'supply-1p', 0, 0);
    const h = place(store, 'pilot-lamp', 0, 40);
    wireUp(store, [g, 'L'], [h, 'X1']);

    store.getState().selectDevice(h);
    store.getState().beginDrag({ x: 0, y: 40 });
    store.getState().updateDrag({ x: 14, y: 40 });
    store.getState().endDrag();
    expect(docOf(store.getState()).devices[h]!.position).toEqual({ x: 14, y: 40 });

    // Encima de la acometida: no se puede soltar y todo queda donde estaba.
    store.getState().beginDrag({ x: 14, y: 40 });
    store.getState().updateDrag({ x: 0, y: 0 });
    store.getState().endDrag();
    expect(docOf(store.getState()).devices[h]!.position).toEqual({ x: 14, y: 40 });
    expect(store.getState().status?.tone).toBe('warning');
  });

  it('borrar un aparato borra sus cables [R5 §4]', () => {
    const store = makeStore();
    const g = place(store, 'supply-1p', 0, 0);
    const h = place(store, 'pilot-lamp', 0, 40);
    wireUp(store, [g, 'L'], [h, 'X1']);
    store.getState().eraseAt({ kind: 'device', id: h });
    const doc = docOf(store.getState());
    expect(Object.keys(doc.devices)).toEqual([g]);
    expect(Object.keys(doc.wires)).toHaveLength(0);
  });

  it('girar lo seleccionado es una entrada de historial y deshacer lo devuelve [R5 §19]', () => {
    const store = makeStore();
    const lamp = place(store, 'pilot-lamp', 20, 20);
    store.getState().setSelection({ devices: [lamp], wires: [], annotations: [] });
    const before = terminalPosition(docOf(store.getState()), boardRegistry, {
      deviceId: lamp,
      terminalId: 'X1',
    });

    store.getState().rotate();
    expect(docOf(store.getState()).devices[lamp]!.rotation).toBe(90);
    store.getState().undo();
    expect(docOf(store.getState()).devices[lamp]!.rotation).toBe(0);
    expect(terminalPosition(docOf(store.getState()), boardRegistry, { deviceId: lamp, terminalId: 'X1' })).toEqual(
      before,
    );
  });

  it('girar mientras se coloca deja el aparato ya girado [R5 §19]', () => {
    const store = makeStore();
    store.getState().startPlacing('pilot-lamp', { x: 20, y: 20 });
    store.getState().rotate();
    expect(store.getState().placing?.rotation).toBe(90);
    store.getState().place({ x: 20, y: 20 });
    const doc = docOf(store.getState());
    const placed = Object.values(doc.devices)[0]!;
    expect(placed.rotation).toBe(90);
  });

  it('cada borrado es una entrada de historial', () => {
    const store = makeStore();
    const g = place(store, 'supply-1p', 0, 0);
    const h = place(store, 'pilot-lamp', 0, 40);
    store.getState().eraseAt({ kind: 'device', id: h });
    store.getState().eraseAt({ kind: 'device', id: g });
    expect(Object.keys(docOf(store.getState()).devices)).toHaveLength(0);
    store.getState().undo();
    expect(Object.keys(docOf(store.getState()).devices)).toEqual([g]);
    store.getState().undo();
    expect(Object.keys(docOf(store.getState()).devices)).toHaveLength(2);
  });
});

describe('tienda del tablero — simulación', () => {
  it('arranca, el pulsador enciende el piloto y al detener vuelve a edición', () => {
    const store = makeStore();
    const g = place(store, 'supply-1p', 0, 0);
    const s = place(store, 'pushbutton-no', 30, 0);
    const h = place(store, 'pilot-lamp', 60, 0);
    wireUp(store, [g, 'L'], [s, '13']);
    wireUp(store, [s, '14'], [h, 'X1']);
    wireUp(store, [g, 'N'], [h, 'X2']);

    store.getState().startSim();
    expect(store.getState().mode).toBe('simulating');
    expect(store.getState().sim?.devices.get(h)?.energized).toBe(false);

    store.getState().pressDevice(s);
    expect(store.getState().sim?.devices.get(h)?.energized).toBe(true);
    store.getState().releaseDevice(s);
    expect(store.getState().sim?.devices.get(h)?.energized).toBe(false);

    store.getState().stopSim();
    expect(store.getState().mode).toBe('edit');
    expect(store.getState().sim).toBeNull();
  });

  it('un clic pasa el selector a la siguiente posición y cambia el circuito [R5 §23]', () => {
    const store = makeStore();
    store.getState().loadDocument(selectorBoard({ ids: createCounterIdGen(), registry: boardRegistry }));
    const idOf = (ref: string) => Object.values(docOf(store.getState()).devices).find((d) => d.props.ref === ref)!.id;
    const selector = idOf('S1');
    const lit = (ref: string) => store.getState().sim?.devices.get(idOf(ref))?.energized === true;

    store.getState().startSim();
    expect([lit('H1'), lit('H2')]).toEqual([false, false]);

    // Arranca en 0: el primer clic lo lleva a II, el segundo a I y el tercero vuelve a 0.
    store.getState().turnSelector(selector);
    expect([lit('H1'), lit('H2')]).toEqual([false, true]);
    store.getState().turnSelector(selector);
    expect([lit('H1'), lit('H2')]).toEqual([true, false]);
    store.getState().turnSelector(selector);
    expect([lit('H1'), lit('H2')]).toEqual([false, false]);
  });

  it('un corto deja la simulación en ERROR y solo se sale volviendo a editar [R5 §14]', () => {
    const store = makeStore();
    const g = place(store, 'supply-1p', 0, 0);
    wireUp(store, [g, 'L'], [g, 'N']);
    store.getState().startSim();
    expect(store.getState().mode).toBe('error');
    expect(store.getState().sim?.fault?.kind).toBe('short');
    store.getState().backToEdit();
    expect(store.getState().mode).toBe('edit');
  });
});
