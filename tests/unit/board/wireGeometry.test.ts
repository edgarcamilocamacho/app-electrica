import { describe, expect, it } from 'vitest';
import {
  approachTerminal,
  autoRoute,
  bendsOf,
  isOrthogonalRoute,
  normalizeRoute,
  repairRoute,
  routeSegments,
  wireRoute,
} from '../../../src/core/board/wireGeometry';
import { BoardBuilder, registry, term } from '../../fixtures/board';

const pt = (x: number, y: number) => ({ x, y });

describe('normalizeRoute', () => {
  it('quita puntos repetidos y codos que no doblan', () => {
    const route = normalizeRoute([pt(0, 0), pt(0, 0), pt(0, 5), pt(0, 9), pt(4, 9)]);
    expect(route).toEqual([pt(0, 0), pt(0, 9), pt(4, 9)]);
  });

  it('deja los codos verdaderos', () => {
    expect(bendsOf([pt(0, 0), pt(0, 4), pt(6, 4), pt(6, 8)])).toEqual([pt(0, 4), pt(6, 4)]);
  });
});

describe('autoRoute', () => {
  it('sale recto del tornillo y llega sin codos cuando están alineados', () => {
    const route = autoRoute(pt(0, 0), 'N', pt(0, -20), 'S');
    expect(route).toEqual([pt(0, 0), pt(0, -20)]);
    expect(isOrthogonalRoute(route)).toBe(true);
  });

  it('usa dos codos entre dos bornes verticales desalineados', () => {
    const route = autoRoute(pt(0, 0), 'N', pt(10, -20), 'S');
    expect(bendsOf(route)).toHaveLength(2);
    expect(isOrthogonalRoute(route)).toBe(true);
    expect(route[0]).toEqual(pt(0, 0));
    expect(route[route.length - 1]).toEqual(pt(10, -20));
  });

  it('usa un codo entre un borne vertical y uno horizontal', () => {
    const route = autoRoute(pt(0, 0), 'N', pt(10, -20), 'W');
    expect(isOrthogonalRoute(route)).toBe(true);
    expect(bendsOf(route).length).toBeLessThanOrEqual(2);
  });

  it('si el tramo de salida queda alineado con el destino, la ruta sale recta', () => {
    // El cable puede pasar por encima de un aparato [R1 §8]: no se inventa un rodeo.
    const route = autoRoute(pt(0, 0), 'N', pt(0, 20), 'N');
    expect(route).toEqual([pt(0, 0), pt(0, 20)]);
    expect(isOrthogonalRoute(route)).toBe(true);
  });
});

describe('repairRoute', () => {
  it('estira el codo vecino cuando el borne se mueve en perpendicular', () => {
    const route = [pt(0, 0), pt(0, 6), pt(10, 6), pt(10, 12)];
    const repaired = repairRoute(route, pt(3, 0), pt(10, 12), 'S', 'N');
    expect(repaired).toEqual([pt(3, 0), pt(3, 6), pt(10, 6), pt(10, 12)]);
    expect(isOrthogonalRoute(repaired)).toBe(true);
  });

  it('vuelve a rutear si la forma vieja ya no sirve', () => {
    const route = [pt(0, 0), pt(0, 10)];
    const repaired = repairRoute(route, pt(0, 0), pt(7, 10), 'S', 'N');
    expect(isOrthogonalRoute(repaired)).toBe(true);
    expect(repaired[0]).toEqual(pt(0, 0));
    expect(repaired[repaired.length - 1]).toEqual(pt(7, 10));
  });
});

describe('ruta de un cable del documento', () => {
  it('va de tornillo a tornillo [R5 §4]', () => {
    const b = new BoardBuilder();
    const supply = b.device('supply-1p', 0, 0);
    const lamp = b.device('pilot-lamp', 0, 30);
    const id = b.wire(term(supply, 'L'), term(lamp, 'X1'));
    const route = wireRoute(b.doc, registry, b.doc.wires[id]!);
    expect(route[0]).toEqual(b.position(term(supply, 'L')));
    expect(route[route.length - 1]).toEqual(b.position(term(lamp, 'X1')));
    expect(isOrthogonalRoute(route)).toBe(true);
    expect(routeSegments(route).length).toBeGreaterThan(0);
  });
});

/** ¿La ruta vuelve sobre sí misma en algún tramo? Eso es lo que dibuja "cuadrados raros". */
function hasReversal(route: readonly { x: number; y: number }[]): boolean {
  for (let i = 2; i < route.length; i += 1) {
    const a = route[i - 2]!;
    const b = route[i - 1]!;
    const c = route[i]!;
    const d1 = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
    const d2 = { x: Math.sign(c.x - b.x), y: Math.sign(c.y - b.y) };
    if (d1.x === -d2.x && d1.y === -d2.y && (d2.x !== 0 || d2.y !== 0)) return true;
  }
  return false;
}

describe('approachTerminal', () => {
  it('desde otra columna, rodea y entra por el lado del tornillo, sin volver sobre sí mismo', () => {
    // Borne que sale al sur en (20, 10); el cable viene desde arriba a la izquierda.
    const route = [pt(4, 4), ...approachTerminal(pt(4, 4), pt(20, 10), 'S')];
    expect(isOrthogonalRoute(route)).toBe(true);
    expect(hasReversal(route)).toBe(false);
    expect(route[route.length - 1]).toEqual(pt(20, 10));
    // El último tramo entra hacia el norte, es decir por debajo del borne.
    const beforeEnd = route[route.length - 2]!;
    expect(beforeEnd.x).toBe(20);
    expect(beforeEnd.y).toBeGreaterThan(10);
  });

  it('si ya viene por el lado correcto y la misma columna, entra derecho', () => {
    const route = [pt(20, 30), ...approachTerminal(pt(20, 30), pt(20, 10), 'S')];
    expect(route).toEqual([pt(20, 30), pt(20, 10)]);
  });

  it('si viene por la columna equivocada, se corre al costado en vez de atravesar el aparato', () => {
    const route = [pt(20, 2), ...approachTerminal(pt(20, 2), pt(20, 10), 'S')];
    expect(isOrthogonalRoute(route)).toBe(true);
    expect(hasReversal(route)).toBe(false);
    expect(route.some((p) => p.x !== 20)).toBe(true);
    expect(route[route.length - 1]).toEqual(pt(20, 10));
  });

  it('lo mismo con un borne que sale al norte', () => {
    const route = [pt(40, 40), ...approachTerminal(pt(40, 40), pt(20, 10), 'N')];
    expect(isOrthogonalRoute(route)).toBe(true);
    expect(hasReversal(route)).toBe(false);
    const beforeEnd = route[route.length - 2]!;
    expect(beforeEnd.x).toBe(20);
    expect(beforeEnd.y).toBeLessThan(10);
  });
});
