import { describe, expect, it } from 'vitest';
import { boardRegistry } from '../../../src/core/board/catalog';
import { computeNets } from '../../../src/core/board/nets';
import { createBoardStore, docOf, selectionOf, type BoardStore } from '../../../src/app/board/store';
import { createCounterIdGen } from '../../../src/core/model/ids';

const makeStore = (): BoardStore =>
  createBoardStore({ ids: createCounterIdGen(), registry: boardRegistry, now: () => 0 });

const place = (store: BoardStore, type: string, x: number, y: number): string => {
  store.getState().startPlacing(type, { x, y });
  store.getState().place({ x, y });
  const doc = docOf(store.getState());
  return Object.keys(doc.devices)[Object.keys(doc.devices).length - 1]!;
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
