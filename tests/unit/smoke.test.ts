import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from '../../src/core';

describe('núcleo', () => {
  it('se importa sin DOM', () => {
    expect(CORE_VERSION).toBe(1);
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
  });
});
