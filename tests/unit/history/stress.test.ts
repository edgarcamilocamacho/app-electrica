import { describe, expect, it } from 'vitest';
import { commit, createHistory, redo, undo, type History } from '../../../src/core/history/history';
import { serializeDocument } from '../../../src/core/persistence/serialize';
import { selectionOf } from '../../../src/core/model/selection';
import type { CircuitDocument, Point } from '../../../src/core/model/types';
import {
  deleteSelection,
  drawWire,
  eraseTarget,
  moveSelection,
  placeComponent,
  rotateComponent,
  updateComponentProps,
  type EditResult,
} from '../../../src/core/topology/ops';
import { COMPONENT_DEFINITIONS } from '../../../src/core/registry/catalog';
import { randInt, rng } from '../../fixtures/builder';
import { ladder } from '../../fixtures/scenarios';
import { normalFormViolations } from '../../fixtures/invariants';
import { defaultRegistry } from '../../../src/core/registry/catalog';

/**
 * Estrés del historial (spec §18.5): secuencias largas y aleatorias de operaciones reales
 * (colocar → mover → cablear → rotar → editar → borrar …), después deshacer todo y rehacer todo.
 * El documento serializado tiene que coincidir exactamente en cada paso.
 */
function randomOp(doc: CircuitDocument, r: () => number, s: ReturnType<typeof ladder>): EditResult | CircuitDocument | undefined {
  const components = Object.keys(doc.components);
  const segments = Object.keys(doc.segments);
  const vertices = Object.keys(doc.vertices);
  const pick = <T,>(xs: T[]) => xs[randInt(r, 0, xs.length - 1)];
  const P = (): Point => ({ x: randInt(r, -10, 50), y: randInt(r, -20, 35) });
  switch (randInt(r, 0, 7)) {
    case 0: {
      const def = COMPONENT_DEFINITIONS[randInt(r, 0, COMPONENT_DEFINITIONS.length - 1)]!;
      return placeComponent(doc, { type: def.type, position: P(), rotation: pick([0, 90, 180, 270] as const)! }, s.ctx);
    }
    case 1:
    case 2: {
      const c = pick(components);
      return c ? moveSelection(doc, selectionOf({ components: [c] }), { x: randInt(r, -5, 5), y: randInt(r, -5, 5) }, s.ctx) : undefined;
    }
    case 3: {
      const a = P();
      const b = P();
      return drawWire(doc, [a, { x: b.x, y: a.y }, b], s.ctx);
    }
    case 4: {
      const c = pick(components);
      return c ? rotateComponent(doc, c, s.ctx) : undefined;
    }
    case 5: {
      const c = pick(components);
      return c ? updateComponentProps(doc, c, { label: `L${randInt(r, 0, 99)}` }, s.ctx) : undefined;
    }
    case 6: {
      const choice = randInt(r, 0, 2);
      if (choice === 0 && segments.length) return eraseTarget(doc, { kind: 'segment', id: pick(segments)! }, s.ctx);
      if (choice === 1 && vertices.length) return eraseTarget(doc, { kind: 'vertex', id: pick(vertices)! }, s.ctx);
      if (components.length) return eraseTarget(doc, { kind: 'component', id: pick(components)! }, s.ctx);
      return undefined;
    }
    default: {
      const sel = selectionOf({ components: components.filter(() => r() < 0.2), segments: segments.filter(() => r() < 0.1) });
      return deleteSelection(doc, sel, s.ctx);
    }
  }
}

describe('estrés de deshacer/rehacer (§18.5)', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`semilla ${seed}: 150 operaciones, deshacer todo, rehacer todo`, () => {
      const r = rng(seed);
      const s = ladder();
      let h: History<CircuitDocument> = createHistory(s.doc);
      const states: string[] = [serializeDocument(h.present)];
      let applied = 0;

      for (let i = 0; i < 150; i++) {
        const out = randomOp(h.present, r, s);
        if (!out) continue;
        const next = 'ok' in out ? (out.ok ? out.doc : undefined) : out;
        if (!next || next === h.present) continue;
        expect(normalFormViolations(next, defaultRegistry)).toEqual([]);
        h = commit(h, next);
        states.push(serializeDocument(h.present));
        applied++;
      }
      expect(applied).toBeGreaterThan(40);

      for (let i = states.length - 1; i > 0; i--) {
        expect(serializeDocument(h.present)).toBe(states[i]);
        h = undo(h);
      }
      expect(serializeDocument(h.present)).toBe(states[0]);

      for (let i = 1; i < states.length; i++) {
        h = redo(h);
        expect(serializeDocument(h.present)).toBe(states[i]);
      }
    });
  }
});
