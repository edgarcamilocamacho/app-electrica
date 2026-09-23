/**
 * Exportación del tablero a imagen y PDF. Guardar y abrir ya no existen: los tableros viven en el
 * servidor y el JSON se exporta e importa desde la lista [R6 §4].
 *
 * La exportación sale con **fondo blanco**, no con el color de hoja del lienzo [R5 §16].
 */
import { createElement } from 'react';
import { downloadBlob, toFileName } from '../../platform/files';
import { BoardDiagram } from './BoardDiagram';
import { contentBounds, docOf, type BoardStore } from './store';
import { BOARD_PALETTE } from './theme';

const PX_PER_UNIT = 10;
const MARGIN = 3;

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
      background: BOARD_PALETTE.paperExport,
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
