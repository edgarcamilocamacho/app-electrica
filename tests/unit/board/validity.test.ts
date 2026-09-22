import { describe, expect, it } from 'vitest';
import { addedViolations, violations } from '../../../src/core/board/validity';
import { BoardBuilder, registry, term } from '../../fixtures/board';

const codes = (doc: Parameters<typeof violations>[0]) => violations(doc, registry).map((v) => v.code);

describe('validador del tablero', () => {
  it('un tablero bien cableado no tiene violaciones', () => {
    const b = new BoardBuilder();
    const supply = b.device('supply-1p', 0, 0);
    const lamp = b.device('pilot-lamp', 0, 40);
    b.wire(term(supply, 'L'), term(lamp, 'X1'));
    // El neutro rodea el piloto para no pasar por su borne X1.
    b.wire(term(supply, 'N'), term(lamp, 'X2'), {
      bends: [
        { x: 2, y: 20 },
        { x: 10, y: 20 },
        { x: 10, y: 55 },
        { x: 0, y: 55 },
      ],
    });
    expect(violations(b.doc, registry)).toEqual([]);
  });

  it('W1: dos cables de redes distintas no pueden compartir recorrido', () => {
    const b = new BoardBuilder();
    const supply = b.device('supply-1p', 0, 0);
    const lamp = b.device('pilot-lamp', 40, 0);
    // Dos cables por la misma vertical x = 20, en redes distintas.
    b.wire(term(supply, 'L'), term(lamp, 'X1'), {
      bends: [
        { x: 20, y: 7 },
        { x: 20, y: -7 },
      ],
    });
    b.wire(term(supply, 'N'), term(lamp, 'X2'), {
      bends: [
        { x: 20, y: 9 },
        { x: 20, y: -3 },
      ],
    });
    expect(codes(b.doc)).toContain('W1');
  });

  it('dos cables de la misma red sí pueden compartir recorrido [R5 §4]', () => {
    const b = new BoardBuilder();
    const supply = b.device('supply-1p', 0, 0);
    const lamp1 = b.device('pilot-lamp', 40, 0);
    const lamp2 = b.device('pilot-lamp', 40, 40);
    const shared = [
      { x: 20, y: 7 },
      { x: 20, y: -7 },
    ];
    b.wire(term(supply, 'L'), term(lamp1, 'X1'), { bends: shared });
    b.wire(term(supply, 'L'), term(lamp2, 'X1'), {
      bends: [
        { x: 20, y: 7 },
        { x: 20, y: 33 },
      ],
    });
    expect(codes(b.doc)).not.toContain('W1');
  });

  it('W2: un cable no puede pasar por un borne ajeno', () => {
    const b = new BoardBuilder();
    const supply = b.device('supply-1p', 0, 0);
    const lamp = b.device('pilot-lamp', 40, 0);
    const other = b.device('pilot-lamp', 20, 40);
    const target = b.position(term(other, 'X1'));
    b.wire(term(supply, 'L'), term(lamp, 'X1'), {
      bends: [
        { x: -2, y: target.y },
        { x: 42, y: target.y },
      ],
    });
    expect(codes(b.doc)).toContain('W2');
  });

  it('el cruce perpendicular es válido y no conecta [R2 §6]', () => {
    const b = new BoardBuilder();
    const supply = b.device('supply-1p', 0, 0);
    const lamp = b.device('pilot-lamp', 0, 40);
    const otherA = b.device('pilot-lamp', -30, 20);
    const otherB = b.device('pilot-lamp', 30, 20);
    b.wire(term(supply, 'L'), term(lamp, 'X1'), {
      bends: [
        { x: -2, y: 20 },
        { x: 0, y: 20 },
      ],
    });
    b.wire(term(otherA, 'X2'), term(otherB, 'X2'), {
      bends: [
        { x: -30, y: 34 },
        { x: 30, y: 34 },
      ],
    });
    expect(codes(b.doc)).not.toContain('W1');
    expect(codes(b.doc)).not.toContain('W3');
  });

  it('W4: dos aparatos no pueden superponerse [R5 §1]', () => {
    const b = new BoardBuilder();
    b.device('contactor-3p', 0, 0);
    b.device('contactor-3p', 5, 0);
    expect(codes(b.doc)).toContain('W4');
  });

  it('dos aparatos pegados, sin invadirse, son válidos', () => {
    const b = new BoardBuilder();
    b.device('pilot-lamp', 0, 0);
    b.device('pilot-lamp', 8, 0);
    expect(violations(b.doc, registry)).toEqual([]);
  });

  it('solo cuentan las violaciones que la operación agrega', () => {
    const before = new BoardBuilder();
    before.device('contactor-3p', 0, 0);
    before.device('contactor-3p', 5, 0);
    const previous = before.doc;

    const after = new BoardBuilder();
    after.device('contactor-3p', 0, 0);
    after.device('contactor-3p', 5, 0);
    after.device('pilot-lamp', 60, 0);
    expect(violations(previous, registry)).toHaveLength(1);
    expect(addedViolations(previous, after.doc, registry)).toEqual([]);
  });
});
