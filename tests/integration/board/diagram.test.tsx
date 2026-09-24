/** El diagrama dibuja los cables del más fino al más grueso [R7 §1], también al exportar. */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardDiagram } from '../../../src/app/board/BoardDiagram';
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
