import { describe, expect, it } from 'vitest';
import { canUndo } from '../../src/core/history/history';
import { serializeDocument } from '../../src/core/persistence/serialize';
import { createAppServices } from '../../src/app/services';
import { ManualClock } from '../../src/platform/clock';
import { AUTOSAVE_KEY, memoryStorage } from '../../src/platform/storage';
import { selectionOfState } from '../../src/app/store/editorStore';
import { buildExample } from '../../src/examples';
import { click, createTestStore, doc, move } from './helpers';
import { normalFormViolations } from '../fixtures/invariants';
import { defaultRegistry } from '../../src/core/registry/catalog';
import { spans } from '../fixtures/queries';

const components = (store: ReturnType<typeof createTestStore>['store']) => Object.values(doc(store).components);
const refOf = (store: ReturnType<typeof createTestStore>['store'], ref: string) => components(store).find((c) => c.props.ref === ref)!;

/** Invariante transversal: tras cada acción el documento está en forma normal. */
function expectNormal(store: ReturnType<typeof createTestStore>['store']) {
  expect(normalFormViolations(doc(store), defaultRegistry)).toEqual([]);
}

describe('herramienta Colocar', () => {
  it('el componente sigue al cursor, R rota antes de colocar, y la colocación se repite hasta Esc', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().startPlacing('lamp');
    move(store, 10, 10);
    expect(s().preview?.ok).toBe(true);
    s().rotate();
    expect(s().tool).toMatchObject({ kind: 'place', rotation: 90 });
    click(store, 10, 10);
    click(store, 20, 10);
    click(store, 30, 10);
    expect(components(store)).toHaveLength(3);
    expect(components(store).every((c) => c.rotation === 90)).toBe(true);
    expect(s().tool.kind).toBe('place');
    s().cancel();
    expect(s().tool.kind).toBe('select');
    expect(s().preview).toBeNull();
    expectNormal(store);
  });

  it('asigna referencias consecutivas (H1, H2)', () => {
    const { store } = createTestStore();
    store.getState().startPlacing('lamp');
    click(store, 0, 0);
    click(store, 10, 0);
    expect(components(store).map((c) => c.props.ref).sort()).toEqual(['H1', 'H2']);
  });

  it('soltar sobre un cable inserta en serie (R3 Q3.3)', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().setTool('wire');
    click(store, 0, 0);
    click(store, 0, 20);
    s().wireFinish();
    s().startPlacing('switch-no');
    click(store, 0, 10);
    expect(spans(doc(store))).toEqual(['0,0-0,7', '0,13-0,20']);
  });
});

describe('herramienta Cable', () => {
  it('clics fijan codos; un clic sobre un terminal termina y conecta', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().startPlacing('lamp');
    click(store, 20, 10); // X1 en (20,7)
    s().setTool('wire');
    click(store, 0, 0);
    click(store, 20, 0);
    expect(s().tool).toMatchObject({ kind: 'wire', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] });
    click(store, 20, 7);
    expect(s().tool).toMatchObject({ kind: 'wire', points: [] });
    expect(spans(doc(store))).toEqual(['0,0-20,0', '20,0-20,7']);
    expect(Object.values(doc(store).vertices).some((v) => v.kind === 'terminal')).toBe(true);
    expectNormal(store);
  });

  it('Enter termina con extremo libre; Retroceso deshace el último tramo; Esc descarta', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().setTool('wire');
    click(store, 0, 0);
    click(store, 10, 0);
    click(store, 10, 10);
    s().wireBack();
    expect(s().tool).toMatchObject({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
    s().cancel();
    expect(s().tool).toMatchObject({ points: [] });
    expect(Object.keys(doc(store).segments)).toHaveLength(0);
    click(store, 0, 0);
    move(store, 6, 0);
    s().wireFinish();
    expect(spans(doc(store))).toEqual(['0,0-6,0']);
  });

  it('un cable que se superpondría a otra red se rechaza con un mensaje', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().setTool('wire');
    click(store, 0, 0);
    move(store, 10, 0);
    s().wireFinish();
    click(store, -5, 0);
    move(store, 15, 0);
    s().wireFinish();
    expect(s().message?.key).toBe('messages.invalidWire');
    expect(Object.keys(doc(store).segments)).toHaveLength(1);
  });

  it('derivar desde el medio de un cable crea un junction', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().setTool('wire');
    click(store, 0, 0);
    move(store, 10, 0);
    s().wireFinish();
    click(store, 4, 0);
    move(store, 4, 6);
    s().wireFinish();
    expect([...s().vertexClasses.values()]).toContain('junction');
  });
});

