/** El diagrama dibuja los cables del más fino al más grueso [R7 §1], también al exportar. */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardDiagram } from '../../../src/app/board/BoardDiagram';
import { WIRE_TONES } from '../../../src/app/board/theme';
import { BoardSimEngine } from '../../../src/core/board/sim/engine';
import { BoardBuilder, registry, term } from '../../fixtures/board';

describe('diagrama del tablero', () => {
  it('el cable grueso queda encima del fino aunque se haya hecho antes', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h = b.device('pilot-lamp', 0, 30);
    const thick = b.wire(term(g, 'L'), term(h, 'X1'), { gauge: 3 });
    const thin = b.wire(term(g, 'L'), term(h, 'X1'), { gauge: 1 });
    const { container } = render(
      <svg>
        <BoardDiagram doc={b.doc} registry={registry} />
      </svg>,
    );
    const order = [...container.querySelectorAll('[data-wire]')].map((el) => el.getAttribute('data-wire'));
    // En SVG, lo que va después se pinta encima.
    expect(order).toEqual([thin, thick]);
  });

  it('entre cables de la misma red no hay funda que los corte; entre redes distintas, sí [R7 §3]', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const h1 = b.device('pilot-lamp', 0, 30);
    const h2 = b.device('pilot-lamp', 20, 30);
    const line = [b.wire(term(g, 'L'), term(h1, 'X1'), { gauge: 3 }), b.wire(term(h1, 'X1'), term(h2, 'X1'), { gauge: 1 })];
    const neutral = b.wire(term(g, 'N'), term(h1, 'X2'), { gauge: 2 });
    const { container } = render(
      <svg>
        <BoardDiagram doc={b.doc} registry={registry} />
      </svg>,
    );
    // Orden de pintado: cada elemento tapa a los anteriores.
    const painted = [...container.querySelectorAll('[data-part="sleeve"], [data-wire]')].map((el) =>
      el.hasAttribute('data-wire') ? `wire:${el.getAttribute('data-wire')}` : 'sleeve',
    );
    const at = (key: string) => painted.indexOf(key);
    const lineWires = line.map((id) => at(`wire:${id}`));
    // Ninguna funda cae entre los cables de la red de L: se tocan sin corte.
    const sleevesBetween = painted.slice(Math.min(...lineWires), Math.max(...lineWires)).filter((p) => p === 'sleeve');
    expect(sleevesBetween).toEqual([]);
    // La red de L va encima de la del neutro: sus fundas cortan al neutro donde se cruzan.
    expect(painted.lastIndexOf('sleeve')).toBeGreaterThan(at(`wire:${neutral}`));
  });

  it('simulando, el esquema interno se ilumina del color del cable de cada borne [R7 §4]', () => {
    const b = new BoardBuilder();
    const g = b.device('supply-1p', 0, 0);
    const k = b.device('contactor-3p', 40, 0, { ref: 'K1' });
    b.wire(term(g, 'L'), term(k, '1'), { color: 'brown', gauge: 3 });
    b.wire(term(g, 'L'), term(k, 'A1'), { color: 'red' });
    b.wire(term(k, 'A2'), term(g, 'N'), { color: 'blue' });
    const engine = new BoardSimEngine(b.doc, registry);
    const { container, rerender } = render(
      <svg>
        <BoardDiagram doc={b.doc} registry={registry} />
      </svg>,
    );
    expect(container.querySelectorAll('[data-lit="true"]')).toHaveLength(0);

    rerender(
      <svg>
        <BoardDiagram doc={b.doc} registry={registry} sim={engine.start()} />
      </svg>,
    );
    const strokes = [...container.querySelectorAll('[data-lit="true"] > path:last-child')].map((p) => p.getAttribute('stroke'));
    // El polo 1-2 (cerrado: la bobina está energizada) sigue el marrón de L hasta el borne 2, sin cable.
    expect(strokes.filter((c) => c === WIRE_TONES.brown.on).length).toBeGreaterThanOrEqual(3);
    expect(strokes).toContain(WIRE_TONES.red.on);
    expect(strokes).toContain(WIRE_TONES.blue.on);
    expect(container.querySelector('[data-ref="K1"]')?.getAttribute('data-lit')).toBe('1 2 A1 A2');
  });

  it('el temporizador mixto se dibuja con la carátula MIXTO', () => {
    const b = new BoardBuilder();
    b.device('timer-mixed', 0, 0, { ref: 'KT1' });
    const { container } = render(
      <svg>
        <BoardDiagram doc={b.doc} registry={registry} />
      </svg>,
    );
    expect(container.textContent).toContain('MIXTO');
    expect(container.textContent).toContain('KT1');
  });
});
