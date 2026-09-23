/**
 * Barra de archivos [R6 §3]: una sola lista de tableros, con buscador, Nuevo, Desde ejemplo,
 * acciones por fila (Renombrar, Clonar, Exportar, A la papelera) y la papelera plegada al pie.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useStore } from 'zustand';
import type { DocSummary } from '../../core/cloud/types';
import { t } from '../i18n/t';
import { IconChevron, IconMore, IconPlus, IconSidebar } from '../board/icons';
import type { CloudController, ExampleKey } from './controller';
import { relativeTime, timeUntil } from './time';

const EXAMPLES: readonly ExampleKey[] = ['arranque', 'temporizador', 'selector', 'catalogo'];

export function FilesSidebar({ cloud }: { cloud: CloudController }): ReactElement {
  const docs = useStore(cloud.ui, (s) => s.docs);
  const trash = useStore(cloud.ui, (s) => s.trash);
  const currentId = useStore(cloud.ui, (s) => s.current?.id);
  const editingHere = useStore(cloud.ui, (s) => s.current?.role === 'editor');
  const identity = useStore(cloud.ui, (s) => s.identity);
  const nickname = useStore(cloud.ui, (s) => s.nickname);
  const ready = useStore(cloud.ui, (s) => s.ready);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Los «hace 2 min» se refrescan solos.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? docs.filter((d) => d.name.toLowerCase().includes(q)) : docs;
  }, [docs, query]);

  const closeMenus = (): void => {
    setMenu(null);
    setExamplesOpen(false);
  };

  return (
    <aside className="tb-files" data-testid="files-sidebar" onPointerDown={(e) => e.stopPropagation()}>
      <div className="tb-files__head">
        <h2 className="tb-title">{t('cloud.title')}</h2>
        <button type="button" className="tb-icon" title={t('cloud.hide')} aria-label={t('cloud.hide')} onClick={() => cloud.toggleSidebar(false)}>
          <IconSidebar />
        </button>
      </div>

      <div className="tb-files__actions">
        <button type="button" className="tb-btn" title={t('cloud.newHint')} data-testid="files-new" onClick={() => void cloud.createNew()}>
          <IconPlus />
          <span>{t('cloud.new')}</span>
        </button>
        <div className="tb-menu">
          <button
            type="button"
            className={`tb-btn${examplesOpen ? ' is-on' : ''}`}
            aria-expanded={examplesOpen}
            onClick={() => {
              setMenu(null);
              setExamplesOpen((v) => !v);
            }}
          >
            <span>{t('cloud.fromExample')}</span>
            <IconChevron />
          </button>
          {examplesOpen && (
            <div className="tb-menu__list" role="menu">
              {EXAMPLES.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenus();
                    void cloud.createFromExample(key);
                  }}
                >
                  {t(`cloud.examples.${key}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <input
        type="search"
        className="tb-files__search"
        placeholder={t('cloud.search')}
        aria-label={t('cloud.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ul className="tb-files__list" role="list" aria-label={t('cloud.title')}>
        {ready && docs.length === 0 && <li className="tb-hint">{t('cloud.empty')}</li>}
        {docs.length > 0 && shown.length === 0 && <li className="tb-hint">{t('cloud.noMatch')}</li>}
        {shown.map((doc) => (
          <FileRow
            key={doc.id}
            doc={doc}
            now={now}
            active={doc.id === currentId}
            editingHere={doc.id === currentId && editingHere}
            menuOpen={menu === doc.id}
            renaming={renaming === doc.id}
            onOpen={() => {
              closeMenus();
              void cloud.open(doc.id);
            }}
            onMenu={() => {
              setExamplesOpen(false);
              setMenu((m) => (m === doc.id ? null : doc.id));
            }}
            onRename={() => {
              closeMenus();
              setRenaming(doc.id);
            }}
            onRenamed={(name) => {
              setRenaming(null);
              if (name !== null && name.trim() && name !== doc.name) void cloud.rename(doc.id, name);
            }}
            onClone={() => {
              closeMenus();
              void cloud.clone(doc.id);
            }}
            onExport={() => {
              closeMenus();
              void cloud.exportDoc(doc.id);
            }}
            onTrash={() => {
              closeMenus();
              void cloud.remove(doc.id);
            }}
          />
        ))}
      </ul>

      <details className="tb-files__trash" data-testid="files-trash">
        <summary>{t('cloud.trash', { count: trash.length })}</summary>
        {trash.length === 0 ? (
          <p className="tb-hint">{t('cloud.trashEmpty')}</p>
        ) : (
          <ul className="tb-files__list" role="list">
            {trash.map((doc) => (
              <li key={doc.id} className="tb-file is-trashed" data-name={doc.name}>
                <span className="tb-file__main">
                  <span className="tb-file__name">{doc.name}</span>
                  <span className="tb-file__meta">{t('cloud.purgeIn', { when: timeUntil(doc.purgeAt, now) })}</span>
                </span>
                <button type="button" className="tb-btn tb-btn--small" onClick={() => void cloud.restore(doc.id)}>
                  {t('cloud.restore')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>

      <div className="tb-files__me">
        {identity ? (
          <p className="tb-hint">{t('cloud.identity', { name: identity })}</p>
        ) : (
          <label className="tb-field">
            <span>{t('cloud.nickname')}</span>
            <input
              type="text"
              maxLength={60}
              placeholder={t('cloud.nicknamePlaceholder')}
              value={nickname}
              onChange={(e) => cloud.setNickname(e.target.value)}
            />
            <span className="tb-hint">{t('cloud.nicknameHint')}</span>
          </label>
        )}
      </div>
    </aside>
  );
}

function FileRow({
  doc,
  now,
  active,
  editingHere,
  menuOpen,
  renaming,
  onOpen,
  onMenu,
  onRename,
  onRenamed,
  onClone,
  onExport,
  onTrash,
}: {
  doc: DocSummary;
  now: number;
  active: boolean;
  /** Esta pestaña tiene el turno: no hace falta avisar que «alguien» lo edita. */
  editingHere: boolean;
  menuOpen: boolean;
  renaming: boolean;
  onOpen: () => void;
  onMenu: () => void;
  onRename: () => void;
  onRenamed: (name: string | null) => void;
  onClone: () => void;
  onExport: () => void;
  onTrash: () => void;
}): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    done.current = false;
    if (renaming) input.current?.select();
  }, [renaming]);
  const finish = (name: string | null): void => {
    if (done.current) return;
    done.current = true;
    onRenamed(name);
  };
  const when = relativeTime(doc.updatedAt, now);
  return (
    <li className={`tb-file${active ? ' is-active' : ''}`} data-testid="file-item" data-name={doc.name} data-active={active}>
      {renaming ? (
        <input
          ref={input}
          className="tb-file__rename"
          aria-label={t('cloud.renamePrompt')}
          defaultValue={doc.name}
          maxLength={120}
          onKeyDown={(e) => {
            if (e.key === 'Enter') finish(e.currentTarget.value);
            if (e.key === 'Escape') finish(null);
          }}
          onBlur={(e) => finish(e.currentTarget.value)}
        />
      ) : (
        <button type="button" className="tb-file__main" onClick={onOpen} onDoubleClick={onRename} title={doc.name}>
          <span className="tb-file__name">{doc.name}</span>
          <span className="tb-file__meta">{doc.updatedBy ? t('cloud.updatedBy', { when, who: doc.updatedBy }) : when}</span>
          {doc.editor && !editingHere && (
            <span className="tb-file__editor">
              {doc.editor.name ? t('cloud.editingBy', { name: doc.editor.name }) : t('cloud.editingAnon')}
            </span>
          )}
        </button>
      )}
      <div className="tb-menu">
        <button
          type="button"
          className="tb-icon tb-file__more"
          aria-label={t('cloud.actions', { name: doc.name })}
          aria-expanded={menuOpen}
          onClick={onMenu}
        >
          <IconMore />
        </button>
        {menuOpen && (
          <div className="tb-menu__list tb-menu__list--right" role="menu">
            <button type="button" role="menuitem" onClick={onRename}>
              {t('cloud.rename')}
            </button>
            <button type="button" role="menuitem" onClick={onClone}>
              {t('cloud.clone')}
            </button>
            <button type="button" role="menuitem" onClick={onExport}>
              {t('cloud.exportJson')}
            </button>
            <hr />
            <button type="button" role="menuitem" className="is-danger" onClick={onTrash}>
              {t('cloud.toTrash')}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
