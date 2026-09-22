import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Diagram } from '../../src/app/canvas/Diagram';
import { SYMBOL_BODIES } from '../../src/app/symbols/Symbols';
import { rotateRect } from '../../src/core/model/geometry';
import { defaultRegistry } from '../../src/core/registry/catalog';
import { click, createTestStore, doc } from './helpers';

function refText(container: HTMLElement, ref: string) {
  const text = [...container.querySelectorAll(`[data-ref="${ref}"] text`)].find((n) => n.textContent === ref);
  if (!text) throw new Error(`Sin texto para ${ref}`);
  return { x: Number(text.getAttribute('x')), y: Number(text.getAttribute('y')) };
}

describe('textos de los componentes (R4 §7)', () => {
  it('la referencia arranca pegada a la esquina inferior derecha del símbolo, también rotado', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().startPlacing('coil');
    click(store, 10, 5);
    s().rotate(); // la siguiente, a 90°
    click(store, 30, 5);
    const { container } = render(<Diagram doc={doc(store)} registry={defaultRegistry} classes={s().vertexClasses} />);
    for (const [ref, x, rotation] of [['K1', 10, 0], ['K2', 30, 90]] as const) {
      const body = rotateRect(SYMBOL_BODIES.coil!, rotation);
      const p = refText(container, ref);
      expect(p.x).toBeCloseTo(x + body.maxX + 0.15);
      // Primera línea: su parte alta queda justo debajo del símbolo.
      expect(p.y).toBeGreaterThan(5 + body.maxY);
      expect(p.y).toBeLessThan(5 + body.maxY + 1.1);
    }
  });

  it('todos los símbolos del catálogo tienen contorno para ubicar sus textos', () => {
    for (const def of defaultRegistry.all()) expect(SYMBOL_BODIES[def.type], def.type).toBeDefined();
  });
});
