/**
 * Piezas de la interfaz del tablero abierto [R6] (PLAN §24.5): el nombre con el estado del
 * guardado, el aviso de solo lectura con «Editar» y las notificaciones del servidor.
 */
import type { ReactElement } from 'react';
import { useStore } from 'zustand';
import { tMaybe, t } from '../i18n/t';
import { IconLock } from '../board/icons';
import type { BoardStore } from '../board/store';
import type { CloudController, CloudNotice } from './controller';

export function DocTitle({ cloud }: { cloud: CloudController }): ReactElement | null {
  const name = useStore(cloud.ui, (s) => s.current?.name);
  const save = useStore(cloud.ui, (s) => s.save);
  const viewer = useStore(cloud.ui, (s) => s.current?.role === 'viewer');
  if (name === undefined) return null;
  return (
    <span className="tb-doc" data-testid="doc-title">
      <span className="tb-doc__name" data-testid="doc-name" title={name}>
        {name}
      </span>
      {viewer ? (
        <span className="tb-doc__save is-readonly" data-testid="doc-mode">
          <IconLock />
          {t('cloud.readOnly')}
        </span>
      ) : (
        save !== 'idle' && (
          <span className={`tb-doc__save is-${save}`} data-testid="save-status" data-state={save}>
            {t(`cloud.save.${save}`)}
          </span>
        )
      )}
    </span>
  );
}

/** Franja sobre el lienzo: solo lectura, papelera, cambios en espera o servidor inalcanzable. */
export function CloudBanner({ cloud, board }: { cloud: CloudController; board: BoardStore }): ReactElement | null {
  const current = useStore(cloud.ui, (s) => s.current);
  const ready = useStore(cloud.ui, (s) => s.ready);
  const unreachable = useStore(cloud.ui, (s) => s.unreachable);
  const remotePending = useStore(cloud.ui, (s) => s.remotePending);
  const identity = useStore(cloud.ui, (s) => s.identity);
  const nickname = useStore(cloud.ui, (s) => s.nickname);
  const mode = useStore(board, (s) => s.mode);

  if (unreachable) {
    return (
      <div className="tb-banner is-warning" role="status" data-testid="cloud-banner">
        <span>{t('cloud.unreachable')}</span>
      </div>
    );
  }
  if (!ready && !current) {
    return (
      <div className="tb-banner" role="status" data-testid="cloud-banner">
        <span>{t('cloud.loading')}</span>
      </div>
    );
  }
  if (!current) {
    return (
      <div className="tb-banner" role="status" data-testid="cloud-banner">
        <span>{t('cloud.nothingOpen')}</span>
        <button type="button" className="tb-btn tb-btn--primary" onClick={() => void cloud.createNew()}>
          {t('cloud.new')}
        </button>
      </div>
    );
  }
  if (current.deleted) {
    return (
      <div className="tb-banner is-warning" role="status" data-testid="cloud-banner">
        <span>{t('cloud.inTrash')}</span>
        <button type="button" className="tb-btn" onClick={() => void cloud.restore(current.id)}>
          {t('cloud.restore')}
        </button>
      </div>
    );
  }
  if (current.role === 'viewer') {
    const me = identity ?? (nickname.trim() || null);
    const who = current.editor?.name;
    const text = !current.editor
      ? t('cloud.readOnly')
      : who && who === me
        ? t('cloud.readOnlyYou')
        : who
          ? t('cloud.readOnlyBy', { name: who })
          : t('cloud.readOnlyAnon');
    return (
      <div className="tb-banner" role="status" data-testid="cloud-banner">
        <IconLock />
        <span>{text}</span>
        {remotePending && mode !== 'edit' && <span className="tb-banner__extra">{t('cloud.remotePending')}</span>}
        <button
          type="button"
          className="tb-btn tb-btn--primary"
          data-testid="take-edit"
          title={t('cloud.takeHint')}
          onClick={() => void cloud.takeEdit()}
        >
          {t('cloud.take')}
        </button>
      </div>
    );
  }
  return null;
}

function noticeText(notice: CloudNotice): string {
  switch (notice.kind) {
    case 'tookOver':
      return notice.editor ? t('cloud.notice.tookOver', { name: notice.editor }) : t('cloud.notice.tookOverAnon');
    case 'copySaved':
      return t('cloud.notice.copySaved', { name: notice.name });
    case 'deleted':
      return t('cloud.notice.deleted');
    case 'recovered':
      return t('cloud.notice.recovered', { name: notice.name });
    case 'importFailed':
      return t('cloud.notice.importFailed', { reason: tMaybe(`cloud.errors.${notice.code}`) ?? t('cloud.errors.other') });
    case 'error':
      return t('cloud.notice.error', { reason: tMaybe(`cloud.errors.${notice.code}`) ?? t('cloud.errors.SERVER') });
  }
}

export function CloudNoticeToast({ cloud }: { cloud: CloudController }): ReactElement | null {
  const notice = useStore(cloud.ui, (s) => s.notice);
  if (!notice) return null;
  const tone = notice.kind === 'error' || notice.kind === 'importFailed' ? 'is-error' : 'is-info';
  return (
    <div className={`tb-toast ${tone}`} role="alert" data-testid="cloud-notice" data-kind={notice.kind}>
      <span>{noticeText(notice)}</span>
      <button type="button" className="tb-btn tb-btn--small" onClick={() => cloud.dismissNotice()}>
        {t('cloud.close')}
      </button>
    </div>
  );
}
