/** Color del esquema interno durante la simulación: el del cable de cada borne [R7 §4]. */
import { describe, expect, it } from 'vitest';
import { terminalLights } from '../../../src/app/board/lights';
import { BOARD_PALETTE, WIRE_TONES } from '../../../src/app/board/theme';
import { computeNets } from '../../../src/core/board/nets';
import { BoardSimEngine } from '../../../src/core/board/sim/engine';
import { BoardBuilder, registry, term } from '../../fixtures/board';

const lightsOf = (b: BoardBuilder, engine: BoardSimEngine) =>
  terminalLights(b.doc, registry, computeNets(b.doc, registry), engine.snapshot());

describe('luces del esquema interno [R7 §4]', () => {
  it('sin simulación no hay nada iluminado', () => {
    const b = new BoardBuilder();
    b.device('supply-1p', 0, 0);
    expect(terminalLights(b.doc, registry, computeNets(b.doc, registry), null).size).toBe(0);
  });

  it('cada borne con tensión toma el color de su cable; sin tensión, nada', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const s = b.device('switch-no', 30, 0);
    const h = b.device('pilot-lamp', 60, 0);
    b.wire(term(g, 'L'), term(s, '13'), { color: 'brown' });
    b.wire(term(s, '14'), term(h, 'X1'), { color: 'red' });
    b.wire(term(h, 'X2'), term(g, 'N'), { color: 'blue' });
    const engine = new BoardSimEngine(b.doc, registry);
    engine.start();
    let lights = lightsOf(b, engine);
    expect(lights.get(s)?.get('13')).toEqual({ color: WIRE_TONES.brown.on, glow: WIRE_TONES.brown.glow });
    expect(lights.get(s)?.has('14')).toBe(false);
    expect(lights.get(h)?.has('X1')).toBe(false);
    expect(lights.get(h)?.get('X2')?.color).toBe(WIRE_TONES.blue.on);

    engine.toggle(s);
    lights = lightsOf(b, engine);
    expect(lights.get(s)?.get('14')?.color).toBe(WIRE_TONES.red.on);
    expect(lights.get(h)?.get('X1')?.color).toBe(WIRE_TONES.red.on);
  });

  it('con varios cables en un borne manda el más grueso', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h1 = b.device('pilot-lamp', 30, 0);
    const h2 = b.device('pilot-lamp', 60, 0);
    b.wire(term(g, 'L'), term(h1, 'X1'), { color: 'red', gauge: 1 });
    b.wire(term(g, 'L'), term(h2, 'X1'), { color: 'black', gauge: 3 });
    const engine = new BoardSimEngine(b.doc, registry);
    engine.start();
    expect(lightsOf(b, engine).get(g)?.get('L')?.color).toBe(WIRE_TONES.black.on);
  });

  it('una salida sin cable toma el color que le llega por el contacto cerrado', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const s = b.device('switch-no', 30, 0, { initiallyActuated: true });
    b.wire(term(g, 'L'), term(s, '13'), { color: 'yellow' });
    const engine = new BoardSimEngine(b.doc, registry);
    engine.start();
    expect(lightsOf(b, engine).get(s)?.get('14')?.color).toBe(WIRE_TONES.yellow.on);
  });

  it('en un cortocircuito, el rojo de falla y sin brillo', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    b.wire(term(g, 'L'), term(g, 'N'), { color: 'green' });
    const engine = new BoardSimEngine(b.doc, registry);
    engine.start();
    expect(lightsOf(b, engine).get(g)?.get('L')).toEqual({ color: BOARD_PALETTE.short });
  });
});
