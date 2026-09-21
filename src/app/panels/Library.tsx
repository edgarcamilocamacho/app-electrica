import type { ComponentCategory } from '../../core/registry/types';
import { t } from '../i18n/t';
import { useEditor, useEditorStore, useRegistry } from '../store/context';
import { SYMBOLS } from '../symbols/Symbols';
import { COLORS } from '../theme';

const CATEGORIES: readonly ComponentCategory[] = ['sources', 'manual', 'relays', 'contacts', 'timers', 'loads'];

function SymbolThumb({ type }: { type: string }) {
  const Symbol = SYMBOLS[type];
  return (
    <svg className="lib-thumb" viewBox="-3.6 -3.6 7.2 7.2" aria-hidden="true">
      {Symbol && <Symbol props={{ color: 'amber' }} color={COLORS.ink} />}
    </svg>
  );
}

/** Biblioteca de componentes a la izquierda (spec §7.1), agrupada por categoría. */
export function Library() {
  const store = useEditorStore();
  const registry = useRegistry();
  const placing = useEditor((s) => (s.tool.kind === 'place' ? s.tool.type : s.tool.kind === 'text' ? 'text' : null));
  const editing = useEditor((s) => s.mode === 'edit');

  return (
    <nav className="panel library" aria-label={t('library.title')}>
      <h2 className="panel-title">{t('library.title')}</h2>
      <p className="panel-hint">{t('library.hint')}</p>
      {CATEGORIES.map((cat) => (
        <section key={cat} className="lib-group">
          <h3>{t(`library.categories.${cat}`)}</h3>
          <div className="lib-items">
            {registry
              .all()
              .filter((d) => d.category === cat)
              .map((d) => (
                <button
                  key={d.type}
                  type="button"
                  className={`lib-item${placing === d.type ? ' active' : ''}`}
                  aria-pressed={placing === d.type}
                  disabled={!editing}
                  data-testid={`library-${d.type}`}
                  title={t(`components.${d.type}` as 'components.coil')}
                  onClick={() => store.getState().startPlacing(d.type)}
                >
                  <SymbolThumb type={d.type} />
                  <span>{t(`components.${d.type}` as 'components.coil')}</span>
                </button>
              ))}
          </div>
        </section>
      ))}
      <section className="lib-group">
        <h3>{t('library.categories.annotations')}</h3>
        <div className="lib-items">
          <button
            type="button"
            className={`lib-item${placing === 'text' ? ' active' : ''}`}
            aria-pressed={placing === 'text'}
            disabled={!editing}
            data-testid="library-text"
            onClick={() => store.getState().setTool('text')}
          >
            <svg className="lib-thumb" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 6V4h14v2M12 4v16M9 20h6" fill="none" stroke={COLORS.ink} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>{t('components.text')}</span>
          </button>
        </div>
      </section>
    </nav>
  );
}
