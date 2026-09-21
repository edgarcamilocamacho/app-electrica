import { describe, expect, it } from 'vitest';
import { componentBounds, componentTerminals } from '../../../src/core/model/document';
import { rotateDir, rotateOffset } from '../../../src/core/model/geometry';
import { COMPONENT_DEFINITIONS, defaultRegistry } from '../../../src/core/registry/catalog';
import type { ComponentInstance, Rotation } from '../../../src/core/model/types';

const coil = (rotation: Rotation): ComponentInstance => ({
  id: 'c1',
  type: 'coil',
  position: { x: 10, y: 20 },
  rotation,
  props: {},
});

describe('rotación de terminales', () => {
  it.each([
    [0, { x: 10, y: 17 }, 'N', { x: 10, y: 23 }, 'S'],
    [90, { x: 13, y: 20 }, 'E', { x: 7, y: 20 }, 'W'],
    [180, { x: 10, y: 23 }, 'S', { x: 10, y: 17 }, 'N'],
    [270, { x: 7, y: 20 }, 'W', { x: 13, y: 20 }, 'E'],
  ] as const)('a %i° A1 queda en %o hacia %s y A2 en %o hacia %s', (rotation, a1, d1, a2, d2) => {
    const [t1, t2] = componentTerminals(coil(rotation), defaultRegistry);
    expect(t1).toMatchObject({ terminalId: 'A1', position: a1, dir: d1 });
    expect(t2).toMatchObject({ terminalId: 'A2', position: a2, dir: d2 });
  });

  it('cuatro rotaciones vuelven al punto de partida', () => {
    let p = { x: 3, y: -2 };
    for (let i = 0; i < 4; i++) p = rotateOffset(p, 90);
    expect(p).toEqual({ x: 3, y: -2 });
    expect(rotateDir(rotateDir('N', 180), 180)).toBe('N');
  });

  it('las coordenadas rotadas son enteras y sin -0', () => {
    for (const r of [0, 90, 180, 270] as const) {
      const p = rotateOffset({ x: 0, y: -3 }, r);
      expect(Object.is(p.x, -0) || Object.is(p.y, -0)).toBe(false);
    }
  });

  it('la caja del símbolo rota con el componente', () => {
    expect(componentBounds(coil(0), defaultRegistry)).toEqual({ minX: 8, minY: 17, maxX: 12, maxY: 23 });
    expect(componentBounds(coil(90), defaultRegistry)).toEqual({ minX: 7, minY: 18, maxX: 13, maxY: 22 });
  });
});

describe('catálogo', () => {
  it('todo terminal cae dentro de la caja del símbolo y en coordenadas enteras', () => {
    for (const def of COMPONENT_DEFINITIONS) {
      for (const t of def.terminals) {
        expect(Number.isInteger(t.offset.x) && Number.isInteger(t.offset.y)).toBe(true);
        expect(t.offset.x >= def.bounds.minX && t.offset.x <= def.bounds.maxX, `${def.type}.${t.id}`).toBe(true);
        expect(t.offset.y >= def.bounds.minY && t.offset.y <= def.bounds.maxY, `${def.type}.${t.id}`).toBe(true);
      }
    }
  });

  it('incluye TON y TOF como tipos distintos y ningún temporizador retentivo ni de impulso', () => {
    const timers = COMPONENT_DEFINITIONS.filter((d) => d.behavior.kind === 'timer').map((d) => d.type);
    expect(timers).toEqual(['timer-ton', 'timer-tof']);
  });
});
