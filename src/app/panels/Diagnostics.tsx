import { useEffect, useRef } from 'react';
import { componentBounds } from '../../core/model/document';
import type { Diagnostic } from '../../core/diagnostics/diagnostics';
import { t, type MessageKey, type MessageParams } from '../i18n/t';
import { useEditor, useEditorStore, useRegistry } from '../store/context';
import { docOf } from '../store/editorStore';

export function diagnosticText(d: Diagnostic): string {
  const params: MessageParams = { ...d.params };
  if (d.code === 'REF_BROKEN') params.link = d.params.link ? t('diagnostics.REF_BROKEN_LINK', { link: d.params.link }) : '';
  if (d.code === 'REF_WRONG_TYPE') params.expected = t(`diagnostics.expected.${String(d.params.expected)}` as MessageKey);
  if (params.ref === '') params.ref = '—';
  return t(`diagnostics.${d.code}` as MessageKey, params);
}

/** Panel de diagnósticos (PLAN §8): avisos y errores que impiden simular. Clic centra y selecciona. */
export function Diagnostics() {
  const store = useEditorStore();
  const registry = useRegistry();
  const diagnostics = useEditor((s) => s.diagnostics);
  const focus = useEditor((s) => s.focusDiagnostics);
  const ref = useRef<HTMLElement>(null);
  const blocking = diagnostics.filter((d) => d.severity === 'blocking').length;

  useEffect(() => {
    if (focus > 0) {
      ref.current?.scrollIntoView({ block: 'nearest' });
      ref.current?.classList.add('flash');
      const id = setTimeout(() => ref.current?.classList.remove('flash'), 900);
      return () => clearTimeout(id);
    }
  }, [focus]);

  const goTo = (d: Diagnostic) => {
    const s = store.getState();
    const doc = docOf(s);
    s.setSelection({ components: d.componentIds.filter((id) => doc.components[id]), segments: d.segmentIds.filter((id) => doc.segments[id]), annotations: [] });
    if (d.at) s.focusOn(d.at);
    else {
      const c = doc.components[d.componentIds[0] ?? ''];
      if (c) {
        const b = componentBounds(c, registry);
        s.focusOn({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
      }
    }
  };

  return (
    <section className="panel diagnostics" aria-label={t('diagnostics.title')} data-testid="diagnostics" ref={ref}>
      <h2 className="panel-title">
        {t('diagnostics.title')}
        {blocking > 0 && <span className="badge badge-error">{t('diagnostics.blockingCount', { count: blocking })}</span>}
      </h2>
      {diagnostics.length === 0 ? (
        <p className="panel-empty">{t('diagnostics.none')}</p>
      ) : (
        <ul className="diag-list">
          {diagnostics.map((d) => (
            <li key={d.key}>
              <button type="button" className={`diag diag-${d.severity}`} data-code={d.code} data-severity={d.severity} onClick={() => goTo(d)}>
                <span className="diag-sev">{t(`diagnostics.${d.severity}`)}</span>
                <span className="diag-text">{diagnosticText(d)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
