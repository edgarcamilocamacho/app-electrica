/**
 * Guardar y abrir archivos (PLAN §14.2, T-08). Base universal: descarga + <input type=file>.
 * Mejora progresiva: File System Access API (Chromium) para que Ctrl+S guarde sobre el mismo archivo.
 */

interface FileSystemFileHandleLike {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
}

interface FsAccessWindow {
  showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandleLike>;
  showOpenFilePicker?: (opts: unknown) => Promise<FileSystemFileHandleLike[]>;
}

export type FileHandle = FileSystemFileHandleLike;

const JSON_TYPES = [{ description: 'Circuito', accept: { 'application/json': ['.json'] } }];

export const supportsFileSystemAccess = (): boolean =>
  typeof window !== 'undefined' && typeof (window as unknown as FsAccessWindow).showSaveFilePicker === 'function';

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

export interface SaveOutcome {
  readonly fileName: string;
  readonly handle?: FileHandle;
}

/** Guarda el texto. Con `handle`, escribe sobre ese archivo; si no, pide destino o descarga. */
export async function saveText(
  text: string,
  suggestedName: string,
  handle?: FileHandle,
  forcePicker = false,
): Promise<SaveOutcome | null> {
  const blob = new Blob([text], { type: 'application/json' });
  const w = window as unknown as FsAccessWindow;
  try {
    let target = forcePicker ? undefined : handle;
    if (!target && w.showSaveFilePicker) {
      target = await w.showSaveFilePicker({ suggestedName, types: JSON_TYPES });
    }
    if (target) {
      const writable = await target.createWritable();
      await writable.write(blob);
      await writable.close();
      return { fileName: target.name, handle: target };
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null; // el usuario canceló
    throw e;
  }
  downloadBlob(blob, suggestedName);
  return { fileName: suggestedName };
}

export interface OpenOutcome {
  readonly text: string;
  readonly fileName: string;
  readonly handle?: FileHandle;
}

export async function openText(): Promise<OpenOutcome | null> {
  const w = window as unknown as FsAccessWindow;
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({ types: JSON_TYPES, multiple: false });
      if (!handle) return null;
      const file = await handle.getFile();
      return { text: await file.text(), fileName: file.name, handle };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      throw e;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? { text: await file.text(), fileName: file.name } : null);
    });
    input.click();
  });
}

export function toFileName(name: string, extension: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-') || 'circuito';
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}
