import { describe, expect, it } from 'vitest';
import { blockingDiagnostics, computeDiagnostics } from '../../../src/core/board/diagnostics';
import { BoardBuilder, registry, term } from '../../fixtures/board';

const codes = (b: BoardBuilder) => computeDiagnostics(b.doc, registry).map((d) => d.code);

describe('diagnósticos del tablero', () => {
  it('un tablero vacío no tiene diagnósticos', () => {
    expect(computeDiagnostics(new BoardBuilder().doc, registry)).toEqual([]);
  });

  it('dos aparatos superpuestos bloquean la simulación', () => {
    const b = new BoardBuilder();
    b.device('contactor-3p', 0, 0);
    b.device('contactor-3p', 5, 0);
    expect(codes(b)).toContain('DEVICE_OVERLAP');
    expect(blockingDiagnostics(computeDiagnostics(b.doc, registry))).toHaveLength(1);
  });

  it('la etiqueta repetida es solo un aviso [R5 §1]', () => {
    const b = new BoardBuilder();
    b.device('pilot-lamp', 0, 0, { ref: 'H1' });
    b.device('pilot-lamp', 20, 0, { ref: 'H1' });
    const found = computeDiagnostics(b.doc, registry).filter((d) => d.code === 'REF_REPEATED');
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe('warning');
    expect(blockingDiagnostics(computeDiagnostics(b.doc, registry))).toHaveLength(0);
  });

  it('avisa cuando no hay acometida y cuando un aparato quedó sin cables', () => {
    const b = new BoardBuilder();
    b.device('pilot-lamp', 0, 0);
    expect(codes(b)).toContain('NO_SOURCE');
    expect(codes(b)).toContain('UNWIRED_DEVICE');
  });

  it('un tablero cableado con su acometida no tiene avisos de red', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 40);
    b.wire(term(g, 'L'), term(h, 'X1'));
    expect(codes(b)).not.toContain('NO_SOURCE');
    expect(codes(b)).not.toContain('UNWIRED_DEVICE');
  });
});
