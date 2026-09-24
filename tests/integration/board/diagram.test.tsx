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
