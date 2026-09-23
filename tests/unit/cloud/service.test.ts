import { beforeEach, describe, expect, it } from 'vitest';
import { cleanName, uniqueName, utf8Length } from '../../../src/core/cloud/names';
import { CloudService } from '../../../src/core/cloud/service';
import { MemoryDocStore } from '../../../src/core/cloud/store';
import { LEASE_TTL_MS, TRASH_RETENTION_MS, type CloudResult } from '../../../src/core/cloud/types';
import { serializeBoard } from '../../../src/core/board/persistence';
import { BoardBuilder } from '../../fixtures/board';

const A = 'sesion-aaaa';
const B = 'sesion-bbbb';

function value<T>(result: CloudResult<T>): T {
  if (!result.ok) throw new Error(`esperaba ok, vino ${result.code}`);
  return result.value;
}

function boardJson(lamps = 0): string {
  const b = new BoardBuilder();
  b.device('supply-1p', 0, 0);
  for (let i = 0; i < lamps; i += 1) b.device('pilot-lamp', 20 + i * 10, 0);
  return serializeBoard(b.doc);
}

describe('nombres únicos [R6 §10]', () => {
  it('agrega (2), (3)… y sigue la numeración que ya trae el nombre', () => {
    const taken = new Set(['arranque', 'arranque (2)', 'motor (7)']);
    const has = (key: string) => taken.has(key);
    expect(uniqueName('Nuevo', has)).toBe('Nuevo');
    expect(uniqueName('Arranque', has)).toBe('Arranque (3)');
    expect(uniqueName('ARRANQUE (2)', has)).toBe('ARRANQUE (3)');
    expect(uniqueName('Motor (7)', has)).toBe('Motor (8)');
  });

  it('limpia espacios y caracteres de control, y respeta el largo máximo con el número', () => {
    expect(cleanName('  Tablero \n\t de   prueba ')).toBe('Tablero de prueba');
    const long = 'x'.repeat(200);
    expect(cleanName(long)).toHaveLength(120);
    const numbered = uniqueName(long, (key) => key === 'x'.repeat(120));
    expect(numbered).toHaveLength(120);
    expect(numbered.endsWith(' (2)')).toBe(true);
  });

  it('mide el tamaño en bytes UTF-8', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('ñ')).toBe(2);
    expect(utf8Length('€')).toBe(3);
    expect(utf8Length('🔌')).toBe(4);
  });
});

