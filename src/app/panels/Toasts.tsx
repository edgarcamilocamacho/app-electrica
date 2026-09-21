import { t } from '../i18n/t';
import { useEditor, useEditorStore } from '../store/context';

export function Toasts() {
  const store = useEditorStore();
  const toasts = useEditor((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" role="region" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" data-testid="toast">
          <span>{t(toast.key, toast.params)}</span>
          {toast.actions.map((a) => (
            <button
              key={a.key}
              type="button"
              className="btn btn-small"
              onClick={() => {
                store.getState().dismissToast(toast.id);
                a.run();
              }}
            >
              {t(a.key)}
            </button>
          ))}
          <button type="button" className="btn btn-small btn-ghost" aria-label={t('toasts.dismiss')} onClick={() => store.getState().dismissToast(toast.id)}>
            {'×'}
          </button>
        </div>
      ))}
    </div>
  );
}
