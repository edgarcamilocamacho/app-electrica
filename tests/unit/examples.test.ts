import { describe, expect, it } from 'vitest';
import { buildExample, EXAMPLE_IDS } from '../../src/examples';
import { computeDiagnostics } from '../../src/core/diagnostics/diagnostics';
import { defaultRegistry } from '../../src/core/registry/catalog';
import { SimEngine } from '../../src/core/sim/engine';
import { parseDocument, serializeDocument } from '../../src/core/persistence/serialize';
import { createCounterIdGen } from '../../src/core/model/ids';
import type { CircuitDocument } from '../../src/core/model/types';
import { normalFormViolations } from '../fixtures/invariants';

const texts = { name: 'Ejemplo', note: 'Nota' };
const byRef = (doc: CircuitDocument, ref: string) => Object.values(doc.components).find((c) => c.props.ref === ref)!.id;

describe('ejemplos incluidos', () => {
  for (const id of EXAMPLE_IDS) {
    it(`${id}: forma normal, sin bloqueantes, round-trip exacto y simula sin error`, () => {
      const doc = buildExample(id, texts);
      expect(normalFormViolations(doc, defaultRegistry)).toEqual([]);
      expect(computeDiagnostics(doc, defaultRegistry).filter((d) => d.severity === 'blocking')).toEqual([]);
      const loaded = parseDocument(serializeDocument(doc), { ids: createCounterIdGen(), registry: defaultRegistry });
      expect(loaded.ok && loaded.doc).toEqual(doc);
      const e = new SimEngine(doc, defaultRegistry);
      expect(e.start().mode).toBe('running');
    });
  }

  it('lámpara: S1 enciende H1', () => {
    const doc = buildExample('lamp', texts);
    const e = new SimEngine(doc, defaultRegistry);
    e.start();
    e.toggle(byRef(doc, 'S1'));
    expect(e.snapshot().devices.get(byRef(doc, 'H1'))?.energized).toBe(true);
  });

  it('autorretención: marcha, retención, paro y parada de emergencia', () => {
    const doc = buildExample('seal-in', texts);
    const e = new SimEngine(doc, defaultRegistry);
    e.start();
    const h1 = () => e.snapshot().devices.get(byRef(doc, 'H1'))?.energized;
    // S1 = parada de emergencia, S2 = paro, S3 = marcha (orden de colocación).
    e.press(byRef(doc, 'S3'));
    e.release(byRef(doc, 'S3'));
    expect(h1()).toBe(true);
    e.press(byRef(doc, 'S2'));
    e.release(byRef(doc, 'S2'));
    expect(h1()).toBe(false);
    e.press(byRef(doc, 'S3'));
    e.release(byRef(doc, 'S3'));
    e.toggle(byRef(doc, 'S1'));
    expect(h1()).toBe(false);
  });

  it('TON: la lámpara enciende 3 s después de cerrar S1', () => {
    const doc = buildExample('ton', texts);
    const e = new SimEngine(doc, defaultRegistry);
    e.start();
    e.toggle(byRef(doc, 'S1'));
    e.advanceTo(2999);
    expect(e.snapshot().devices.get(byRef(doc, 'H1'))?.energized).toBe(false);
    e.advanceTo(3000);
    expect(e.snapshot().devices.get(byRef(doc, 'H1'))?.energized).toBe(true);
  });

  it('TOF: la lámpara se apaga 3 s después de abrir S1', () => {
    const doc = buildExample('tof', texts);
    const e = new SimEngine(doc, defaultRegistry);
    e.start();
    e.toggle(byRef(doc, 'S1'));
    e.advanceTo(1000);
    e.toggle(byRef(doc, 'S1'));
    e.advanceTo(3999);
    expect(e.snapshot().devices.get(byRef(doc, 'H1'))?.energized).toBe(true);
    e.advanceTo(4000);
    expect(e.snapshot().devices.get(byRef(doc, 'H1'))?.energized).toBe(false);
  });

  it('selector: I enciende H1, II enciende H2', () => {
    const doc = buildExample('selector', texts);
    const e = new SimEngine(doc, defaultRegistry);
    e.start();
    const s = byRef(doc, 'S1');
    e.setSelector(s, 1);
    expect(e.snapshot().devices.get(byRef(doc, 'H1'))?.energized).toBe(true);
    e.setSelector(s, 2);
    expect(e.snapshot().devices.get(byRef(doc, 'H2'))?.energized).toBe(true);
    expect(e.snapshot().devices.get(byRef(doc, 'H1'))?.energized).toBe(false);
  });
});