describe('CloudService', () => {
  let now: number;
  let service: CloudService;
  let counter: number;

  beforeEach(() => {
    now = 1_000_000;
    counter = 0;
    service = new CloudService(new MemoryDocStore(), {
      now: () => now,
      newId: () => `t${++counter}`,
    });
  });

  const create = (name: string, content = boardJson()) => value(service.create({ name, content, by: 'Ana' }));

  describe('crear, listar y abrir', () => {
    it('crea en la versión 1 con el contenido canónico y lo lista primero el más reciente', () => {
      const first = create('Primero');
      now += 1000;
      const second = create('Segundo');
      expect(first.version).toBe(1);
      expect(first.updatedBy).toBe('Ana');
      expect(service.list().map((d) => d.name)).toEqual(['Segundo', 'Primero']);
      expect(value(service.get(second.id)).content).toBe(boardJson());
    });

    it('rechaza un JSON que no es un tablero y no deja nada guardado', () => {
      expect(service.create({ name: 'Malo', content: '{"hola":1}', by: null })).toEqual({ ok: false, code: 'INVALID_DOCUMENT' });
      expect(service.create({ name: 'Malo', content: 'no es json', by: null })).toEqual({ ok: false, code: 'INVALID_DOCUMENT' });
      expect(service.create({ name: '   ', content: boardJson(), by: null })).toEqual({ ok: false, code: 'INVALID_NAME' });
      expect(service.create({ name: 'Sin contenido', by: null })).toEqual({ ok: false, code: 'INVALID_INPUT' });
      expect(service.list()).toEqual([]);
    });

    it('un nombre repetido recibe número, sin importar mayúsculas', () => {
      create('Arranque');
      expect(create('arranque').name).toBe('arranque (2)');
      expect(create('Arranque').name).toBe('Arranque (3)');
    });

    it('clonar copia el contenido con otro nombre [R6 §7]', () => {
      const source = create('Original', boardJson(2));
      const copy = value(service.create({ name: 'Original', cloneOf: source.id, by: 'Beto' }));
      expect(copy.id).not.toBe(source.id);
      expect(copy.name).toBe('Original (2)');
      expect(copy.content).toBe(value(service.get(source.id)).content);
      expect(service.create({ name: 'X', cloneOf: 'no-existe', by: null })).toEqual({ ok: false, code: 'NOT_FOUND' });
    });

    it('aplica los límites de tamaño y de cantidad', () => {
      const small = new CloudService(new MemoryDocStore(), {
        now: () => now,
        newId: () => `s${++counter}`,
        limits: { maxDocs: 2, maxContentBytes: 1000 },
      });
      expect(small.create({ name: 'Grande', content: boardJson(6), by: null })).toEqual({ ok: false, code: 'TOO_LARGE' });
      value(small.create({ name: 'Uno', content: boardJson(), by: null }));
      value(small.create({ name: 'Dos', content: boardJson(), by: null }));
      expect(small.create({ name: 'Tres', content: boardJson(), by: null })).toEqual({ ok: false, code: 'QUOTA' });
    });
  });

  describe('turno de edición [R6 §5]', () => {
    it('pedir lo concede si está libre y lo niega si otro lo tiene vigente', () => {
      const doc = create('Tablero');
      expect(value(service.lease(doc.id, { session: A, name: 'Ana', take: false }))).toEqual({
        granted: true,
        version: 1,
        editor: { name: 'Ana' },
      });
      expect(value(service.lease(doc.id, { session: B, name: 'Beto', take: false }))).toEqual({
        granted: false,
        version: 1,
        editor: { name: 'Ana' },
      });
      expect(value(service.state(doc.id, A)).editing).toBe(true);
      expect(value(service.state(doc.id, B)).editing).toBe(false);
    });

    it('tomar lo concede al instante y el anterior ya no puede guardar', () => {
      const doc = create('Tablero');
      value(service.lease(doc.id, { session: A, name: 'Ana', take: false }));
      expect(value(service.lease(doc.id, { session: B, name: 'Beto', take: true })).granted).toBe(true);
      expect(service.save(doc.id, { content: boardJson(1), baseVersion: 1, session: A, by: 'Ana' })).toEqual({
        ok: false,
        code: 'NOT_EDITOR',
      });
      expect(value(service.save(doc.id, { content: boardJson(1), baseVersion: 1, session: B, by: 'Beto' })).version).toBe(2);
      expect(value(service.get(doc.id)).updatedBy).toBe('Beto');
    });

    it('el turno vence sin latidos y entonces cualquiera lo puede pedir', () => {
      const doc = create('Tablero');
      value(service.lease(doc.id, { session: A, name: 'Ana', take: false }));
      now += LEASE_TTL_MS - 1;
      expect(value(service.lease(doc.id, { session: B, name: null, take: false })).granted).toBe(false);
      // Un latido de A lo renueva.
      value(service.lease(doc.id, { session: A, name: 'Ana', take: false }));
      now += LEASE_TTL_MS - 1;
      expect(value(service.lease(doc.id, { session: B, name: null, take: false })).granted).toBe(false);
      now += 1;
      expect(value(service.lease(doc.id, { session: B, name: null, take: false }))).toEqual({
        granted: true,
        version: 1,
        editor: { name: null },
      });
      expect(service.list()[0]!.editor).toEqual({ name: null });
    });

    it('soltar el turno lo deja libre; soltar uno ajeno no hace nada', () => {
      const doc = create('Tablero');
      value(service.lease(doc.id, { session: A, name: 'Ana', take: false }));
      value(service.release(doc.id, B));
      expect(service.list()[0]!.editor).toEqual({ name: 'Ana' });
      value(service.release(doc.id, A));
      expect(service.list()[0]!.editor).toBeNull();
    });

    it('rechaza sesiones con formato inválido', () => {
      const doc = create('Tablero');
      expect(service.lease(doc.id, { session: 'x', name: null, take: false })).toEqual({ ok: false, code: 'INVALID_INPUT' });
      expect(service.lease(doc.id, { session: 'a/../../b', name: null, take: false })).toEqual({ ok: false, code: 'INVALID_INPUT' });
    });
  });

  describe('guardar', () => {
    it('sube la versión, renueva el turno y exige partir de la última versión', () => {
      const doc = create('Tablero');
      value(service.lease(doc.id, { session: A, name: 'Ana', take: false }));
      expect(value(service.save(doc.id, { content: boardJson(1), baseVersion: 1, session: A, by: 'Ana' })).version).toBe(2);
      expect(service.save(doc.id, { content: boardJson(2), baseVersion: 1, session: A, by: 'Ana' })).toEqual({
        ok: false,
        code: 'STALE',
      });
      now += LEASE_TTL_MS - 1;
      expect(value(service.save(doc.id, { content: boardJson(2), baseVersion: 2, session: A, by: 'Ana' })).version).toBe(3);
      now += LEASE_TTL_MS - 1;
      // El guardado anterior renovó el turno: B todavía no puede pedirlo.
      expect(value(service.lease(doc.id, { session: B, name: null, take: false })).granted).toBe(false);
    });

    it('con el turno libre se guarda si la versión coincide, y el turno queda para quien guardó', () => {
      const doc = create('Tablero');
      expect(value(service.save(doc.id, { content: boardJson(1), baseVersion: 1, session: B, by: null })).version).toBe(2);
      expect(value(service.state(doc.id, B)).editing).toBe(true);
    });

    it('no guarda un documento inválido ni uno en la papelera', () => {
      const doc = create('Tablero');
      expect(service.save(doc.id, { content: '[]', baseVersion: 1, session: A, by: null })).toEqual({
        ok: false,
        code: 'INVALID_DOCUMENT',
      });
      value(service.remove(doc.id));
      expect(service.save(doc.id, { content: boardJson(), baseVersion: 1, session: A, by: null })).toEqual({
        ok: false,
        code: 'IN_TRASH',
      });
      expect(service.save('nada', { content: boardJson(), baseVersion: 1, session: A, by: null })).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('renombrar', () => {
    it('evita repetir el nombre de otro, pero no choca consigo mismo', () => {
      create('Arranque');
      const other = create('Otro');
      expect(value(service.rename(other.id, 'arranque')).name).toBe('arranque (2)');
      expect(value(service.rename(other.id, 'ARRANQUE (2)')).name).toBe('ARRANQUE (2)');
      expect(service.rename(other.id, '')).toEqual({ ok: false, code: 'INVALID_NAME' });
    });
  });

  describe('papelera [R6 §8]', () => {
    it('borrar lo saca de la lista, suelta el turno y se restaura con nombre libre', () => {
      const doc = create('Tablero');
      value(service.lease(doc.id, { session: A, name: 'Ana', take: false }));
      value(service.remove(doc.id));
      expect(service.list()).toEqual([]);
      const [trashed] = service.trash();
      expect(trashed).toMatchObject({ id: doc.id, deletedAt: now, purgeAt: now + TRASH_RETENTION_MS, editor: null });
      expect(value(service.state(doc.id, A))).toMatchObject({ deletedAt: now, editing: false, editor: null });
      expect(service.lease(doc.id, { session: A, name: null, take: true })).toEqual({ ok: false, code: 'IN_TRASH' });

      create('Tablero');
      expect(value(service.restore(doc.id)).name).toBe('Tablero (2)');
      expect(service.trash()).toEqual([]);
      expect(service.list()).toHaveLength(2);
    });

    it('purga solo lo que lleva más de 30 días', () => {
      const old = create('Viejo');
      value(service.remove(old.id));
      now += 10 * 24 * 3600 * 1000;
      const recent = create('Reciente');
      value(service.remove(recent.id));
      now += TRASH_RETENTION_MS - 10 * 24 * 3600 * 1000 + 1;
      expect(service.purgeTrash()).toBe(1);
      expect(service.trash().map((d) => d.id)).toEqual([recent.id]);
      expect(service.get(old.id)).toEqual({ ok: false, code: 'NOT_FOUND' });
    });
  });
});
