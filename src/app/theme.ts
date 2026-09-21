/**
 * Paleta del diagrama. Colores como valores literales (no variables CSS) para que el SVG exportado
 * se vea idéntico fuera de la app (PLAN §15). El estado nunca depende solo del color: el grosor y
 * las marcas lo acompañan (R2 §30.8).
 */
export const COLORS = {
  ink: '#1f2937',
  inkMuted: '#6b7280',
  paper: '#ffffff',
  wire: '#1f2937',
  floating: '#9ca3af',
  neutral: '#2563eb',
  short: '#dc2626',
  /** Un tono por fuente cuando hay varias (PLAN §6.7). */
  line: ['#ea580c', '#c026d3', '#a16207', '#7c3aed'],
  selection: '#0284c7',
  selectionHalo: 'rgba(2, 132, 199, 0.22)',
  preview: '#0284c7',
  invalid: '#dc2626',
  invalidHalo: 'rgba(220, 38, 38, 0.18)',
  energized: '#fdba74',
  coilOn: '#fed7aa',
  grid: '#cbd5e1',
  gridMajor: '#94a3b8',
  lamp: { red: '#ef4444', green: '#22c55e', amber: '#f59e0b', white: '#e2e8f0', blue: '#3b82f6' } as Record<string, string>,
} as const;

export const STROKE = 0.15;
export const WIRE_STROKE = 0.16;
export const LABEL_FONT = 1.05;
export const SMALL_FONT = 0.8;
export const FONT_FAMILY = 'Helvetica, Arial, sans-serif';