/** Bobina K1 arriba y lámpara H1 abajo, unidas por un cable recto, con la UI. */
function coilAndLamp() {
  const t = createTestStore();
  const s = () => t.store.getState();
  s().startPlacing('coil');
  click(t.store, 10, -5);
  s().startPlacing('lamp');
  click(t.store, 10, 5);
  s().setTool('wire');
  click(t.store, 10, -2);
  click(t.store, 10, 2);
  s().setTool('select');
  return t;
}

describe('herramienta Mover (clic-tomar / clic-colocar, R2 §2)', () => {
  it('toma con un clic, sigue al cursor y suelta con otro clic en una sola entrada de historial', () => {
    const { store } = coilAndLamp();
    const s = () => store.getState();
    const before = s().history.past.length;
    s().setTool('move');
    click(store, 10, 5); // cuerpo de la lámpara
    expect(s().tool).toMatchObject({ kind: 'move', carry: { anchor: { x: 10, y: 5 } } });
    move(store, 12, 8);
    move(store, 14, 8);
    expect(s().preview?.ok).toBe(true);
    click(store, 14, 8);
    expect(s().tool).toMatchObject({ kind: 'move' });
    expect((s().tool as { carry?: unknown }).carry).toBeUndefined();
    expect(refOf(store, 'H1').position).toEqual({ x: 14, y: 8 });
    expect(s().history.past.length).toBe(before + 1);
    expectNormal(store);
  });

  it('Esc suelta sin cambios', () => {
    const { store } = coilAndLamp();
    const s = () => store.getState();
    const snapshot = serializeDocument(doc(store));
    s().setTool('move');
    click(store, 10, 5);
    move(store, 20, 20);
    s().cancel();
    expect(serializeDocument(doc(store))).toBe(snapshot);
  });

  it('un clic en posición inválida no confirma y el objeto sigue tomado', () => {
    const { store } = coilAndLamp();
    const s = () => store.getState();
    s().setTool('wire');
    click(store, 0, 20);
    move(store, 30, 20);
    s().wireFinish();
    s().setTool('move');
    click(store, 10, 5);
    move(store, 10, 23); // X1 (conectado) caería sobre el cable de otra red
    click(store, 10, 23);
    expect(s().preview?.ok).toBe(false);
    expect(s().message?.key).toBe('messages.invalidPlacement');
    expect((s().tool as { carry?: unknown }).carry).toBeDefined();
  });

  it('R rota el componente tomado; con un grupo tomado está desactivado', () => {
    const { store } = coilAndLamp();
    const s = () => store.getState();
    s().setTool('move');
    click(store, 10, 5);
    s().rotate();
    click(store, 10, 5);
    expect(refOf(store, 'H1').rotation).toBe(90);
    s().selectAll();
    click(store, 10, -5);
    s().rotate();
    expect(s().message?.key).toBe('messages.groupRotateDisabled');
  });

  it('mover un segmento solo lo desplaza en su eje perpendicular (R2 §3)', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().setTool('wire');
    click(store, 0, 0);
    click(store, 10, 0);
    click(store, 10, 5);
    s().wireFinish();
    s().setTool('move');
    click(store, 5, 0); // tramo horizontal
    move(store, 9, -3); // el desplazamiento horizontal se ignora
    click(store, 9, -3);
    expect(spans(doc(store))).toEqual(['0,-3-10,-3', '10,-3-10,5']);
  });

  it('deshacer devuelve posición y geometría exactas', () => {
    const { store } = coilAndLamp();
    const s = () => store.getState();
    const before = serializeDocument(doc(store));
    s().setTool('move');
    click(store, 10, 5);
    move(store, 16, 9);
    click(store, 16, 9);
    expect(serializeDocument(doc(store))).not.toBe(before);
    s().undo();
    expect(serializeDocument(doc(store))).toBe(before);
    s().redo();
    expect(refOf(store, 'H1').position).toEqual({ x: 16, y: 9 });
  });
});

