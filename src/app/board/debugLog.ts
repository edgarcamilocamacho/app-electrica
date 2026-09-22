/**
 * Registro de depuración del cableado (`?depurar=1`). Anota cada gesto del puntero con lo que había
 * debajo y cómo quedó el trazado, para poder reproducir un problema sin estar mirando la pantalla.
 * No se activa sin el parámetro, así que no afecta el uso normal.
 */
import type { Point } from '../../core/model/types';

export interface WireLogEntry {
  readonly n: number;
  readonly ms: number;
  readonly event: string;
  readonly tool: string;
  readonly at?: Point;
  readonly hit?: string;
  /** Puntos ya fijados del trazado en curso. */
  readonly draft?: readonly Point[];
  /** Ruta que se está mostrando, con el tramo que sigue al cursor. */
  readonly preview?: readonly Point[];
  readonly wires?: number;
  readonly note?: string;
}

const LIMIT = 500;

declare global {
  interface Window {
    __wireLog?: WireLogEntry[];
  }
}

const enabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('depurar');
const entries: WireLogEntry[] = [];
let count = 0;
const start = typeof performance === 'undefined' ? 0 : performance.now();

export const wireDebug = {
  get enabled(): boolean {
    return enabled;
  },
  log(entry: Omit<WireLogEntry, 'n' | 'ms'>): void {
    if (!enabled) return;
    count += 1;
    const full: WireLogEntry = { n: count, ms: Math.round(performance.now() - start), ...entry };
    entries.push(full);
    if (entries.length > LIMIT) entries.shift();
    window.__wireLog = entries;
    console.info('[cable]', full.n, full.event, full.tool, full.at ?? '', full.hit ?? '', full.preview ?? '');
  },
  dump(): string {
    return JSON.stringify(entries, null, 2);
  },
  clear(): void {
    entries.length = 0;
    count = 0;
  },
};
