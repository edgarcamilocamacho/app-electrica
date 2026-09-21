import { describe, expect, it } from 'vitest';
import { loadDocument, parseDocument, serializeDocument } from '../../../src/core/persistence/serialize';
import { migrate } from '../../../src/core/persistence/migrations';
import { canonicalize } from '../../../src/core/topology/canonicalize';
import { DocBuilder } from '../../fixtures/builder';

function lampCircuit() {
  const b = new DocBuilder();
  const g = b.component('ac-source', 0, 0, 0, { ref: 'G1' });
  const s = b.component('switch-no', 8, 0, 0, { ref: 'S1' });
  const h = b.component('lamp', 16, 0, 90, { ref: 'H1', color: 'green' });
  b.wire(b.terminal(g, 'L'), { x: 0, y: -6 }, { x: 8, y: -6 }, b.terminal(s, '13'));
  b.wire(b.terminal(s, '14'), { x: 8, y: 6 }, { x: 13, y: 6 }, { x: 13, y: 0 }, b.terminal(h, 'X1'));
  const doc = canonicalize(b.build(), b.ctx);
  return { doc: { ...doc, annotations: { n1: { id: 'n1', position: { x: 2, y: -9 }, text: 'Mando' } }, view: { pan: { x: 10, y: 20 }, zoom: 1.5 } }, ctx: b.ctx };
}

describe('serialización', () => {
  it('round-trip exacto: documento → JSON → documento', () => {
    const { doc, ctx } = lampCircuit();
    const text = serializeDocument(doc);
    const loaded = parseDocument(text, ctx);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.doc).toEqual(doc);
    expect(loaded.normalized).toBe(false);
    expect(serializeDocument(loaded.doc)).toBe(text);
  });

  it('el JSON es legible, versionado y no repite el id dentro de cada entidad', () => {
    const { doc } = lampCircuit();
    const file = JSON.parse(serializeDocument(doc));
    expect(file.schemaVersion).toBe(1);
    const firstComponent = Object.values(file.components)[0] as Record<string, unknown>;
    expect(firstComponent).not.toHaveProperty('id');
    expect(firstComponent).toHaveProperty('type');
  });

  it('las claves salen ordenadas por id aunque el documento se haya construido en otro orden', () => {
    const { doc } = lampCircuit();
    const reversed = { ...doc, components: Object.fromEntries(Object.entries(doc.components).reverse()) };
    expect(serializeDocument(reversed)).toBe(serializeDocument(doc));
  });

  it('un documento fuera de forma normal se carga normalizado', () => {
    const b = new DocBuilder();
    b.wire({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 6, y: 0 });
    const loaded = parseDocument(serializeDocument(b.build()), b.ctx);
    expect(loaded.ok && loaded.normalized).toBe(true);
    if (loaded.ok) expect(Object.keys(loaded.doc.segments)).toHaveLength(1);
  });
});

describe('carga — errores legibles', () => {
  const { ctx } = lampCircuit();
  const base = () => JSON.parse(serializeDocument(lampCircuit().doc));

  it('JSON inválido', () => {
    expect(parseDocument('{ no es json', ctx)).toMatchObject({ ok: false, error: { code: 'INVALID_JSON' } });
  });

  it('sin versión de esquema', () => {
    const raw = base();
    delete raw.schemaVersion;
    expect(loadDocument(raw, ctx)).toMatchObject({ ok: false, error: { code: 'NO_VERSION' } });
  });

  it('versión más nueva que la app', () => {
    expect(loadDocument({ ...base(), schemaVersion: 7 }, ctx)).toMatchObject({
      ok: false,
      error: { code: 'FUTURE_VERSION', detail: '7' },
    });
  });

  it('esquema inválido indica dónde', () => {
    const raw = base();
    const firstId = Object.keys(raw.components)[0]!;
    raw.components[firstId].rotation = 45;
    const result = loadDocument(raw, ctx);
    expect(result).toMatchObject({ ok: false, error: { code: 'SCHEMA' } });
    if (!result.ok) expect(result.error.detail).toContain('rotation');
  });

  it('tipo de componente desconocido', () => {
    const raw = base();
    raw.components.cX = { type: 'reactor-nuclear', position: { x: 0, y: 0 }, rotation: 0, props: {} };
    expect(loadDocument(raw, ctx)).toMatchObject({ ok: false, error: { code: 'UNKNOWN_TYPE' } });
  });

  it('segmento que referencia un vértice inexistente', () => {
    const raw = base();
    raw.segments.sX = { a: 'v999', b: Object.keys(raw.vertices)[0] };
    expect(loadDocument(raw, ctx)).toMatchObject({ ok: false, error: { code: 'DANGLING_REFERENCE' } });
  });

  it('terminal inexistente en el tipo', () => {
    const raw = base();
    const cid = Object.keys(raw.components)[0]!;
    raw.vertices.vX = { kind: 'terminal', componentId: cid, terminalId: 'Z9' };
    expect(loadDocument(raw, ctx)).toMatchObject({ ok: false, error: { code: 'UNKNOWN_TERMINAL' } });
  });

  it('el mismo terminal materializado dos veces', () => {
    const raw = base();
    const terminalVertex = Object.values(raw.vertices).find((v) => (v as { kind: string }).kind === 'terminal');
    raw.vertices.vX = { ...(terminalVertex as object) };
    expect(loadDocument(raw, ctx)).toMatchObject({ ok: false, error: { code: 'DUPLICATE_TERMINAL_VERTEX' } });
  });
});

describe('migraciones', () => {
  it('aplica los pasos en cadena hasta la versión actual', () => {
    const migrations = {
      0: (raw: Record<string, unknown>) => ({ ...raw, annotations: {}, legacy0: true }),
    };
    const result = migrate({ schemaVersion: 0, foo: 1 }, migrations, 1);
    expect(result).toEqual({ ok: true, fromVersion: 0, raw: { schemaVersion: 1, foo: 1, annotations: {}, legacy0: true } });
  });

  it('falla si falta un paso intermedio', () => {
    expect(migrate({ schemaVersion: 0 }, {}, 2)).toEqual({ ok: false, error: { code: 'MISSING_MIGRATION', version: 0 } });
  });

  it('un documento migrado de v0 se carga como v1', () => {
    const { doc, ctx } = lampCircuit();
    const v1 = JSON.parse(serializeDocument(doc));
    const v0 = { ...v1, schemaVersion: 0 };
    delete v0.annotations;
    const migrations = { 0: (raw: Record<string, unknown>) => ({ ...raw, annotations: v1.annotations }) };
    const loaded = loadDocument(v0, ctx, migrations);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.migratedFrom).toBe(0);
      expect(loaded.doc).toEqual(doc);
    }
  });
});
