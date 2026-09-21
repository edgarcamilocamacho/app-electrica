import { useShallow } from 'zustand/react/shallow';
import { canRedo, canUndo } from '../../core/history/history';
import { EXAMPLE_IDS } from '../../examples';
import { exportDiagram, type PdfPage } from '../export/exporter';
import { t } from '../i18n/t';
import { useEditor, useEditorStore } from '../store/context';
import { SPEEDS, type Speed, type ToolKind } from '../store/editorStore';
import { Icons } from './icons';
import { Menu } from './Menu';

const TOOLS: { kind: ToolKind; key: string; icon: keyof typeof Icons }[] = [
  { kind: 'select', key: 'S', icon: 'select' },
  { kind: 'wire', key: 'C', icon: 'wire' },
  { kind: 'move', key: 'M', icon: 'move' },
  { kind: 'erase', key: 'B', icon: 'erase' },
  { kind: 'text', key: 'T', icon: 'text' },
];

export function Toolbar() {
  const store = useEditorStore();
  const { tool, mode, undoable, redoable, speed } = useEditor(
    useShallow((s) => ({ tool: s.tool.kind, mode: s.mode, undoable: canUndo(s.history), redoable: canRedo(s.history), speed: s.speed })),
  );
  const editing = mode === 'edit';
  const s = () => store.getState();

  const exportAs = (format: 'png' | 'svg' | 'pdf', page?: PdfPage) => {
    exportDiagram(store, format, page).catch(() => s().showMessage('messages.exportFailed', undefined, 'error'));
  };

  return (
    <header className="toolbar" role="toolbar" aria-label={t('app.title')}>
      <div className="tb-brand">{t('app.title')}</div>

      <div className="tb-group">
        <Menu
          label={t('toolbar.file')}
          icon={Icons.file}
          testId="menu-file"
          disabled={!editing}
          items={[
            { label: t('menu.new'), onSelect: () => s().newDocument(), testId: 'menu-new' },
            { label: t('menu.open'), onSelect: () => void s().openFile(), testId: 'menu-open' },
            { label: t('menu.save'), onSelect: () => void s().save(), testId: 'menu-save' },
            { label: t('menu.saveAs'), onSelect: () => void s().save(true), testId: 'menu-save-as' },
          ]}
        />
        <Menu
          label={t('toolbar.examples')}
          icon={Icons.examples}
          testId="menu-examples"
          disabled={!editing}
          items={EXAMPLE_IDS.map((id) => ({ label: t(`examples.${id}`), onSelect: () => s().loadExample(id), testId: `example-${id}` }))}
        />
        <Menu
          label={t('toolbar.export')}
          icon={Icons.export}
          testId="menu-export"
          items={[
            { label: t('menu.exportPng'), onSelect: () => exportAs('png'), testId: 'export-png' },
            { label: t('menu.exportSvg'), onSelect: () => exportAs('svg'), testId: 'export-svg' },
            { label: `${t('menu.exportPdf')} · ${t('menu.pageA4')}`, onSelect: () => exportAs('pdf', 'a4'), testId: 'export-pdf-a4' },
            { label: `${t('menu.exportPdf')} · ${t('menu.pageA3')}`, onSelect: () => exportAs('pdf', 'a3'), testId: 'export-pdf-a3' },
            { label: `${t('menu.exportPdf')} · ${t('menu.pageFit')}`, onSelect: () => exportAs('pdf', 'fit'), testId: 'export-pdf-fit' },
          ]}
        />
      </div>

      <div className="tb-group" role="group" aria-label={t('toolbar.mainTools')}>
        {TOOLS.map((x) => {
          const name = t(`tools.${x.kind}`);
          return (
            <button
              key={x.kind}
              type="button"
              className={`tb-button${tool === x.kind ? ' active' : ''}`}
              aria-pressed={tool === x.kind}
              title={t('tools.withKey', { name, key: x.key })}
              aria-label={name}
              data-testid={`tool-${x.kind}`}
              disabled={!editing}
              onClick={() => s().setTool(x.kind)}
            >
              {Icons[x.icon]}
            </button>
          );
        })}
      </div>

      <div className="tb-group" role="group" aria-label={t('toolbar.history')}>
        <button type="button" className="tb-button" title={t('toolbar.undo')} aria-label={t('toolbar.undo')} data-testid="undo" disabled={!editing || !undoable} onClick={() => s().undo()}>
          {Icons.undo}
        </button>
        <button type="button" className="tb-button" title={t('toolbar.redo')} aria-label={t('toolbar.redo')} data-testid="redo" disabled={!editing || !redoable} onClick={() => s().redo()}>
          {Icons.redo}
        </button>
      </div>

      <div className="tb-group" role="group" aria-label={t('toolbar.view')}>
        <button type="button" className="tb-button" title={t('toolbar.zoomOut')} aria-label={t('toolbar.zoomOut')} onClick={() => zoomCenter(0.8)}>
          {Icons.zoomOut}
        </button>
        <button type="button" className="tb-button" title={t('toolbar.zoomIn')} aria-label={t('toolbar.zoomIn')} onClick={() => zoomCenter(1.25)}>
          {Icons.zoomIn}
        </button>
        <button type="button" className="tb-button" title={t('toolbar.fit')} aria-label={t('toolbar.fit')} data-testid="fit-view" onClick={() => s().fitView()}>
          {Icons.fit}
        </button>
      </div>

      <div className="tb-spacer" />

      <div className="tb-group tb-sim" role="group" aria-label={t('toolbar.simulation')}>
        {mode === 'error' ? (
          <button type="button" className="tb-button tb-danger tb-wide" data-testid="exit-error" onClick={() => s().exitError()}>
            {Icons.back}
            <span>{t('toolbar.backToEdit')}</span>
          </button>
        ) : (
          <button
            type="button"
            className={`tb-button tb-wide ${mode === 'simulating' ? 'tb-stop' : 'tb-play'}`}
            data-testid="toggle-sim"
            onClick={() => s().toggleSimulation()}
          >
            {mode === 'simulating' ? Icons.stop : Icons.play}
            <span>{mode === 'simulating' ? t('toolbar.stop') : t('toolbar.simulate')}</span>
          </button>
        )}
        <label className="tb-speed">
          <span>{t('toolbar.speed')}</span>
          <select value={speed} data-testid="speed" onChange={(e) => s().setSpeed(Number(e.target.value) as Speed)}>
            {SPEEDS.map((v) => (
              <option key={v} value={v}>
                {t('toolbar.speedValue', { value: String(v).replace('.', ',') })}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );

  function zoomCenter(factor: number) {
    const { width, height } = s().canvasSize;
    s().zoomAt({ x: width / 2, y: height / 2 }, factor);
  }
}
