import { createContext, useContext } from 'react';

/**
 * Paletas del diagrama. Colores como valores literales (no variables CSS) para que el SVG exportado
 * se vea idéntico fuera de la app (PLAN §15). El estado nunca depende solo del color: el grosor y
 * las marcas lo acompañan (R2 §30.8).
 *
 * En pantalla el lienzo usa la paleta del tema activo (R4 §5); la exportación se dibuja fuera del
 * proveedor y siempre sale con la clara.
 */
export interface Palette {
  readonly ink: string;
  readonly inkMuted: string;
  /** Fondo del lienzo y relleno de los símbolos. */
  readonly paper: string;
  /** Trazo sobre un relleno encendido (lámpara): oscuro en los dos temas. */
  readonly litInk: string;
  readonly wire: string;
  readonly floating: string;
  readonly neutral: string;
  readonly short: string;
  /** Un tono por fuente cuando hay varias (PLAN §6.7). */
  readonly line: readonly string[];
  readonly selection: string;
  readonly selectionHalo: string;
  readonly preview: string;
  readonly invalid: string;
  readonly invalidHalo: string;
  readonly coilOn: string;
  readonly grid: string;
  readonly gridMajor: string;
  readonly lamp: Readonly<Record<string, string>>;
}

const LAMP = { red: '#ef4444', green: '#22c55e', amber: '#f59e0b', white: '#e2e8f0', blue: '#3b82f6' };

export const LIGHT_PALETTE: Palette = {
  ink: '#1f2937',
  inkMuted: '#6b7280',
  paper: '#ffffff',
  litInk: '#1f2937',
  wire: '#1f2937',
  floating: '#9ca3af',
  neutral: '#2563eb',
  short: '#dc2626',
  line: ['#ea580c', '#c026d3', '#a16207', '#7c3aed'],
  selection: '#0284c7',
  selectionHalo: 'rgba(2, 132, 199, 0.22)',
  preview: '#0284c7',
  invalid: '#dc2626',
  invalidHalo: 'rgba(220, 38, 38, 0.18)',
  coilOn: '#fed7aa',
  grid: '#cbd5e1',
  gridMajor: '#94a3b8',
  lamp: LAMP,
};

/** Mismos papeles que la clara, con contraste sobre el fondo oscuro. `paper` = --paper de styles.css. */
export const DARK_PALETTE: Palette = {
  ink: '#e2e8f0',
  inkMuted: '#94a3b8',
  paper: '#0e1522',
  litInk: '#1f2937',
  wire: '#cbd5e1',
  floating: '#5b6778',
  neutral: '#60a5fa',
  short: '#f87171',
  line: ['#fb923c', '#e879f9', '#eab308', '#a78bfa'],
  selection: '#38bdf8',
  selectionHalo: 'rgba(56, 189, 248, 0.22)',
  preview: '#38bdf8',
  invalid: '#f87171',
  invalidHalo: 'rgba(248, 113, 113, 0.2)',
  coilOn: '#c2410c',
  grid: '#35445a',
  gridMajor: '#475569',
  lamp: LAMP,
};

/** Paleta del diagrama en pantalla. Sin proveedor (exportación) es la clara. */
export const PaletteContext = createContext<Palette>(LIGHT_PALETTE);

export const usePalette = (): Palette => useContext(PaletteContext);

export const STROKE = 0.15;
export const WIRE_STROKE = 0.16;
export const LABEL_FONT = 1.05;
export const SMALL_FONT = 0.8;
export const FONT_FAMILY = 'Helvetica, Arial, sans-serif';
