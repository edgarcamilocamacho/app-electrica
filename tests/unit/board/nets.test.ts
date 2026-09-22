import { describe, expect, it } from 'vitest';
import { computeNets, netSignature } from '../../../src/core/board/nets';
import { wireCountByTerminal, terminalKey } from '../../../src/core/board/model';
import { BoardBuilder, registry, term } from '../../fixtures/board';

describe('redes del tablero', () => {
  it('dos bornes quedan en la misma red solo si un cable los une [R5 §4]', () => {
    const b = new BoardBuilder();
    const supply = b.device('supply-1p', 0, 0);
    const lamp = b.device('pilot-lamp', 0, 30);
    const nets = computeNets(b.doc, registry);
    expect(nets.connected(term(supply, 'L'), term(lamp, 'X1'))).toBe(false);

    b.wire(term(supply, 'L'), term(lamp, 'X1'));
    const after = computeNets(b.doc, registry);
    expect(after.connected(term(supply, 'L'), term(lamp, 'X1'))).toBe(true);
    expect(after.connected(term(supply, 'N'), term(lamp, 'X2'))).toBe(false);
  });

  it('una cadena de cables deja todos los bornes en la misma red', () => {
    const b = new BoardBuilder();
    const supply = b.device('supply-1p', 0, 0);
    const breaker = b.device('breaker-1p', 0, 30);
    const lamp = b.device('pilot-lamp', 0, 60);
    b.wire(term(supply, 'L'), term(breaker, '1'));
    b.wire(term(breaker, '2'), term(lamp, 'X1'));
    const nets = computeNets(b.doc, registry);
    expect(nets.connected(term(supply, 'L'), term(breaker, '1'))).toBe(true);
    expect(nets.connected(term(breaker, '2'), term(lamp, 'X1'))).toBe(true);
    // El taco no conduce por geometría: son dos redes distintas hasta que el contacto cierre.
    expect(nets.connected(term(breaker, '1'), term(breaker, '2'))).toBe(false);
  });

  it('dos bornes en la misma posición no se conectan sin cable [R5 §4]', () => {
    const b = new BoardBuilder();
    const lamp1 = b.device('pilot-lamp', 0, 0);
    const lamp2 = b.device('pilot-lamp', 0, 14);
    // X2 del primero y X1 del segundo caen exactamente en el mismo punto.
    expect(b.position(term(lamp1, 'X2'))).toEqual(b.position(term(lamp2, 'X1')));
    expect(computeNets(b.doc, registry).connected(term(lamp1, 'X2'), term(lamp2, 'X1'))).toBe(false);
  });

  it('la firma de la partición no depende del orden de los cables', () => {
    const one = new BoardBuilder();
    const s1 = one.device('supply-1p', 0, 0);
    const l1 = one.device('pilot-lamp', 0, 30);
    one.wire(term(s1, 'L'), term(l1, 'X1'));
    one.wire(term(s1, 'N'), term(l1, 'X2'));

    const two = new BoardBuilder();
    const s2 = two.device('supply-1p', 0, 0);
    const l2 = two.device('pilot-lamp', 0, 30);
    two.wire(term(s2, 'N'), term(l2, 'X2'));
    two.wire(term(s2, 'L'), term(l2, 'X1'));

    expect(netSignature(one.doc, registry)).toEqual(netSignature(two.doc, registry));
  });

  it('cuenta los cables de cada borne, para el número del tornillo [R5 §6]', () => {
    const b = new BoardBuilder();
    const supply = b.device('supply-1p', 0, 0);
    const lamp1 = b.device('pilot-lamp', -20, 30);
    const lamp2 = b.device('pilot-lamp', 20, 30);
    b.wire(term(supply, 'L'), term(lamp1, 'X1'));
    b.wire(term(supply, 'L'), term(lamp2, 'X1'));
    const counts = wireCountByTerminal(b.doc);
    expect(counts.get(terminalKey(term(supply, 'L')))).toBe(2);
    expect(counts.get(terminalKey(term(lamp1, 'X1')))).toBe(1);
    expect(counts.get(terminalKey(term(supply, 'N')))).toBeUndefined();
  });
});
