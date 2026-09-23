import { describe, expect, it } from 'vitest';
import { boardRegistry } from '../../../src/core/board/catalog';
import { deviceRect, endDir, terminalPosition, toTerminal } from '../../../src/core/board/model';
import { computeNets } from '../../../src/core/board/nets';
import { rotateSelection, type OpContext } from '../../../src/core/board/ops';
import { isOrthogonalRoute, wireRoute } from '../../../src/core/board/wireGeometry';
import { BoardBuilder, ref, term } from '../../fixtures/board';

const ctx = (b: BoardBuilder): OpContext => ({ ids: b.ids, registry: boardRegistry });

describe('giro de aparatos [R5 §19]', () => {
  it('un cuarto de vuelta lleva el borne de arriba al costado derecho', () => {
    const b = new BoardBuilder();
    // El piloto tiene X1 arriba y X2 abajo.
    const lamp = b.device('pilot-lamp', 0, 0);
    const before = terminalPosition(b.doc, boardRegistry, ref(lamp, 'X1'));
    expect(before.y).toBeLessThan(0);
    expect(before.x).toBe(0);

    const result = rotateSelection(b.doc, { devices: [lamp] }, ctx(b));
    expect(result.ok).toBe(true);
    const after = terminalPosition(result.doc, boardRegistry, ref(lamp, 'X1'));
    expect(after.x).toBe(-before.y);
    expect(after.y).toBe(0);
    expect(endDir(result.doc, boardRegistry, toTerminal(ref(lamp, 'X1')))).toBe('E');
  });

  it('cuatro cuartos de vuelta dejan todo como estaba', () => {
    const b = new BoardBuilder();
    const k = b.device('contactor-3p', 0, 0);
    const start = terminalPosition(b.doc, boardRegistry, ref(k, 'A1'));
    let doc = b.doc;
    for (let i = 0; i < 4; i += 1) doc = rotateSelection(doc, { devices: [k] }, ctx(b)).doc;
    expect(doc.devices[k]!.rotation).toBe(0);
    expect(terminalPosition(doc, boardRegistry, ref(k, 'A1'))).toEqual(start);
  });

  it('la caja del aparato gira con él', () => {
    const b = new BoardBuilder();
    const q = b.device('breaker-3p', 0, 0);
    const before = deviceRect(b.doc.devices[q]!, boardRegistry.require('breaker-3p'));
    const doc = rotateSelection(b.doc, { devices: [q] }, ctx(b)).doc;
    const after = deviceRect(doc.devices[q]!, boardRegistry.require('breaker-3p'));
    expect(after.maxX - after.minX).toBeCloseTo(before.maxY - before.minY);
    expect(after.maxY - after.minY).toBeCloseTo(before.maxX - before.minX);
  });

  it('el cable sigue al borne y queda ortogonal, sin cambiar la red', () => {
    const b = new BoardBuilder();
    const supply = b.device('supply-1p', 0, 0);
    const lamp = b.device('pilot-lamp', 0, 40);
    const wireId = b.wire(term(supply, 'L'), term(lamp, 'X1'));

    const result = rotateSelection(b.doc, { devices: [lamp] }, ctx(b));
    expect(result.ok).toBe(true);
    const route = wireRoute(result.doc, boardRegistry, result.doc.wires[wireId]!);
    expect(isOrthogonalRoute(route)).toBe(true);
    expect(route[route.length - 1]).toEqual(terminalPosition(result.doc, boardRegistry, ref(lamp, 'X1')));
    expect(computeNets(result.doc, boardRegistry).connected(ref(supply, 'L'), ref(lamp, 'X1'))).toBe(true);
  });

  it('girar sobre otro aparato se rechaza por superposición', () => {
    const b = new BoardBuilder();
    // Una acometida trifásica es mucho más ancha que alta: al girar invade a su vecino.
    b.device('supply-3p', 0, 0);
    const other = b.device('supply-3p', 0, 17);
    const result = rotateSelection(b.doc, { devices: [other] }, ctx(b));
    expect(result.ok).toBe(false);
  });

  it('sin aparatos seleccionados no hace nada', () => {
    const b = new BoardBuilder();
    expect(rotateSelection(b.doc, { devices: [] }, ctx(b)).ok).toBe(false);
  });
});
