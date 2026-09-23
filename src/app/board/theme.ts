/**
 * Paleta del tablero. **Solo modo claro** [R5 §16]: el lienzo usa un fondo tipo hoja, apenas
 * amarillo, y la exportación sale con fondo blanco. Colores literales (no variables CSS) para que
 * el SVG exportado se vea igual fuera de la app (PLAN §15).
 */
import type { WireColor, WireGauge } from '../../core/board/model';

export const BOARD_PALETTE = {
  /** Fondo del lienzo: hoja apenas amarilla. */
  paper: '#fbf7ec',
  /** Fondo de la exportación. */
  paperExport: '#ffffff',
  grid: '#e8e0cd',
  gridMajor: '#d7ccb0',
  ink: '#1f2937',
  muted: '#6b7280',
  /** Cuerpo del aparato. */
  body: '#ffffff',
  bodyEdge: '#3f4854',
  bodyShade: '#eff2f5',
  screw: '#e4e8ee',
  screwEdge: '#6b7280',
  /** Trazo del esquema interno. */
  sym: '#374151',
  coilOn: '#fdba74',
  metal: '#b8c0cb',
  selection: '#0284c7',
  selectionHalo: 'rgba(2, 132, 199, 0.22)',
  /** Realce de lo accionable mientras se simula. */
  liveHalo: 'rgba(2, 132, 199, 0.08)',
  invalid: '#dc2626',
  invalidHalo: 'rgba(220, 38, 38, 0.18)',
  short: '#dc2626',
  lamp: {
    red: '#ef4444',
    green: '#22c55e',
    amber: '#f59e0b',
    white: '#fef9c3',
    blue: '#3b82f6',
  } as Record<string, string>,
} as const;

export interface WireTone {
  /** En reposo: el color del cable, un poco oscuro [R5 §3]. */
  readonly off: string;
  /** Con tensión: el mismo color iluminado. */
  readonly on: string;
  /** Sombra colorida alrededor del cable energizado. */
  readonly glow: string;
}

export const WIRE_TONES: Record<WireColor, WireTone> = {
  red: { off: '#a51d1d', on: '#ef4444', glow: 'rgba(239, 68, 68, 0.45)' },
  black: { off: '#1b2129', on: '#4b5563', glow: 'rgba(107, 114, 128, 0.45)' },
  blue: { off: '#1a3fa8', on: '#3b82f6', glow: 'rgba(59, 130, 246, 0.45)' },
  green: { off: '#14663a', on: '#22c55e', glow: 'rgba(34, 197, 94, 0.45)' },
  yellow: { off: '#8a6209', on: '#eab308', glow: 'rgba(234, 179, 8, 0.5)' },
  white: { off: '#b9bfc8', on: '#f8fafc', glow: 'rgba(248, 250, 252, 0.6)' },
  brown: { off: '#6b3a10', on: '#b45309', glow: 'rgba(180, 83, 9, 0.45)' },
  grey: { off: '#555d68', on: '#9ca3af', glow: 'rgba(156, 163, 175, 0.45)' },
};

/** Tres calibres [R5 §5], en unidades de grid. */
export const WIRE_WIDTH: Record<WireGauge, number> = { 1: 0.22, 2: 0.32, 3: 0.44 };

export const BOARD_STROKE = 0.16;
export const BODY_STROKE = 0.18;
export const SCREW_RADIUS = { control: 0.62, power: 0.9 } as const;
export const TERMINAL_FONT = 0.85;
export const TAG_FONT = 1.25;
export const SMALL_FONT = 0.7;
/**
 * Tipografía condensada de panel, con alternativas locales en los tres sistemas: así la exportación
 * (que rasteriza el SVG sin tipografías web) se ve igual que la pantalla.
 */
export const FONT_FAMILY =
  "'Arial Narrow', 'Liberation Sans Narrow', 'DejaVu Sans Condensed', Helvetica, Arial, sans-serif";

/** Del centro del tornillo al arranque del conductor interno: deja sitio para la marcación. */
export const LEAD = 2.1;