describe('herramienta Borrar y borrado de selección (R2 §5, §30.1)', () => {
  it('cada clic de la goma es una entrada de historial; la herramienta sigue activa', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    for (const x of [0, 10, 20, 30]) {
      s().startPlacing('lamp');
      click(store, x, 0);
    }
    s().setTool('erase');
    for (const x of [0, 10, 20, 30]) click(store, x, 0);
    expect(components(store)).toHaveLength(0);
    expect(s().tool.kind).toBe('erase');
    s().undo();
    expect(components(store).map((c) => c.position.x)).toEqual([30]);
    s().undo();
    expect(components(store).map((c) => c.position.x).sort()).toEqual([20, 30]);
  });

  it('pasar el mouse sin hacer clic no borra nada', () => {
    const { store } = coilAndLamp();
    store.getState().setTool('erase');
    move(store, 10, 5);
    move(store, 10, 0);
    expect(components(store)).toHaveLength(2);
  });

  it('borrar una selección múltiple con Supr es una sola entrada', () => {
    const { store } = coilAndLamp();
    const s = () => store.getState();
    s().selectAll();
    s().deleteSelection();
    expect(components(store)).toHaveLength(0);
    s().undo();
    expect(components(store)).toHaveLength(2);
  });

  it('el rectángulo de selección toma lo que queda completamente adentro', () => {
    const { store } = coilAndLamp();
    const s = () => store.getState();
    s().pointerDown({ x: 5, y: 0 }, { shift: false });
    move(store, 15, 10);
    s().pointerUp({ x: 15, y: 10 });
    expect(selectionOfState(s()).components).toEqual([refOf(store, 'H1').id]);
  });
});

describe('copiar, pegar y duplicar (R2 §13)', () => {
  it('Ctrl+D duplica tomado siguiendo al cursor y renumera', () => {
    const { store } = coilAndLamp();
    const s = () => store.getState();
    s().setSelection({ components: [refOf(store, 'K1').id], segments: [], annotations: [] });
    move(store, 30, -8);
    s().duplicate();
    expect(s().tool).toMatchObject({ kind: 'move' });
    click(store, 30, -8);
    expect(components(store).map((c) => c.props.ref).sort()).toEqual(['H1', 'K1', 'K2']);
  });

  it('copiar sin selección avisa; pegar sin portapapeles no hace nada', () => {
    const { store } = createTestStore();
    store.getState().copy();
    expect(store.getState().message?.key).toBe('messages.nothingToCopy');
    store.getState().paste();
    expect(store.getState().tool.kind).toBe('select');
  });
});

describe('propiedades', () => {
  it('editar una propiedad al tipear se agrupa en una entrada', async () => {
    const { createEditorStore } = await import('../../src/app/store/editorStore');
    const { createCounterIdGen } = await import('../../src/core/model/ids');
    let wall = 0;
    const store = createEditorStore({ ctx: { ids: createCounterIdGen(), registry: defaultRegistry }, clock: new ManualClock(), now: () => wall, confirm: () => true });
    store.getState().startPlacing('lamp');
    store.getState().pointerMove({ x: 0, y: 0 });
    store.getState().pointerDown({ x: 0, y: 0 }, { shift: false });
    const id = Object.keys(store.getState().history.present.doc.components)[0]!;
    const past = store.getState().history.past.length;
    for (const text of ['M', 'Mo', 'Mot', 'Motor']) {
      wall += 100; // dentro de la ventana de 500 ms
      store.getState().updateProps(id, { label: text });
    }
    expect(store.getState().history.present.doc.components[id]!.props.label).toBe('Motor');
    expect(store.getState().history.past.length).toBe(past + 1);
    store.getState().undo();
    expect(store.getState().history.present.doc.components[id]!.props.label).toBe('');
  });

  it('vincular un contacto le asigna la referencia derivada (K1.1)', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().startPlacing('coil');
    click(store, 0, 0);
    s().startPlacing('contact-no');
    click(store, 10, 0);
    const contact = components(store).find((c) => c.type === 'contact-no')!;
    s().updateProps(contact.id, { link: 'K1' });
    expect(components(store).find((c) => c.id === contact.id)!.props).toMatchObject({ link: 'K1', ref: 'K1.1' });
  });
});

