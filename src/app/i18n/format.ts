import { t } from './t';

const seconds = new Intl.NumberFormat('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const secondsPrecise = new Intl.NumberFormat('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 3200 → "3,2 s" */
export function formatSeconds(ms: number): string {
  return t('units.seconds', { value: seconds.format(ms / 1000) });
}

/** Valor editable del preset: 3200 → "3,2" (hasta dos decimales). */
export function msToSecondsText(ms: number): string {
  return secondsPrecise.format(ms / 1000);
}

/** Acepta "3,2" o "3.2"; devuelve milisegundos o undefined si no es un número. */
export function parseSecondsText(text: string): number | undefined {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (normalized === '' || !/^\d*\.?\d*$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 1000) : undefined;
}

export function formatSimTime(ms: number): string {
  return seconds.format(ms / 1000);
}

export function formatPercent(value: number): string {
  return Math.round(value * 100).toString();
}
