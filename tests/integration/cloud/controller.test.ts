/**
 * Controlador de sincronización con dos «pestañas» sobre el mismo backend en memoria [R6]
 * (PLAN §24.3). Reloj falso: el tiempo lo empuja la prueba.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoardStore, docOf, type BoardStore } from '../../../src/app/board/store';
import { CloudController, STORAGE_KEYS } from '../../../src/app/cloud/controller';
import { boardRegistry } from '../../../src/core/board/catalog';
import { serializeBoard } from '../../../src/core/board/persistence';
import { createMemoryCloud, type MemoryCloud } from '../../../src/core/cloud/memoryApi';
import { LEASE_HEARTBEAT_MS, LEASE_TTL_MS, VIEWER_POLL_MS, type CloudApi } from '../../../src/core/cloud/types';
import { createCounterIdGen, createRandomIdGen } from '../../../src/core/model/ids';
import { memoryStorage, type KeyValueStorage } from '../../../src/platform/storage';
import { selectorBoard, starterBoard } from '../../../src/examples/board';

interface Tab {
  readonly board: BoardStore;
  readonly ctrl: CloudController;
  readonly storage: KeyValueStorage;
  readonly downloads: { text: string; fileName: string }[];
}

const tabs: Tab[] = [];

function openTab(api: CloudApi, name: string, storage: KeyValueStorage = memoryStorage()): Tab {
  const board = createBoardStore({ ids: createRandomIdGen(), registry: boardRegistry });
  storage.set(STORAGE_KEYS.nickname, name);
  const downloads: { text: string; fileName: string }[] = [];
  const ctrl = new CloudController({
    api,
    board,
    storage,
    example: (key) =>
      (key === 'selector' ? selectorBoard : starterBoard)({ ids: createCounterIdGen(), registry: boardRegistry }),
    names: { untitled: 'Tablero nuevo', copyOf: (n) => `${n} (copia)` },
    session: `sesion-${name.toLowerCase()}`,
    download: (text, fileName) => downloads.push({ text, fileName }),
  });
  const tab = { board, ctrl, storage, downloads };
  tabs.push(tab);
  return tab;
}

/** Una edición cualquiera: un texto nuevo en el tablero. */
const edit = (tab: Tab, text = 'nota'): void => tab.board.getState().addText({ x: 50 + tabs.indexOf(tab), y: 50 }, text);
const notes = (tab: Tab): string[] => Object.values(docOf(tab.board.getState()).annotations).map((n) => n.text);
const role = (tab: Tab) => tab.ctrl.ui.getState().current?.role;
const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('controlador de tableros en el servidor', () => {
  let cloud: MemoryCloud;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-09-23T12:00:00Z'));
    cloud = createMemoryCloud();
  });

  afterEach(() => {
    for (const tab of tabs.splice(0)) tab.ctrl.dispose();
    vi.useRealTimers();
  });

  it('con el servidor vacío arranca con el ejemplo y queda editando', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    const ui = a.ctrl.ui.getState();
    expect(ui.ready).toBe(true);
    expect(ui.docs.map((d) => d.name)).toEqual(['Arranque directo']);
    expect(ui.current).toMatchObject({ name: 'Arranque directo', role: 'editor', version: 1 });
    expect(a.board.getState().readOnly).toBe(false);
    expect(Object.keys(docOf(a.board.getState()).devices).length).toBeGreaterThan(0);
  });

  it('guarda solo, con antirrebote, y quien mira ve el cambio [R6 §2, §5]', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    const b = openTab(cloud.api, 'Beto');
    await b.ctrl.start();
    expect(role(b)).toBe('viewer');
    expect(b.ctrl.ui.getState().current?.editor).toEqual({ name: 'Ana' });
    expect(b.board.getState().readOnly).toBe(true);

    edit(a, 'hola');
    expect(a.ctrl.ui.getState().save).toBe('pending');
    await tick(1000);
    expect(a.ctrl.ui.getState().save).toBe('saved');
    expect(a.ctrl.ui.getState().current?.version).toBe(2);

    await tick(VIEWER_POLL_MS);
    expect(notes(b)).toEqual(['hola']);
    expect(b.ctrl.ui.getState().current?.version).toBe(2);
  });

  it('en solo lectura nada modifica el documento', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    const b = openTab(cloud.api, 'Beto');
    await b.ctrl.start();
    const before = docOf(b.board.getState());
    edit(b, 'no');
    b.board.getState().startPlacing('pilot-lamp', { x: 0, y: 0 });
    b.board.getState().place({ x: 60, y: 60 });
    b.board.getState().setSelection({ devices: Object.keys(before.devices), wires: [], annotations: [] });
    b.board.getState().deleteSelection();
    b.board.getState().rotate();
    b.board.getState().undo();
    expect(docOf(b.board.getState())).toBe(before);
    expect(b.board.getState().canUndo()).toBe(false);
    await tick(1000);
    expect(cloud.service.list()[0]!.version).toBe(1);
  });

  it('«Editar» toma el turno al instante y el otro pasa a solo lectura [R6 §5]', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    const b = openTab(cloud.api, 'Beto');
    await b.ctrl.start();

    await b.ctrl.takeEdit();
    expect(role(b)).toBe('editor');
    expect(b.board.getState().readOnly).toBe(false);
    expect(b.board.getState().canUndo()).toBe(false);

    await tick(LEASE_HEARTBEAT_MS);
    expect(role(a)).toBe('viewer');
    expect(a.board.getState().readOnly).toBe(true);
    expect(a.ctrl.ui.getState().notice).toEqual({ kind: 'tookOver', editor: 'Beto' });

    edit(b, 'de Beto');
    await tick(1000);
    await tick(VIEWER_POLL_MS);
    expect(notes(a)).toEqual(['de Beto']);
  });

  it('si le toman el turno con cambios sin subir, esos cambios quedan en una copia [R6 §10]', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    const b = openTab(cloud.api, 'Beto');
    await b.ctrl.start();

    edit(a, 'sin subir');
    await b.ctrl.takeEdit();
    await tick(1000);

    expect(role(a)).toBe('viewer');
    expect(a.ctrl.ui.getState().notice).toEqual({ kind: 'copySaved', name: 'Arranque directo (2)' });
    const copy = cloud.service.list().find((d) => d.name === 'Arranque directo (2)')!;
    expect(cloud.service.get(copy.id)).toMatchObject({ ok: true });
    // El original no se tocó y el tablero de A muestra la versión del servidor.
    expect(cloud.service.list().find((d) => d.name === 'Arranque directo')!.version).toBe(1);
    expect(notes(a)).toEqual([]);
  });

  it('mientras se simula, la versión nueva espera a que se detenga', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    const b = openTab(cloud.api, 'Beto');
    await b.ctrl.start();

    b.board.getState().startSim();
    expect(b.board.getState().mode).toBe('simulating');
    edit(a, 'nuevo');
    await tick(1000);
    await tick(VIEWER_POLL_MS);
    expect(b.board.getState().mode).toBe('simulating');
    expect(b.ctrl.ui.getState().remotePending).toBe(true);
    expect(notes(b)).toEqual([]);

    b.board.getState().stopSim();
    await tick(0);
    expect(notes(b)).toEqual(['nuevo']);
    expect(b.ctrl.ui.getState().remotePending).toBe(false);
  });

  it('si quien edita se va sin soltar el turno, vence y lo toma quien mira', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    const b = openTab(cloud.api, 'Beto');
    await b.ctrl.start();
    a.ctrl.dispose();
    await tick(LEASE_TTL_MS + VIEWER_POLL_MS);
    expect(role(b)).toBe('editor');
  });

  it('abrir otro tablero suelta el turno del anterior', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    const first = a.ctrl.ui.getState().current!.id;
    await a.ctrl.createNew();
    expect(a.ctrl.ui.getState().current).toMatchObject({ name: 'Tablero nuevo', role: 'editor' });
    expect(cloud.service.list().find((d) => d.id === first)!.editor).toBeNull();
  });

  it('clonar, renombrar y papelera desde la lista [R6 §7, §8]', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    const b = openTab(cloud.api, 'Beto');
    await b.ctrl.start();
    const original = a.ctrl.ui.getState().current!.id;

    await a.ctrl.clone(original);
    expect(a.ctrl.ui.getState().current?.name).toBe('Arranque directo (copia)');
    const copy = a.ctrl.ui.getState().current!.id;

    await a.ctrl.rename(copy, 'Arranque directo');
    expect(a.ctrl.ui.getState().current?.name).toBe('Arranque directo (2)');

    // B mira el original; A lo manda a la papelera.
    await a.ctrl.remove(original);
    expect(a.ctrl.ui.getState().trash.map((d) => d.id)).toEqual([original]);
    await tick(VIEWER_POLL_MS);
    expect(b.ctrl.ui.getState().current?.deleted).toBe(true);
    expect(b.ctrl.ui.getState().notice).toEqual({ kind: 'deleted' });

    await a.ctrl.restore(original);
    expect(a.ctrl.ui.getState().current).toMatchObject({ id: original, name: 'Arranque directo' });
    expect(a.ctrl.ui.getState().trash).toEqual([]);
  });

  it('borrar el que se está editando abre el siguiente; sin ninguno, queda el lienzo vacío', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    const only = a.ctrl.ui.getState().current!.id;
    await a.ctrl.remove(only);
    expect(a.ctrl.ui.getState().current).toBeNull();
    expect(a.board.getState().readOnly).toBe(true);
    expect(Object.keys(docOf(a.board.getState()).devices)).toEqual([]);
  });

  it('importar agrega un tablero nuevo con el nombre del archivo; uno clásico se rechaza [R6 §4]', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    const json = serializeBoard(selectorBoard({ ids: createCounterIdGen(), registry: boardRegistry }));
    expect(await a.ctrl.importJson(json, 'mi-selector.json')).toBe(true);
    expect(a.ctrl.ui.getState().current).toMatchObject({ name: 'mi-selector', role: 'editor' });
    expect(a.ctrl.ui.getState().docs).toHaveLength(2);

    const classic = JSON.stringify({ schemaVersion: 1, metadata: {}, components: {}, vertices: {}, segments: {} });
    expect(await a.ctrl.importJson(classic, 'viejo.json')).toBe(false);
    expect(a.ctrl.ui.getState().notice).toEqual({ kind: 'importFailed', code: 'CLASSIC_FILE' });
    expect(a.ctrl.ui.getState().docs).toHaveLength(2);
  });

  it('exportar descarga el JSON con el nombre de la lista', async () => {
    const a = openTab(cloud.api, 'Ana');
    await a.ctrl.start();
    await a.ctrl.rename(a.ctrl.ui.getState().current!.id, 'Mi Tablero');
    expect(a.ctrl.exportJson()).toBe('Mi-Tablero.json');
    expect(JSON.parse(a.downloads[0]!.text).metadata.name).toBe('Mi Tablero');
  });

  describe('sin conexión', () => {
    /** API que se puede "desenchufar". */
    function flaky(api: CloudApi): { api: CloudApi; online: (value: boolean) => void } {
      let up = true;
      const wrapped = Object.fromEntries(
        Object.entries(api).map(([key, fn]) => [
          key,
          (...args: unknown[]) => (up ? (fn as (...a: unknown[]) => unknown)(...args) : Promise.resolve({ ok: false, code: 'NETWORK' })),
        ]),
      ) as unknown as CloudApi;
      return { api: wrapped, online: (value) => (up = value) };
    }

    it('reintenta hasta subir lo pendiente, que mientras tanto queda en el navegador', async () => {
      const net = flaky(cloud.api);
      const a = openTab(net.api, 'Ana');
      await a.ctrl.start();
      const id = a.ctrl.ui.getState().current!.id;
      net.online(false);
      edit(a, 'offline');
      await tick(1000);
      expect(a.ctrl.ui.getState().save).toBe('offline');
      expect(a.storage.get(`${STORAGE_KEYS.pendingPrefix}${id}`)).toContain('offline');

      net.online(true);
      await tick(5000);
      expect(a.ctrl.ui.getState().save).toBe('saved');
      expect(a.storage.get(`${STORAGE_KEYS.pendingPrefix}${id}`)).toBeNull();
      expect(cloud.service.list()[0]!.version).toBe(2);
    });

    it('al volver a abrir, lo pendiente se sube si nadie tocó el tablero, o queda como copia', async () => {
      const net = flaky(cloud.api);
      const storage = memoryStorage();
      const a = openTab(net.api, 'Ana', storage);
      await a.ctrl.start();
      net.online(false);
      edit(a, 'perdido');
      await tick(1000);
      a.ctrl.dispose();
      net.online(true);

      // Pasó el turno de A y nadie tocó el tablero: se sube tal cual.
      await tick(LEASE_TTL_MS + 30_000);
      const again = openTab(cloud.api, 'Ana', storage);
      await again.ctrl.start();
      expect(again.ctrl.ui.getState().notice).toEqual({ kind: 'recovered', name: 'Arranque directo' });
      expect(notes(again)).toEqual(['perdido']);
      expect(cloud.service.list()).toHaveLength(1);
    });

    it('si otro cambió el tablero mientras tanto, lo recuperado queda como copia', async () => {
      const net = flaky(cloud.api);
      const storage = memoryStorage();
      const a = openTab(net.api, 'Ana', storage);
      await a.ctrl.start();
      net.online(false);
      edit(a, 'mío');
      await tick(1000);
      a.ctrl.dispose();
      net.online(true);

      await tick(LEASE_TTL_MS);
      const b = openTab(cloud.api, 'Beto');
      await b.ctrl.start();
      expect(role(b)).toBe('editor');
      edit(b, 'de Beto');
      await tick(1000);
      b.ctrl.dispose();

      await tick(30_000);
      const again = openTab(cloud.api, 'Ana', storage);
      await again.ctrl.start();
      expect(again.ctrl.ui.getState().notice).toEqual({ kind: 'copySaved', name: 'Arranque directo (2)' });
      const names = cloud.service.list().map((d) => d.name).sort();
      expect(names).toEqual(['Arranque directo', 'Arranque directo (2)']);
    });
  });
});
