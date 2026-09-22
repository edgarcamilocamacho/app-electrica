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
  return { x: Number(text.getAttribute('x')), y: Number(text.getAttribute('y')), anchor: text.getAttribute('text-anchor') };
}

describe('textos de los componentes (R4 §7)', () => {
  it('vertical: la referencia arranca pegada a la esquina inferior derecha; horizontal: justo debajo y centrada', () => {
    const { store } = createTestStore();
    const s = () => store.getState();
    s().startPlacing('contact-nc');
    click(store, 10, 5);
    s().rotate(); // las siguientes, a 90°
    click(store, 30, 5);
    s().rotate();
    s().rotate(); // y a 270°
    click(store, 50, 5);
    const d = doc(store);
    const ids = Object.values(d.components).map((c) => c.id);
    // Sin bobina los contactos no tienen referencia: se les pone una a mano.
    const withRefs = { ...d, components: Object.fromEntries(ids.map((id, i) => [id, { ...d.components[id]!, props: { ...d.components[id]!.props, ref: `X${i + 1}` } }])) };
    const { container } = render(<Diagram doc={withRefs} registry={defaultRegistry} classes={s().vertexClasses} />);
    for (const [ref, x, rotation] of [['X1', 10, 0], ['X2', 30, 90], ['X3', 50, 270]] as const) {
      const body = rotateRect(SYMBOL_BODIES['contact-nc']!, rotation);
      const p = refText(container, ref);
      if (rotation === 0) {
        expect(p.x).toBeCloseTo(x + body.maxX + 0.15);
        expect(p.anchor).toBe('start');
      } else {
        expect(p.x).toBeCloseTo(x + (body.minX + body.maxX) / 2);
        expect(p.anchor).toBe('middle');
      }
      // Primera línea: su parte alta queda justo debajo del símbolo.
      expect(p.y).toBeGreaterThan(5 + body.maxY);
      expect(p.y).toBeLessThan(5 + body.maxY + 1.1);
    }
  });

  it('todos los símbolos del catálogo tienen contorno para ubicar sus textos', () => {
    for (const def of defaultRegistry.all()) expect(SYMBOL_BODIES[def.type], def.type).toBeDefined();
  });
});