describe('simulación desde la UI', () => {
  it('no arranca con diagnósticos bloqueantes y enfoca el panel', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().startPlacing('contact-no');
    click(store, 0, 0);
    s().startSimulation();
    expect(s().mode).toBe('edit');
    expect(s().message?.key).toBe('messages.cannotSimulate');
    expect(s().focusDiagnostics).toBe(1);
  });

  it('bloquea la edición estructural y permite inspeccionar', () => {
    const { store } = createTestStore(buildExample('lamp', { name: 'x', note: 'y' }));
    const s = () => store.getState();
    const before = serializeDocument(doc(store));
    s().startSimulation();
    expect(s().mode).toBe('simulating');
    s().setTool('erase');
    expect(s().tool.kind).toBe('select');
    s().deleteSelection();
    s().rotate();
    s().undo();
    expect(serializeDocument(doc(store))).toBe(before);
    s().stopSimulation();
    expect(s().mode).toBe('edit');
  });

  it('interruptor mantenido alterna con un clic; la lámpara enciende', () => {
    const { store } = createTestStore(buildExample('lamp', { name: 'x', note: 'y' }));
    const s = () => store.getState();
    s().startSimulation();
    const sw = refOf(store, 'S1');
    const lamp = refOf(store, 'H1');
    s().pointerDown(sw.position, { shift: false });
    s().pointerUp(sw.position);
    expect(s().simSnapshot?.devices.get(lamp.id)?.energized).toBe(true);
    s().pointerDown(sw.position, { shift: false });
    s().pointerUp(sw.position);
    expect(s().simSnapshot?.devices.get(lamp.id)?.energized).toBe(false);
  });

  it('pulsador momentáneo sigue a pointer-down / pointer-up', () => {
    const { store } = createTestStore(buildExample('seal-in', { name: 'x', note: 'y' }));
    const s = () => store.getState();
    s().startSimulation();
    const stop = refOf(store, 'S2');
    const coil = refOf(store, 'K1');
    const start = refOf(store, 'S3');
    s().pointerDown(start.position, { shift: false });
    expect(s().simSnapshot?.devices.get(start.id)?.actuated).toBe(true);
    s().pointerUp(start.position);
    expect(s().simSnapshot?.devices.get(start.id)?.actuated).toBe(false);
    expect(s().simSnapshot?.devices.get(coil.id)?.energized).toBe(true);
    s().pointerDown(stop.position, { shift: false });
    s().pointerUp(stop.position);
    expect(s().simSnapshot?.devices.get(coil.id)?.energized).toBe(false);
  });

  it('selector: el lado del clic elige la posición', () => {
    const { store } = createTestStore(buildExample('selector', { name: 'x', note: 'y' }));
    const s = () => store.getState();
    s().startSimulation();
    const sel = refOf(store, 'S1');
    s().pointerDown({ x: sel.position.x - 2, y: sel.position.y }, { shift: false });
    expect(s().simSnapshot?.devices.get(sel.id)?.position).toBe(1);
    s().pointerDown({ x: sel.position.x + 2, y: sel.position.y }, { shift: false });
    expect(s().simSnapshot?.devices.get(sel.id)?.position).toBe(2);
    s().pointerDown({ x: sel.position.x, y: sel.position.y }, { shift: false });
    expect(s().simSnapshot?.devices.get(sel.id)?.position).toBe(0);
  });

  it('el temporizador avanza con el reloj y la velocidad elegida', () => {
    const { store, clock } = createTestStore(buildExample('ton', { name: 'x', note: 'y' }));
    const s = () => store.getState();
    s().startSimulation();
    const sw = refOf(store, 'S1');
    const lamp = refOf(store, 'H1');
    s().pointerDown(sw.position, { shift: false });
    s().setSpeed(4);
    clock.advance(740); // 740 ms reales × 4 = 2960 ms de simulación
    s().simTick();
    clock.advance(1);
    s().simTick();
    expect(s().simSnapshot?.devices.get(lamp.id)?.energized).toBe(false);
    clock.advance(20);
    s().simTick();
    clock.advance(200);
    s().simTick();
    expect(s().simSnapshot?.devices.get(lamp.id)?.energized).toBe(true);
  });

  it('un corto lleva a ERROR, congela, y solo se sale con acción explícita', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().startPlacing('ac-source');
    click(store, 0, 0);
    s().setTool('wire');
    click(store, 0, -3);
    click(store, 4, -3);
    click(store, 4, 3);
    click(store, 0, 3);
    s().startSimulation();
    expect(s().mode).toBe('error');
    expect(s().simSnapshot?.fault?.kind).toBe('short');
    s().stopSimulation(); // "Detener" no sale del error
    expect(s().mode).toBe('error');
    s().toggleSimulation();
    expect(s().mode).toBe('error');
    s().exitError();
    expect(s().mode).toBe('edit');
  });
});

