import { useEffect } from 'react';
import { isTyping } from '../canvas/Canvas';
import { NUDGE_FAST, type EditorStore } from '../store/editorStore';

/**
 * Mapa de teclas (PLAN §6.4, R2 §31). Confirmadas por producto: B, M, R, Esc, Ctrl+Z, Ctrl+Y,
 * Ctrl+C, Ctrl+V. El resto es propuesta documentada en docs/ATAJOS.md.
 * Se ignoran mientras el foco está en un campo de texto. Cmd reemplaza a Ctrl en macOS.
 */
export function useKeyboard(store: EditorStore): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const s = store.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod) {
        const handled = (() => {
          switch (key) {
            case 'z':
              if (e.shiftKey) s.redo();
              else s.undo();
              return true;
            case 'y':
              s.redo();
              return true;
            case 'c':
              s.copy();
              return true;
            case 'v':
              s.paste();
              return true;
            case 'd':
              s.duplicate();
              return true;
            case 'a':
              s.selectAll();
              return true;
            case 's':
              void s.save(e.shiftKey);
              return true;
            case 'o':
              void s.openFile();
              return true;
            case '0':
              s.resetZoom();
              return true;
            default:
              return false;
          }
        })();
        if (handled) e.preventDefault();
        return;
      }
      if (e.altKey) return;

      switch (e.key) {
        case 'Escape':
          s.cancel();
          return;
        case 'Enter':
          s.confirmTool();
          return;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          const step = e.shiftKey ? NUDGE_FAST : 1;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          e.preventDefault();
          s.nudge(dx, dy);
          return;
        }
        case 'Backspace':
          e.preventDefault();
          if (s.tool.kind === 'wire' && s.tool.points.length > 0) s.wireBack();
          else s.deleteSelection();
          return;
        case 'Delete':
          s.deleteSelection();
          return;
        case '+':
        case '=':
          s.zoomAt({ x: s.canvasSize.width / 2, y: s.canvasSize.height / 2 }, 1.25);
          return;
        case '-':
          s.zoomAt({ x: s.canvasSize.width / 2, y: s.canvasSize.height / 2 }, 0.8);
          return;
      }

      switch (key) {
        case 's':
          s.setTool('select');
          break;
        case 'c':
          s.setTool('wire');
          break;
        case 'm':
          s.setTool('move');
          break;
        case 'b':
          s.setTool('erase');
          break;
        case 't':
          s.setTool('text');
          break;
        case 'r':
          s.rotate();
          break;
        case 'e':
          s.toggleSimulation();
          break;
        case 'a':
          s.fitView();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);
}
