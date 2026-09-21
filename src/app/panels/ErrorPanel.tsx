import { componentBounds } from '../../core/model/document';
import { formatSimTime } from '../i18n/format';
import { t } from '../i18n/t';
import { useEditor, useEditorStore, useRegistry } from '../store/context';
import { docOf } from '../store/editorStore';

/**
 * Panel de ERROR (spec §4.3, §11.2, §12; R2 §18). Requerido: tipo de falla, tiempo congelado,
 * resaltado y salida explícita. Deseable: lista navegable, secuencia del lazo y fuentes del corto.
 */
export function ErrorPanel() {
  const store = useEditorStore();
  const registry = useRegistry();
  const mode = useEditor((s) => s.mode);
  const snapshot = useEditor((s) => s.simSnapshot);
  const doc = useEditor(docOf);
  if (mode !== 'error' || !snapshot?.fault) return null;
  const fault = snapshot.fault;
  const refOf = (id: string) => String(doc.components[id]?.props.ref || id);

  const focus = (id: string) => {
    const c = doc.components[id];
    if (!c) return;
    const b = componentBounds(c, registry);
    store.getState().setSelection({ components: [id], segments: [], annotations: [] });
    store.getState().focusOn({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
  };

  return (
    <div className="error-panel" role="alertdialog" aria-labelledby="error-title" data-testid="error-panel" data-fault={fault.kind}>
      <h2 id="error-title">{fault.kind === 'short' ? t('fault.shortTitle') : t('fault.oscillationTitle')}</h2>
      <p>{t(`fault.${fault.reason}`)}</p>
      <p className="error-time" data-testid="error-time">
        {t('fault.frozenAt', { value: formatSimTime(snapshot.clockMs) })}
      </p>
      {fault.kind === 'short' && fault.sources.length > 0 && (
        <p>
          <strong>{t('fault.sources')}: </strong>
          {fault.sources.map(refOf).join(', ')}
        </p>
      )}
      {fault.components.length > 0 && (
        <div className="error-involved">
          <strong>{t('fault.involved')}</strong>
          <div className="chips">
            {fault.components.map((id) => (
              <button key={id} type="button" className="chip" onClick={() => focus(id)}>
                {refOf(id)}
              </button>
            ))}
          </div>
        </div>
      )}
      {fault.kind === 'oscillation' && fault.sequence.length > 0 && (
        <div className="error-sequence">
          <strong>{t('fault.sequence')}</strong>
          <ol>
            {fault.sequence.slice(0, 12).map((step, i) => (
              <li key={i}>{t('fault.sequenceStep', { ref: refOf(step.componentId), state: step.on ? t('fault.stepOn') : t('fault.stepOff') })}</li>
            ))}
          </ol>
        </div>
      )}
      <button type="button" className="btn btn-danger" data-testid="error-back" onClick={() => store.getState().exitError()}>
        {t('fault.back')}
      </button>
    </div>
  );
}
