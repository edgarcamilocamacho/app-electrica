import { describe, expect, it } from 'vitest';
import { moveSelection } from '../../../src/core/topology/ops';
import { selectionOf } from '../../../src/core/model/selection';
import { computeViolations } from '../../../src/core/topology/validity';
import { defaultRegistry } from '../../../src/core/registry/catalog';
import { ladder, sealIn, type Scenario } from '../../fixtures/scenarios';
import { normalFormViolations } from '../../fixtures/invariants';
import { partition } from '../../fixtures/queries';

/**
 * Regresión de ruteo (spec §18.4). Para cada fixture y cada movimiento aceptado:
 *   · todos los segmentos ortogonales (forma normal);
 *   · los terminales siguen conectados a lo mismo (sin fusiones ni cortes no deseados);
 *   · ninguna superposición ni contacto ambiguo entre redes;
 *   · repetir la misma operación da exactamente el mismo resultado.
 */
type Fixture = { name: string; build: () => Scenario; component: string };

const fixtures: Fixture[] = [
  { name: 'escalera · lámpara central', build: () => ladder(), component: 'H2' },
  { name: 'escalera · interruptor lateral', build: () => ladder(), component: 'S3' },
  { name: 'escalera · fuente', build: () => ladder(), component: 'G1' },
  { name: 'autorretención · bobina', build: () => sealIn(), component: 'K1' },
  { name: 'autorretención · contacto de retención', build: () => sealIn(), component: 'K11' },
  { name: 'autorretención · lámpara', build: () => sealIn(), component: 'H1' },
];

const deltas: { x: number; y: number }[] = [];
for (let dx = -6; dx <= 6; dx += 2) for (let dy = -6; dy <= 6; dy += 2) if (dx || dy) deltas.push({ x: dx, y: dy });

describe('regresión de ruteo (§18.4)', () => {
  for (const f of fixtures) {
    it(f.name, () => {
      const base = f.build();
      expect(computeViolations(base.doc, defaultRegistry)).toEqual([]);
      const before = partition(base.doc);
      let accepted = 0;
      for (const delta of deltas) {
        // Cada movimiento parte de un escenario recién construido: el generador de ids arranca
        // igual, así que dos corridas deben producir exactamente el mismo documento.
        const s1 = f.build();
        const s2 = f.build();
        const r = moveSelection(s1.doc, selectionOf({ components: [s1.ids[f.component]!] }), delta, s1.ctx);
        const r2 = moveSelection(s2.doc, selectionOf({ components: [s2.ids[f.component]!] }), delta, s2.ctx);
        expect(r2.doc).toEqual(r.doc);
        if (!r.ok) continue;
        accepted++;
        const where = `${f.name} Δ${delta.x},${delta.y}`;
        expect(normalFormViolations(r.doc, defaultRegistry), where).toEqual([]);
        expect(computeViolations(r.doc, defaultRegistry), where).toEqual([]);
        // Un movimiento puede CONECTAR terminales libres que aterrizan en un conductor, pero nunca
        // separar lo que estaba unido: cada grupo previo sigue contenido en un grupo nuevo.
        const after = partition(r.doc);
        for (const group of before) {
          const host = after.find((g) => g.includes(group[0]!))!;
          for (const t of group) expect(host, where).toContain(t);
        }
      }
      // Tasa de aceptación: la mayoría de las posiciones razonables tienen una ruta sin ambigüedad.
      expect(accepted / deltas.length, `${f.name}: aceptadas ${accepted}/${deltas.length}`).toBeGreaterThanOrEqual(0.5);
    });
  }
});
