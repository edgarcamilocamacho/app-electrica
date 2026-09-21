import { describe, expect, it } from 'vitest';
import { formatSeconds, msToSecondsText, parseSecondsText } from '../../src/app/i18n/format';
import { t } from '../../src/app/i18n/t';

describe('formato en español', () => {
  it('segundos con coma decimal', () => {
    expect(formatSeconds(3200)).toBe('3,2 s');
    expect(msToSecondsText(5000)).toBe('5');
    expect(msToSecondsText(2550)).toBe('2,55');
  });

  it('acepta coma o punto al editar el preset', () => {
    expect(parseSecondsText('3,5')).toBe(3500);
    expect(parseSecondsText('0.25')).toBe(250);
    expect(parseSecondsText(' 12 ')).toBe(12000);
    expect(parseSecondsText('abc')).toBeUndefined();
    expect(parseSecondsText('')).toBeUndefined();
  });

  it('t() interpola parámetros y devuelve la clave si falta el texto', () => {
    expect(t('status.zoom', { value: 150 })).toBe('Zoom 150 %');
  });
});
