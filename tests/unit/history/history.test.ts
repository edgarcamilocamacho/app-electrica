import { describe, expect, it } from 'vitest';
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  replacePresent,
  undo,
} from '../../../src/core/history/history';

describe('historial — primitivas', () => {
  it('commit / undo / redo recorren los estados', () => {
    let h = createHistory('a');
    h = commit(h, 'b');
    h = commit(h, 'c');
    expect(h.present).toBe('c');
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe('c');
    expect(canRedo(h)).toBe(false);
  });

  it('un commit nuevo descarta el futuro', () => {
    let h = commit(commit(createHistory(1), 2), 3);
    h = undo(h);
    h = commit(h, 99);
    expect(h.present).toBe(99);
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe(2);
  });

  it('commit del mismo estado no crea entrada', () => {
    const h0 = createHistory({ n: 1 });
    expect(commit(h0, h0.present)).toBe(h0);
  });

  it('undo y redo en los extremos no hacen nada', () => {
    const h = createHistory('x');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('respeta el límite de entradas descartando las más viejas', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 10; i++) h = commit(h, i, { limit: 3 });
    expect(h.past).toEqual([7, 8, 9]);
  });

  it('replacePresent no crea entrada de historial', () => {
    let h = commit(createHistory('a'), 'b');
    h = replacePresent(h, 'b2');
    expect(h.present).toBe('b2');
    expect(undo(h).present).toBe('a');
  });
});

describe('historial — coalescencia', () => {
  it('commits con la misma clave dentro de la ventana forman una sola entrada', () => {
    let h = createHistory('');
    h = commit(h, 'H', { coalesceKey: 'label', now: 0 });
    h = commit(h, 'Ho', { coalesceKey: 'label', now: 100 });
    h = commit(h, 'Hol', { coalesceKey: 'label', now: 200 });
    h = commit(h, 'Hola', { coalesceKey: 'label', now: 300 });
    expect(h.present).toBe('Hola');
    expect(undo(h).present).toBe('');
  });

  it('fuera de la ventana se crea una entrada nueva', () => {
    let h = createHistory('');
    h = commit(h, 'a', { coalesceKey: 'k', now: 0 });
    h = commit(h, 'ab', { coalesceKey: 'k', now: 5000 });
    expect(undo(h).present).toBe('a');
  });

  it('claves distintas no se funden, y los commits sin clave nunca se funden', () => {
    let h = createHistory(0);
    h = commit(h, 1, { coalesceKey: 'x', now: 0 });
    h = commit(h, 2, { coalesceKey: 'y', now: 1 });
    h = commit(h, 3, { now: 2 });
    h = commit(h, 4, { now: 3 });
    expect(h.past).toEqual([0, 1, 2, 3]);
  });

  it('después de deshacer, el siguiente commit no se funde con lo deshecho', () => {
    let h = createHistory('');
    h = commit(h, 'a', { coalesceKey: 'k', now: 0 });
    h = undo(h);
    h = commit(h, 'b', { coalesceKey: 'k', now: 10 });
    expect(h.past).toEqual(['']);
  });
});
