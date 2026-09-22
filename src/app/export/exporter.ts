import { createElement } from 'react';
import { defaultRegistry } from '../../core/registry/catalog';
import { downloadBlob, toFileName } from '../../platform/files';
import { Diagram } from '../canvas/Diagram';
import { t } from '../i18n/t';
import { contentBounds, docOf, type EditorState, type EditorStore } from '../store/editorStore';
import { LIGHT_PALETTE } from '../theme';

/**
 * Exportación (PLAN §15, R3 Q3.7): el diagrama completo, tal como se ve (con los colores de la
 * simulación si está corriendo o en ERROR), sin grid ni UI de edición. PNG, SVG y PDF vectorial.
 */
export type PdfPage = 'a4' | 'a3' | 'fit';
export type ExportFormat = 'png' | 'svg' | 'pdf';

const PX_PER_UNIT = 10;
const MARGIN = 3;

export interface ExportedSvg {
  readonly markup: string;
  readonly width: number;
  readonly height: number;
}

export async function buildExportSvg(state: EditorState): Promise<ExportedSvg> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const doc = docOf(state);
  const b = contentBounds(doc, { registry: defaultRegistry }) ?? { minX: 0, minY: 0, maxX: 20, maxY: 20 };
  const minX = b.minX - MARGIN;
  const minY = b.minY - MARGIN;
  const w = b.maxX - b.minX + 2 * MARGIN + 6; // + espacio para las referencias a la derecha
  const h = b.maxY - b.minY + 2 * MARGIN;
  const width = Math.ceil(w * PX_PER_UNIT);
  const height = Math.ceil(h * PX_PER_UNIT);
  const inner = renderToStaticMarkup(
    createElement(Diagram, {
      doc,
      registry: defaultRegistry,
      classes: state.vertexClasses,
      sim: state.mode === 'edit' ? null : state.simSnapshot,
      fault: state.mode === 'error' ? (state.simSnapshot?.fault?.components ?? []) : [],
      exportMode: true,
    }),
  );
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${width}" height="${height}">` +
    `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${LIGHT_PALETTE.paper}"/>` +
    inner +
    `</svg>`;
  return { markup, width, height };
}

function baseName(state: EditorState): string {
  const name = state.file.name.replace(/\.json$/i, '') || docOf(state).metadata.name || t('app.untitled');
  return name;
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
    ctx.fillStyle = LIGHT_PALETTE.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function svgToPdf(svg: ExportedSvg, page: PdfPage): Promise<Blob> {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const landscape = svg.width >= svg.height;
  const pdf =
    page === 'fit'
      ? new jsPDF({ unit: 'pt', format: [svg.width, svg.height], orientation: landscape ? 'landscape' : 'portrait' })
      : new jsPDF({ unit: 'pt', format: page, orientation: landscape ? 'landscape' : 'portrait' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = page === 'fit' ? 0 : 28;
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

export async function exportDiagram(store: EditorStore, format: ExportFormat, page: PdfPage = 'a4'): Promise<void> {
  const state = store.getState();
  const svg = await buildExportSvg(state);
  const name = baseName(state);
  let blob: Blob;
  let fileName: string;
  if (format === 'svg') {
    blob = new Blob([svg.markup], { type: 'image/svg+xml' });
    fileName = toFileName(name, 'svg');
  } else if (format === 'png') {
    blob = await svgToPng(svg);
    fileName = toFileName(name, 'png');
  } else {
    blob = await svgToPdf(svg, page);
    fileName = toFileName(name, 'pdf');
  }
  downloadBlob(blob, fileName);
  store.getState().showMessage('messages.exported', { name: fileName });
}
