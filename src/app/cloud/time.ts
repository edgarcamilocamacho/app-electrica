/** Tiempos relativos en español para la lista de tableros. */
import { t } from '../i18n/t';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Cuánto hace: «recién», «hace 5 min», «ayer». Un reloj un poco adelantado cuenta como «recién». */
export function relativeTime(at: number, now: number): string {
  const diff = Math.max(0, now - at);
  if (diff < MINUTE) return t('cloud.time.now');
  if (diff < HOUR) return t('cloud.time.minutes', { n: Math.floor(diff / MINUTE) });
  if (diff < DAY) return t('cloud.time.hours', { n: Math.floor(diff / HOUR) });
  if (diff < 2 * DAY) return t('cloud.time.yesterday');
  return t('cloud.time.days', { n: Math.floor(diff / DAY) });
}

/** Cuánto falta: «mañana», «en 30 días». */
export function timeUntil(at: number, now: number): string {
  const ahead = at - now;
  if (ahead < 2 * DAY) return t('cloud.time.tomorrow');
  return t('cloud.time.inDays', { n: Math.round(ahead / DAY) });
}
