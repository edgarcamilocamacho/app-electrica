import type { ComponentCategory } from '../../core/registry/types';
import { t } from '../i18n/t';
import { useEditor, useEditorStore, useRegistry } from '../store/context';
import { SYMBOLS } from '../symbols/Symbols';
import { usePalette } from '../theme';

const CATEGORIES: readonly ComponentCategory[] = ['sources', 'manual', 'relays', 'contacts', 'timers', 'loads'];

function SymbolThumb({ type }: { type: string }) {
  const Symbol = SYMBOLS[type];
  const palette = usePalette();
  return (
    <svg className="lib-thumb" viewBox="-3.6 -3.6 7.2 7.2" aria-hidden="true">
      {Symbol && <Symbol props={{ color: 'amber' }} color={palette.ink} />}
    </svg>
  );
}

/** Biblioteca de componentes a la izquierda (spec §7.1), agrupada por categoría. */
export function Library() {
  const store = useEditorStore();
  const registry = useRegistry();
  const placing = useEditor((s) => (s.tool.kind === 'place' ? s.tool.type : null));
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
    </nav>
  );
}
