/**
 * Archivos locales: descargar lo exportado y elegir un JSON para importar [R6 §4]. Los tableros
 * viven en el servidor, así que no hace falta escribir sobre un archivo del disco.
 */

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, fileName: string, type = 'application/json'): void {
  downloadBlob(new Blob([text], { type }), fileName);
}

export interface PickedFile {
  readonly text: string;
  readonly fileName: string;
}

/** Abre el selector de archivos del sistema y devuelve el texto del JSON elegido. */
export function pickTextFile(accept = '.json,application/json'): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? { text: await file.text(), fileName: file.name } : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export function toFileName(name: string, extension: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-') || 'circuito';
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}
