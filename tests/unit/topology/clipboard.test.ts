import { describe, expect, it } from 'vitest';
import { copyFragment, pasteFragment } from '../../../src/core/topology/clipboard';
import { selectionOf } from '../../../src/core/model/selection';
import { defaultRegistry } from '../../../src/core/registry/catalog';
import { computeDiagnostics } from '../../../src/core/diagnostics/diagnostics';
import { Scenario } from '../../fixtures/scenarios';
import { expectValid, sameNet, spans } from '../../fixtures/queries';

const refs = (doc: Scenario['doc']) =>
  Object.values(doc.components)
    .map((c) => `${c.type}:${String(c.props.ref)}${c.props.link !== undefined ? `→${String(c.props.link)}` : ''}`)
    .sort();

describe('copiar / pegar (R2 §13)', () => {
  it('copiar un componente solo lo renumera (K1 → K2) con ids nuevos', () => {
    const s = new Scenario().place('K1', 'coil', 0, 0);
    const frag = copyFragment(s.doc, selectionOf({ components: [s.ids.K1!] }), defaultRegistry)!;
    const r = pasteFragment(s.doc, frag, { x: 10, y: 0 }, s.ctx);
    const doc = expectValid(r);
    expect(refs(doc)).toEqual(['coil:K1', 'coil:K2']);
    expect(r.selection.components).toHaveLength(1);
    expect(r.selection.components[0]).not.toBe(s.ids.K1);
  });

  it('bobina + contactos copiados juntos: los contactos siguen a la bobina copiada (K2, K2.1)', () => {
    const s = new Scenario()
      .place('K1', 'coil', 0, 0)
      .place('K11', 'contact-no', 10, 0, 0, { link: 'K1' })
      .place('K12', 'contact-nc', 20, 0, 0, { link: 'K1' });
    const frag = copyFragment(s.doc, selectionOf({ components: [s.ids.K1!, s.ids.K11!, s.ids.K12!] }), defaultRegistry)!;
    const doc = expectValid(pasteFragment(s.doc, frag, { x: 0, y: 20 }, s.ctx));
    expect(refs(doc)).toEqual([
      'coil:K1',
      'coil:K2',
      'contact-nc:K1.2→K1',
      'contact-nc:K2.2→K2',
      'contact-no:K1.1→K1',
      'contact-no:K2.1→K2',
    ]);
    expect(computeDiagnostics(doc, defaultRegistry).filter((d) => d.severity === 'blocking')).toEqual([]);
  });

  it('un contacto copiado solo sigue vinculado a su bobina original con el próximo número (K1.3)', () => {
    const s = new Scenario()
      .place('K1', 'coil', 0, 0)
      .place('K11', 'contact-no', 10, 0, 0, { link: 'K1' })
      .place('K12', 'contact-no', 20, 0, 0, { link: 'K1' });
    const frag = copyFragment(s.doc, selectionOf({ components: [s.ids.K11!] }), defaultRegistry)!;
    const doc = expectValid(pasteFragment(s.doc, frag, { x: 0, y: 20 }, s.ctx));
    expect(refs(doc)).toContain('contact-no:K1.3→K1');
  });

  it('preserva la topología interna: dos componentes y el cable entre ellos', () => {
    const s = new Scenario().place('K1', 'coil', 0, 0).place('H1', 'lamp', 0, 10).wire([0, 3], [0, 7]);
    const seg = Object.keys(s.doc.segments)[0]!;
    const frag = copyFragment(s.doc, selectionOf({ components: [s.ids.K1!, s.ids.H1!], segments: [seg] }), defaultRegistry)!;
    const r = pasteFragment(s.doc, frag, { x: 20, y: 0 }, s.ctx);
    const doc = expectValid(r);
    const [k2, h2] = r.selection.components as [string, string];
    const kid = doc.components[k2]!.type === 'coil' ? k2 : h2;
    const hid = kid === k2 ? h2 : k2;
    expect(sameNet(doc, [kid, 'A2'], [hid, 'X1'])).toBe(true);
    expect(spans(doc)).toEqual(['0,3-0,7', '20,3-20,7']);
  });

  it('un cable copiado sin su componente queda con extremo libre en la copia', () => {
    const s = new Scenario().place('K1', 'coil', 0, 0).wire([0, 3], [0, 8], [6, 8]);
    const frag = copyFragment(s.doc, selectionOf({ segments: Object.keys(s.doc.segments) }), defaultRegistry)!;
    expect(frag.vertices.every((v) => v.kind === 'point')).toBe(true);
    const doc = expectValid(pasteFragment(s.doc, frag, { x: 20, y: 0 }, s.ctx));
    expect(spans(doc)).toContain('20,3-20,8');
  });

  it('pegar encima de un cable conecta los terminales libres que caen sobre él (I6)', () => {
    const s = new Scenario().place('H1', 'lamp', 0, 0).wire([10, -3], [30, -3]);
    const frag = copyFragment(s.doc, selectionOf({ components: [s.ids.H1!] }), defaultRegistry)!;
    const r = pasteFragment(s.doc, frag, { x: 20, y: 0 }, s.ctx); // X1 de la copia cae en (20,-3)
    const doc = expectValid(r);
    const copy = r.selection.components[0]!;
    expect(Object.values(doc.vertices).some((v) => v.kind === 'terminal' && v.componentId === copy)).toBe(true);
  });

  it('un pegado que produciría ambigüedad es inválido', () => {
    // Cable largo pegado sobre uno corto de otra red: sus extremos caen fuera (no conectan) y se superpone.
    const s = new Scenario().wire([0, 0], [10, 0]).wire([0, 5], [20, 5]);
    const long = Object.keys(s.doc.segments).find((id) => spans({ ...s.doc, segments: { [id]: s.doc.segments[id]! } })[0] === '0,5-20,5')!;
    const frag = copyFragment(s.doc, selectionOf({ segments: [long] }), defaultRegistry)!;
    const r = pasteFragment(s.doc, frag, { x: -5, y: -5 }, s.ctx); // quedaría en (-5,0)–(15,0)
    expect(r.ok).toBe(false);
    expect(r.violations.map((v) => v.code)).toContain('V1');
  });

  it('un extremo libre pegado que cae sobre un cable se conecta (I6)', () => {
    const s = new Scenario().wire([0, 0], [10, 0]).wire([0, 5], [10, 5]);
    const second = Object.keys(s.doc.segments).find((id) => spans({ ...s.doc, segments: { [id]: s.doc.segments[id]! } })[0] === '0,5-10,5')!;
    const frag = copyFragment(s.doc, selectionOf({ segments: [second] }), defaultRegistry)!;
    const doc = expectValid(pasteFragment(s.doc, frag, { x: 3, y: -5 }, s.ctx));
    expect(spans(doc).filter((x) => x.endsWith(',0'))).toEqual(['0,0-13,0']);
  });
});
