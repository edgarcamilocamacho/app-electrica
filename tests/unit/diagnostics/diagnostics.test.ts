import { describe, expect, it } from 'vitest';
import { canSimulate, computeDiagnostics } from '../../../src/core/diagnostics/diagnostics';
import { buildRefIndex } from '../../../src/core/connectivity/refs';
import { canonicalize } from '../../../src/core/topology/canonicalize';
import { defaultRegistry } from '../../../src/core/registry/catalog';
import { DocBuilder } from '../../fixtures/builder';
import { ladder, sealIn } from '../../fixtures/scenarios';

const codes = (doc: Parameters<typeof computeDiagnostics>[0]) =>
  computeDiagnostics(doc, defaultRegistry).map((d) => `${d.severity}:${d.code}`).sort();

describe('diagnósticos', () => {
  it('los escenarios de ejemplo no tienen bloqueantes', () => {
    expect(canSimulate(computeDiagnostics(ladder().doc, defaultRegistry))).toBe(true);
    expect(canSimulate(computeDiagnostics(sealIn().doc, defaultRegistry))).toBe(true);
  });

  it('solapamiento entre redes distintas → OVERLAP bloqueante', () => {
    const b = new DocBuilder();
    b.wire({ x: 0, y: 0 }, { x: 10, y: 0 });
    b.wire({ x: 5, y: 0 }, { x: 15, y: 0 });
    const doc = canonicalize(b.build(), b.ctx);
    expect(codes(doc)).toContain('blocking:OVERLAP');
    expect(canSimulate(computeDiagnostics(doc, defaultRegistry))).toBe(false);
  });

  it('T sin punto y cable sobre terminal ajeno → AMBIGUOUS_CONTACT bloqueante', () => {
    const b = new DocBuilder();
    b.wire({ x: 0, y: 0 }, { x: 10, y: 0 });
    b.wire({ x: 5, y: 0 }, { x: 5, y: 5 }); // T sin punto (otra red)
    b.component('lamp', 20, 3); // X1 libre en (20,0)
    b.wire({ x: 15, y: 0 }, { x: 25, y: 0 }); // pasa por X1
    const d = computeDiagnostics(canonicalize(b.build(), b.ctx), defaultRegistry);
    expect(d.filter((x) => x.code === 'AMBIGUOUS_CONTACT')).toHaveLength(2);
    expect(d.every((x) => x.code !== 'AMBIGUOUS_CONTACT' || x.severity === 'blocking')).toBe(true);
  });

  it('contacto sin vínculo o con vínculo a una bobina inexistente → REF_BROKEN bloqueante (R2 §10)', () => {
    const b = new DocBuilder();
    b.component('contact-no', 0, 0, 0, { link: '' });
    b.component('contact-nc', 10, 0, 0, { link: 'K9' });
    const diags = computeDiagnostics(b.build(), defaultRegistry);
    const broken = diags.filter((d) => d.code === 'REF_BROKEN');
    expect(broken).toHaveLength(2);
    expect(broken[1]!.params.link).toBe('K9');
    expect(canSimulate(diags)).toBe(false);
  });

  it('dos bobinas con la misma referencia → REF_DUPLICATE bloqueante', () => {
    const b = new DocBuilder();
    b.component('coil', 0, 0, 0, { ref: 'K1' });
    b.component('coil', 10, 0, 0, { ref: 'K1' });
    b.component('contact-no', 20, 0, 0, { link: 'K1' });
    const diags = computeDiagnostics(b.build(), defaultRegistry);
    expect(diags.map((d) => d.code)).toContain('REF_DUPLICATE');
    expect(diags.find((d) => d.code === 'REF_DUPLICATE')!.severity).toBe('blocking');
    expect(buildRefIndex(b.build(), defaultRegistry).resolve(Object.keys(b.build().components)[2]!)).toMatchObject({ status: 'ambiguous' });
  });

  it('contacto común vinculado a un timer, o temporizado a una bobina → REF_WRONG_TYPE (R3 Q3.4)', () => {
    const b = new DocBuilder();
    b.component('timer-ton', 0, 0, 0, { ref: 'T1' });
    b.component('coil', 10, 0, 0, { ref: 'K1' });
    b.component('contact-no', 20, 0, 0, { link: 'T1' });
    b.component('timed-contact-no', 30, 0, 0, { link: 'K1' });
    const wrong = computeDiagnostics(b.build(), defaultRegistry).filter((d) => d.code === 'REF_WRONG_TYPE');
    expect(wrong).toHaveLength(2);
    expect(wrong.map((d) => d.params.expected).sort()).toEqual(['coil', 'timer']);
  });

  it('vínculos correctos no generan diagnósticos de referencia', () => {
    const b = new DocBuilder();
    b.component('coil', 0, 0, 0, { ref: 'K1' });
    b.component('timer-tof', 10, 0, 0, { ref: 'T1' });
    b.component('contact-no', 20, 0, 0, { link: 'K1', ref: 'K1.1' });
    b.component('timed-contact-nc', 30, 0, 0, { link: 'T1', ref: 'T1.1' });
    expect(codes(b.build()).filter((c) => c.includes('REF'))).toEqual([]);
  });

  it('ref repetida en componentes que no son destino → aviso, no bloquea', () => {
    const b = new DocBuilder();
    b.component('lamp', 0, 0, 0, { ref: 'H1' });
    b.component('lamp', 10, 0, 0, { ref: 'H1' });
    const diags = computeDiagnostics(b.build(), defaultRegistry);
    expect(diags.map((d) => `${d.severity}:${d.code}`)).toEqual(['warning:REF_REPEATED']);
    expect(canSimulate(diags)).toBe(true);
  });

  it('componente puenteado por el cableado → aviso (incluye L–N unidos por cable)', () => {
    const b = new DocBuilder();
    const g = b.component('ac-source', 0, 0, 0, { ref: 'G1' });
    b.wire(b.terminal(g, 'L'), { x: 0, y: -5 }, { x: 4, y: -5 }, { x: 4, y: 5 }, { x: 0, y: 5 }, b.terminal(g, 'N'));
    const diags = computeDiagnostics(canonicalize(b.build(), b.ctx), defaultRegistry);
    expect(diags.map((d) => `${d.severity}:${d.code}`)).toContain('warning:BYPASSED');
    expect(canSimulate(diags)).toBe(true); // arranca y entra en ERROR: el usuario ve el corto
  });

  it('bobina sin contactos → info; sin referencia → aviso', () => {
    const b = new DocBuilder();
    b.component('coil', 0, 0, 0, { ref: 'K1' });
    b.component('coil', 10, 0, 0, { ref: '' });
    expect(codes(b.build())).toEqual(['info:NO_CONTACTS', 'warning:REF_MISSING']);
  });

  it('un extremo libre no genera diagnóstico (R1 §9)', () => {
    const b = new DocBuilder();
    b.wire({ x: 0, y: 0 }, { x: 0, y: 5 });
    expect(codes(canonicalize(b.build(), b.ctx))).toEqual([]);
  });
});
