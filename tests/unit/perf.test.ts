import { describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { SimEngine } from '../../src/core/sim/engine';
import { moveSelection } from '../../src/core/topology/ops';
import { selectionOf } from '../../src/core/model/selection';
import { computeDiagnostics } from '../../src/core/diagnostics/diagnostics';
import { defaultRegistry } from '../../src/core/registry/catalog';
import { ladderCircuit } from '../fixtures/circuits';

/**
 * Presupuesto de rendimiento (PLAN §19, M19): un diagrama de ~200 componentes.
 * Límites holgados para no volver frágil la suite; los valores medidos se reportan al fallar.
 */
describe('rendimiento con ~200 componentes', () => {
  const rungs = Array.from({ length: 66 }, (_, i) => [
    { name: `S${i}`, type: 'switch-no' },
    { name: `K${i}C`, type: 'contact-no', props: { link: `K${i}` } },
    { name: `K${i}`, type: 'coil' },
  ]);
  const s = ladderCircuit(rungs);
  const count = Object.keys(s.doc.components).length;

  it('el escenario tiene ~200 componentes', () => {
    expect(count).toBeGreaterThanOrEqual(199);
  });

  it('settle (reacción a una entrada) promedia < 16 ms', () => {
    const e = new SimEngine(s.doc, defaultRegistry);
    e.start();
    const t0 = performance.now();
    const N = 60;
    for (let i = 0; i < N; i++) e.toggle(s.ids[`S${i % 66}`]!);
    const avg = (performance.now() - t0) / N;
    console.info(`settle promedio ${avg.toFixed(2)} ms`);
    expect(avg, `settle promedio ${avg.toFixed(2)} ms`).toBeLessThan(16);
  });

  it('mover un componente (vista previa) promedia < 50 ms', () => {
    const t0 = performance.now();
    const N = 20;
    for (let i = 0; i < N; i++) {
      moveSelection(s.doc, selectionOf({ components: [s.ids[`K${i}`]!] }), { x: 3, y: 1 }, s.ctx);
    }
    const avg = (performance.now() - t0) / N;
    console.info(`mover promedio ${avg.toFixed(2)} ms`);
    expect(avg, `mover promedio ${avg.toFixed(2)} ms`).toBeLessThan(50);
  });

  it('diagnósticos completos < 50 ms', () => {
    const t0 = performance.now();
    computeDiagnostics(s.doc, defaultRegistry);
    const ms = performance.now() - t0;
    console.info(`diagnósticos ${ms.toFixed(2)} ms`);
    expect(ms, `diagnósticos ${ms.toFixed(2)} ms`).toBeLessThan(50);
  });
});
