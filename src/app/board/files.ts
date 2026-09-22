/**
 * Archivos del tablero: guardar, abrir, autoguardado y exportación.
 *
 * La exportación sale con **fondo blanco**, no con el color de hoja del lienzo [R5 §16].
 */
import { createElement } from 'react';
import { boardRegistry } from '../../core/board/catalog';
import type { BoardDocument } from '../../core/board/model';
import { parseBoard, serializeBoard, type BoardLoadErrorCode } from '../../core/board/persistence';
import { downloadBlob, openText, saveText, toFileName, type FileHandle } from '../../platform/files';
import type { KeyValueStorage } from '../../platform/storage';
import { BoardDiagram } from './BoardDiagram';
import { contentBounds, docOf, type BoardStore } from './store';
import { BOARD_PALETTE } from './theme';

const PX_PER_UNIT = 10;
const MARGIN = 3;

export const BOARD_AUTOSAVE_KEY = 'simulador-tablero:autosave:v1';

export interface BoardFileState {
  name: string;
  handle?: FileHandle;
}

export interface ExportedSvg {
  readonly markup: string;
  readonly width: number;
  readonly height: number;
}

/** El diagrama completo, tal como se ve, sin grilla ni selección [R3 Q3.7]. */
export async function buildBoardSvg(store: BoardStore): Promise<ExportedSvg> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const state = store.getState();
  const doc = docOf(state);
  const box = contentBounds(doc, state.registry) ?? { minX: 0, minY: 0, maxX: 20, maxY: 20 };
  const minX = box.minX - MARGIN;
  const minY = box.minY - MARGIN;
  const w = box.maxX - box.minX + 2 * MARGIN;
  const h = box.maxY - box.minY + 2 * MARGIN;
  const inner = renderToStaticMarkup(
    createElement(BoardDiagram, {
      doc,
      registry: state.registry,
      sim: state.mode === 'edit' ? null : state.sim,
    }),
  );
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" ` +
    `width="${Math.ceil(w * PX_PER_UNIT)}" height="${Math.ceil(h * PX_PER_UNIT)}">` +
    `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${BOARD_PALETTE.paperExport}"/>` +
    inner +
    '</svg>';
  return { markup, width: Math.ceil(w * PX_PER_UNIT), height: Math.ceil(h * PX_PER_UNIT) };
}

async function svgToPng(svg: ExportedSvg, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg.markup], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = svg.width * scale;
    canvas.height = svg.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = BOARD_PALETTE.paperExport;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function svgToPdf(svg: ExportedSvg): Promise<Blob> {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const landscape = svg.width >= svg.height;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const scale = Math.min((pw - 2 * margin) / svg.width, (ph - 2 * margin) / svg.height);
  const width = svg.width * scale;
  const height = svg.height * scale;
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.innerHTML = svg.markup;
  document.body.appendChild(host);
  try {
    const element = host.querySelector('svg')!;
    await (pdf as unknown as { svg(el: Element, opts: object): Promise<unknown> }).svg(element, {
      x: (pw - width) / 2,
      y: (ph - height) / 2,
      width,
      height,
    });
  } finally {
    host.remove();
  }
  return pdf.output('blob');
}

export type ExportFormat = 'png' | 'svg' | 'pdf';

export async function exportBoard(store: BoardStore, format: ExportFormat, rawName: string): Promise<string> {
  const svg = await buildBoardSvg(store);
  const name = rawName.replace(/\.json$/i, '');
  if (format === 'svg') {
    const fileName = toFileName(name, 'svg');
    downloadBlob(new Blob([svg.markup], { type: 'image/svg+xml' }), fileName);
    return fileName;
  }
  if (format === 'png') {
    const fileName = toFileName(name, 'png');
    downloadBlob(await svgToPng(svg), fileName);
    return fileName;
  }
  const fileName = toFileName(name, 'pdf');
  downloadBlob(await svgToPdf(svg), fileName);
  return fileName;
}

export interface SaveResult {
  readonly name: string;
  readonly handle?: FileHandle;
}

export async function saveBoard(store: BoardStore, file: BoardFileState): Promise<SaveResult | undefined> {
  const doc = docOf(store.getState());
  const text = serializeBoard(doc);
  const suggested = toFileName(file.name || doc.metadata.name || 'tablero', 'json');
  const outcome = await saveText(text, suggested, file.handle);
  if (!outcome) return undefined;
  return { name: outcome.fileName, ...(outcome.handle ? { handle: outcome.handle } : {}) };
}

export type OpenBoardResult =
  | { readonly ok: true; readonly doc: BoardDocument; readonly name: string; readonly handle?: FileHandle }
  | { readonly ok: false; readonly code: BoardLoadErrorCode }
  | undefined;

export async function openBoard(): Promise<OpenBoardResult> {
  const outcome = await openText();
  if (!outcome) return undefined;
  const result = parseBoard(outcome.text, boardRegistry);
  if (!result.ok) return { ok: false, code: result.error.code };
  return { ok: true, doc: result.doc, name: outcome.fileName, ...(outcome.handle ? { handle: outcome.handle } : {}) };
}

/** Autoguardado local: el documento vuelve después de una recarga [R2 §28]. */
export function writeBoardAutosave(storage: KeyValueStorage, doc: BoardDocument, name: string): void {
  try {
    storage.set(BOARD_AUTOSAVE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), name, document: JSON.parse(serializeBoard(doc)) }));
  } catch {
    // Sin espacio o sin permiso: el autoguardado es best-effort.
  }
}

export function readBoardAutosave(storage: KeyValueStorage): { doc: BoardDocument; name: string } | null {
  const raw = storage.get(BOARD_AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: string; document?: unknown };
    const result = parseBoard(JSON.stringify(parsed.document), boardRegistry);
    return result.ok ? { doc: result.doc, name: typeof parsed.name === 'string' ? parsed.name : '' } : null;
  } catch {
    return null;
  }
}
