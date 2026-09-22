import { describe, expect, it } from 'vitest';
import { DEVICE_DEFINITIONS, boardRegistry } from '../../../src/core/board/catalog';
import { findTerminal } from '../../../src/core/board/registry';

describe('catálogo de aparatos', () => {
  it.each(DEVICE_DEFINITIONS.map((d) => [d.type, d] as const))('%s es coherente', (_type, def) => {
    const ids = def.terminals.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const terminal of def.terminals) {
      expect(Number.isInteger(terminal.offset.x)).toBe(true);
      expect(Number.isInteger(terminal.offset.y)).toBe(true);
      // El tornillo cae dentro del cuerpo del aparato.
      expect(terminal.offset.x).toBeGreaterThanOrEqual(def.bounds.minX);
      expect(terminal.offset.x).toBeLessThanOrEqual(def.bounds.maxX);
      expect(terminal.offset.y).toBeGreaterThanOrEqual(def.bounds.minY);
      expect(terminal.offset.y).toBeLessThanOrEqual(def.bounds.maxY);
    }

    const actuators = new Set(def.internals.actuators.map((a) => a.id));
    expect(actuators.size).toBe(def.internals.actuators.length);

    for (const actuator of def.internals.actuators) {
      if (actuator.kind === 'manual') continue;
      for (const id of actuator.terminals) expect(findTerminal(def, id)).toBeDefined();
    }
    for (const contact of def.internals.contacts) {
      expect(findTerminal(def, contact.a)).toBeDefined();
      expect(findTerminal(def, contact.b)).toBeDefined();
      expect(actuators.has(contact.actuator)).toBe(true);
    }
    for (const load of def.internals.loads) {
      expect(findTerminal(def, load.a)).toBeDefined();
      expect(findTerminal(def, load.b)).toBeDefined();
    }
    for (const source of def.internals.sources) {
      expect(source.phases.length).toBeGreaterThan(0);
      for (const phase of source.phases) expect(findTerminal(def, phase)).toBeDefined();
      expect(findTerminal(def, source.neutral)).toBeDefined();
    }

    const propKeys = def.props.map((p) => p.key);
    expect(new Set(propKeys).size).toBe(propKeys.length);
  });

  it('el contactor lleva la bobina arriba, sobre los bornes de potencia [R5 §9]', () => {
    const def = boardRegistry.require('contactor-3p');
    const a1 = findTerminal(def, 'A1')!;
    const a2 = findTerminal(def, 'A2')!;
    const l1 = findTerminal(def, '1')!;
    expect(a1.offset.y).toBeLessThan(l1.offset.y);
    expect(a2.offset.y).toBe(a1.offset.y);
    // Entre 1/L1 y 5/L3, no por fuera.
    expect(a1.offset.x).toBeGreaterThan(l1.offset.x);
    expect(a2.offset.x).toBeLessThan(findTerminal(def, '5')!.offset.x);
  });

  it('los bornes de potencia del contactor usan el tornillo grande [R5 §9]', () => {
    const def = boardRegistry.require('contactor-3p');
    for (const id of ['1', '3', '5', '2', '4', '6']) expect(findTerminal(def, id)!.screw).toBe('power');
    for (const id of ['A1', 'A2', '13', '14', '21', '22']) expect(findTerminal(def, id)!.screw).toBe('control');
  });

  it('el contactor tiene tres polos, un auxiliar NA y uno NC, todos movidos por su bobina', () => {
    const def = boardRegistry.require('contactor-3p');
    const contacts = def.internals.contacts;
    expect(contacts.filter((c) => c.normal === 'NO')).toHaveLength(4);
    expect(contacts.filter((c) => c.normal === 'NC')).toHaveLength(1);
    expect(contacts.every((c) => c.actuator === 'K')).toBe(true);
  });

  it('la acometida monofásica declara una fase y su neutro [R5 §2]', () => {
    const def = boardRegistry.require('supply-1p');
    expect(def.internals.sources).toHaveLength(1);
    expect(def.internals.sources[0]!.phases).toEqual(['L']);
    expect(def.internals.sources[0]!.neutral).toBe('N');
  });

  it('no hay componentes sueltos de la vista clásica [R5 §12]', () => {
    const types = DEVICE_DEFINITIONS.map((d) => d.type);
    for (const gone of ['coil', 'contact-no', 'contact-nc', 'timed-contact-no', 'timed-contact-nc']) {
      expect(types).not.toContain(gone);
    }
  });
});
