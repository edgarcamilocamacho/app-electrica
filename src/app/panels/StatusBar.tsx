import { useShallow } from 'zustand/react/shallow';
import { formatPercent, formatSimTime } from '../i18n/format';
import { t } from '../i18n/t';
import { useEditor } from '../store/context';
import { selectionOfState } from '../store/editorStore';

export function StatusBar() {
  const { mode, zoom, message, clock, px, py, selCount, lagging, fileName, dirty } = useEditor(
    useShallow((s) => {
      const sel = selectionOfState(s);
      return {
        mode: s.mode,
        zoom: s.viewport.zoom,
        message: s.message,
        clock: s.simSnapshot?.clockMs ?? null,
        // Primitivos: un objeto nuevo por lectura haría que useShallow nunca coincida.
        px: s.pointer ? Math.round(s.pointer.x) : null,
        py: s.pointer ? Math.round(s.pointer.y) : null,
        selCount: sel.components.length + sel.segments.length + sel.annotations.length,
        lagging: s.simLagging,
        fileName: s.file.name,
        dirty: s.file.dirty,
      };
    }),
  );
  return (
    <footer className="statusbar" data-testid="statusbar">
      <span className={`mode mode-${mode}`} data-testid="mode">
        {t(`status.${mode}`)}
      </span>
      <span className="status-file">
        {fileName || t('app.untitled')}
        {dirty ? ' •' : ''}
      </span>
      {clock !== null && <span data-testid="sim-time">{t('status.time', { value: formatSimTime(clock) })}</span>}
      {lagging && <span className="status-warn">{t('status.lagging')}</span>}
      <span className={`status-message tone-${message?.tone ?? 'info'}`} role="status" aria-live="polite" data-testid="status-message">
        {message ? t(message.key, message.params) : ''}
      </span>
      <span className="status-right">
        {selCount > 0 && <span>{t('status.selection', { count: selCount })}</span>}
        {px !== null && py !== null && <span>{t('status.cursor', { x: px, y: py })}</span>}
        <span>{t('status.zoom', { value: formatPercent(zoom) })}</span>
      </span>
    </footer>
  );
}