describe('archivos y autoguardado', () => {
  it('abrir un archivo inválido muestra un error legible y no toca el documento', () => {
    const { store } = coilAndLamp();
    const before = serializeDocument(doc(store));
    expect(store.getState().loadText('{"schemaVersion": 99}', 'x.json')).toBe(false);
    expect(store.getState().message?.key).toBe('messages.loadFailed');
    expect(serializeDocument(doc(store))).toBe(before);
  });

  it('guardar y volver a abrir conserva la topología exacta', async () => {
    const { store } = coilAndLamp();
    let saved = '';
    store.setState({});
    const files = {
      open: async () => ({ text: saved, fileName: 'c.json' }),
      save: async (text: string, name: string) => {
        saved = text;
        return { fileName: name };
      },
    };
    // Inyectar archivos en una tienda nueva con el mismo documento.
    const { createEditorStore } = await import('../../src/app/store/editorStore');
    const s2 = createEditorStore({ ctx: { ids: (await import('../../src/core/model/ids')).createCounterIdGen(), registry: defaultRegistry }, clock: new ManualClock(), now: () => 0, confirm: () => true, files }, doc(store));
    await s2.getState().save();
    expect(s2.getState().file).toMatchObject({ name: 'Circuito sin título.json', dirty: false });
    s2.getState().newDocument();
    await s2.getState().openFile();
    expect(spans(s2.getState().history.present.doc)).toEqual(spans(doc(store)));
    expect(Object.keys(s2.getState().history.present.doc.components).sort()).toEqual(Object.keys(doc(store).components).sort());
  });

  it('el autoguardado escribe tras editar y se recupera al abrir de nuevo', async () => {
    const storage = memoryStorage();
    const common = { clock: new ManualClock(), storage, confirm: () => true, buildId: 'x', checkVersion: false };
    const first = createAppServices(common);
    first.store.getState().startPlacing('lamp');
    first.store.getState().pointerMove({ x: 0, y: 0 });
    first.store.getState().pointerDown({ x: 0, y: 0 }, { shift: false });
    first.flushAutosave();
    expect(storage.get(AUTOSAVE_KEY)).toContain('lamp');
    first.dispose();

    const second = createAppServices(common);
    expect(Object.values(second.store.getState().history.present.doc.components).map((c) => c.type)).toEqual(['lamp']);
    expect(second.store.getState().toasts.map((x) => x.key)).toEqual(['toasts.restored']);
    // "Empezar uno nuevo"
    second.store.getState().toasts[0]!.actions[0]!.run();
    expect(Object.keys(second.store.getState().history.present.doc.components)).toHaveLength(0);
    expect(canUndo(second.store.getState().history)).toBe(false);
    second.dispose();
  });
});
