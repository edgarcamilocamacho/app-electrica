/**
 * Interfaz del tablero: barra, biblioteca, lienzo, propiedades y barra de estado.
 * Todavía sin archivos ni exportación (G5).
 */
import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { useStore } from 'zustand';
import { WIRE_COLORS, WIRE_GAUGES, type WireColor, type WireGauge } from '../../core/board/model';
import type { DeviceDefinition } from '../../core/board/registry';
import type { SimSnapshot } from '../../core/board/sim/engine';
import { t } from '../i18n/t';
import { BoardCanvas } from './BoardCanvas';
import { exportBoard, openBoard, readBoardAutosave, saveBoard, writeBoardAutosave, type BoardFileState } from './files';
import { emptyBoard } from '../../core/board/model';
import { browserStorage } from '../../platform/storage';
import { starterBoard } from '../../examples/board';
import { docOf, selectionOf, SPEEDS, type BoardStore, type BoardToolKind } from './store';
import { WIRE_TONES } from './theme';
import './board.css';

const TOOL_KEYS: Record<BoardToolKind, string> = { select: 'S', wire: 'C', erase: 'B', text: 'T' };
const TOOL_NAMES: Record<BoardToolKind, string> = {
  select: t('tools.select'),
  wire: t('tools.wire'),
  erase: t('tools.erase'),
  text: t('tools.text'),
};

export function BoardApp({ store, autoAdvance = true }: { store: BoardStore; autoAdvance?: boolean }): ReactElement {
  const state = useStore(store);
  const file = useRef<BoardFileState>({ name: '' });
  const doc = docOf(state);
  const selection = selectionOf(state);
  const editing = state.mode === 'edit';

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const s = store.getState();
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        s.undo();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (ctrl) return;
      switch (e.key.toLowerCase()) {
        case 's':
          s.setTool('select');
          break;
        case 'c':
          s.setTool('wire');
          break;
        case 'b':
          s.setTool('erase');
          break;
        case 't':
          s.setTool('text');
          break;
        case 'e':
          if (s.mode === 'edit') s.startSim();
          else if (s.mode === 'simulating') s.stopSim();
          break;
        case 'a': {
          const host = document.querySelector('.tablero__canvas');
          if (host instanceof HTMLElement) s.fitView({ width: host.clientWidth, height: host.clientHeight });
          break;
        }
        case 'escape':
          s.cancel();
          break;
        case 'delete':
        case 'backspace':
          if (s.mode === 'edit') s.deleteSelection();
          break;
        case 'arrowleft':
          s.nudge(-1, 0);
          break;
        case 'arrowright':
          s.nudge(1, 0);
          break;
        case 'arrowup':
          s.nudge(0, -1);
          break;
        case 'arrowdown':
          s.nudge(0, 1);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  useEffect(() => {
    const saved = readBoardAutosave(browserStorage);
    if (saved) {
      file.current = { name: saved.name };
      store.getState().loadDocument(saved.doc);
    }
  }, [store]);

  useEffect(() => {
    const id = window.setTimeout(() => writeBoardAutosave(browserStorage, doc, file.current.name), 600);
    return () => window.clearTimeout(id);
  }, [doc]);

  useEffect(() => {
    if (state.mode !== 'simulating' || !autoAdvance) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (): void => {
      store.getState().advance((performance.now() - t0) * state.speed);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.mode, state.speed, store, autoAdvance]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, DeviceDefinition[]>();
    for (const def of state.registry.all()) {
      const list = groups.get(def.category);
      if (list) list.push(def);
      else groups.set(def.category, [def]);
    }
    return [...groups.entries()];
  }, [state.registry]);

  const diagnostics = useMemo(() => state.diagnostics(), [state]);
  const blocking = diagnostics.filter((d) => d.severity === 'blocking');

  const selectedDevice = selection.devices.length === 1 ? doc.devices[selection.devices[0]!] : undefined;
  const selectedDef = selectedDevice ? state.registry.get(selectedDevice.type) : undefined;

  return (
    <div className="tablero">
      <div className="tablero__bar">
        <span className="tablero__title">{t('app.title')}</span>
        {(['select', 'wire', 'erase', 'text'] as const).map((tool) => (
          <button
            key={tool}
            type="button"
            className={`tablero__btn${state.tool === tool && editing ? ' tablero__btn--on' : ''}`}
            data-testid={`tool-${tool}`}
            disabled={!editing}
            onClick={() => store.getState().setTool(tool)}
          >
            {TOOL_NAMES[tool]}
            <span className="tablero__key">{TOOL_KEYS[tool]}</span>
          </button>
        ))}
        <button
          type="button"
          className="tablero__btn"
          onClick={() => {
            file.current = { name: '' };
            store.getState().loadDocument(emptyBoard({ name: '', createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() }));
          }}
        >
          {t('menu.new')}
        </button>
        <button
          type="button"
          className="tablero__btn"
          onClick={() => {
            void (async () => {
              const result = await openBoard();
              if (!result) return;
              if (!result.ok) {
                window.alert(result.code === 'CLASSIC_FILE' ? t('board.classicFile') : t('board.badFile'));
                return;
              }
              file.current = { name: result.name, ...(result.handle ? { handle: result.handle } : {}) };
              store.getState().loadDocument(result.doc);
            })();
          }}
        >
          {t('menu.open')}
        </button>
        <button
          type="button"
          className="tablero__btn"
          onClick={() => {
            void (async () => {
              const saved = await saveBoard(store, file.current);
              if (saved) file.current = { name: saved.name, ...(saved.handle ? { handle: saved.handle } : {}) };
            })();
          }}
        >
          {t('menu.save')}
        </button>
        <button
          type="button"
          className="tablero__btn"
          onClick={() => {
            void exportBoard(store, 'png', file.current.name || t('app.untitled'));
          }}
        >
          {t('menu.exportPng')}
        </button>
        <button
          type="button"
          className="tablero__btn"
          onClick={() => {
            void exportBoard(store, 'pdf', file.current.name || t('app.untitled'));
          }}
        >
          {t('menu.exportPdf')}
        </button>
        <button
          type="button"
          className="tablero__btn"
          onClick={() => {
            file.current = { name: '' };
            store.getState().loadDocument(starterBoard({ ids: { next: (p) => `${p}${Math.random().toString(36).slice(2, 8)}` }, registry: state.registry }));
          }}
        >
          {t('toolbar.examples')}
        </button>
        <span className="tablero__sep" />
        <button type="button" className="tablero__btn" disabled={!state.canUndo()} onClick={() => store.getState().undo()}>
          {t('toolbar.undo')}
        </button>
        <button type="button" className="tablero__btn" disabled={!state.canRedo()} onClick={() => store.getState().redo()}>
          {t('toolbar.redo')}
        </button>
        <button
          type="button"
          className="tablero__btn"
          onClick={() => {
            const host = document.querySelector('.tablero__canvas');
            if (host instanceof HTMLElement) store.getState().fitView({ width: host.clientWidth, height: host.clientHeight });
          }}
        >
          {t('toolbar.fit')}
        </button>
        <span className="tablero__sep" />
        {state.mode === 'edit' ? (
          <button
            type="button"
            className="tablero__btn"
            data-testid="simulate"
            disabled={blocking.length > 0}
            title={blocking.length > 0 ? t('messages.cannotSimulate', { count: blocking.length }) : undefined}
            onClick={() => store.getState().startSim()}
          >
            {t('toolbar.simulate')}
          </button>
        ) : (
          <button
            type="button"
            className="tablero__btn tablero__btn--on"
            data-testid="stop"
            onClick={() => store.getState().backToEdit()}
          >
            {t('toolbar.stop')}
          </button>
        )}
        {state.mode === 'simulating' &&
          SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              className={`tablero__btn${state.speed === speed ? ' tablero__btn--on' : ''}`}
              onClick={() => store.getState().setSpeed(speed)}
            >
              {`${speed}×`}
            </button>
          ))}
      </div>

      <div className="tablero__lib">
        <div className="tablero__grouptitle">{t('library.title')}</div>
        {byCategory.map(([category, defs]) => (
          <div className="tablero__group" key={category}>
            <div className="tablero__grouptitle">{t(`library.categories.${category}` as Parameters<typeof t>[0])}</div>
            {defs.map((def) => (
              <button
                key={def.type}
                type="button"
                className={`tablero__item${state.placing?.type === def.type ? ' tablero__item--on' : ''}`}
                data-testid={`library-${def.type}`}
                disabled={!editing}
                onClick={() => store.getState().startPlacing(def.type, { x: 0, y: 0 })}
              >
                {t(`components.${def.type}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        ))}
        <p className="tablero__hint">{state.tool === 'wire' ? t('board.wireHint') : t('library.hint')}</p>
      </div>

      <div className="tablero__canvas">
        <BoardCanvas store={store} />
        {state.mode === 'error' && (
          <div className="tablero__error" role="alert" data-testid="error-panel">
            <strong>{t('status.error')}</strong>
            <span>{faultMessage(state.sim?.fault)}</span>
            <span>{t('board.fault.frozen')}</span>
            <button type="button" className="tablero__btn" onClick={() => store.getState().backToEdit()}>
              {t('board.fault.back')}
            </button>
          </div>
        )}
      </div>

      <div className="tablero__props">
        <div className="tablero__grouptitle">{t('properties.title')}</div>
        {selectedDevice && selectedDef ? (
          <DeviceProps store={store} deviceId={selectedDevice.id} def={selectedDef} props={selectedDevice.props} editing={editing} />
        ) : (
          <p className="tablero__hint">{t('properties.nothing')}</p>
        )}
        <div className="tablero__group">
          <div className="tablero__grouptitle">{t('diagnostics.title')}</div>
          {diagnostics.length === 0 ? (
            <p className="tablero__hint">{t('diagnostics.none')}</p>
          ) : (
            <ul className="tablero__diags">
              {diagnostics.map((d) => (
                <li key={d.key} className={`tablero__diag tablero__diag--${d.severity}`}>
                  {t(`board.diag.${d.code}` as Parameters<typeof t>[0], {
                    ...d.params,
                    x: d.at ? Math.round(d.at.x) : 0,
                    y: d.at ? Math.round(d.at.y) : 0,
                    count: d.deviceIds.length,
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="tablero__group">
          <div className="tablero__grouptitle">{t('board.wireStyle')}</div>
          <label className="tablero__field">
            <span>{t('board.wireColor')}</span>
            <span className="tablero__swatches">
              {WIRE_COLORS.map((color: WireColor) => (
                <button
                  key={color}
                  type="button"
                  title={t(`board.colors.${color}` as Parameters<typeof t>[0])}
                  className={`tablero__swatch${state.wireStyle.color === color ? ' tablero__swatch--on' : ''}`}
                  style={{ background: WIRE_TONES[color].off }}
                  onClick={() => store.getState().setWireLook(color)}
                />
              ))}
            </span>
          </label>
          <label className="tablero__field">
            <span>{t('board.wireGauge')}</span>
            <select
              value={state.wireStyle.gauge}
              onChange={(e) => store.getState().setWireLook(undefined, Number(e.target.value) as WireGauge)}
            >
              {WIRE_GAUGES.map((gauge) => (
                <option key={gauge} value={gauge}>
                  {t(`board.gauges.${gauge}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="tablero__status">
        <span
          className={`tablero__mode${state.mode === 'error' ? ' tablero__mode--error' : ''}`}
          data-testid="mode"
        >
          {state.mode === 'edit' ? t('status.edit') : state.mode === 'simulating' ? t('status.simulating') : t('status.error')}
        </span>
        <span>{`${Object.keys(doc.devices).length} · ${Object.keys(doc.wires).length}`}</span>
        {state.status && <span>{state.status.text}</span>}
      </div>
    </div>
  );
}

function faultMessage(fault: SimSnapshot['fault']): string {
  if (!fault) return '';
  if (fault.kind === 'oscillation') return t('board.fault.oscillation');
  return fault.reason === 'phase-phase' ? t('board.fault.shortPhasePhase') : t('board.fault.shortPhaseNeutral');
}

function DeviceProps({
  store,
  deviceId,
  def,
  props,
  editing,
}: {
  store: BoardStore;
  deviceId: string;
  def: DeviceDefinition;
  props: Readonly<Record<string, unknown>>;
  editing: boolean;
}): ReactElement {
  return (
    <div className="tablero__group">
      <label className="tablero__field">
        <span>{t('properties.type')}</span>
        <input type="text" readOnly value={t(`components.${def.type}` as Parameters<typeof t>[0])} />
      </label>
      {def.props.map((spec) => {
        const value = props[spec.key];
        if (spec.kind === 'ref' || spec.kind === 'text') {
          return (
            <label className="tablero__field" key={spec.key}>
              <span>{spec.kind === 'ref' ? t('properties.ref') : t('properties.label')}</span>
              <input
                type="text"
                disabled={!editing}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => store.getState().setProps(deviceId, { [spec.key]: e.target.value })}
              />
            </label>
          );
        }
        if (spec.kind === 'boolean') {
          return (
            <label className="tablero__field" key={spec.key}>
              <span>{t('properties.initiallyActuated')}</span>
              <input
                type="checkbox"
                disabled={!editing}
                checked={value === true}
                onChange={(e) => store.getState().setProps(deviceId, { [spec.key]: e.target.checked })}
              />
            </label>
          );
        }
        if (spec.kind === 'durationMs') {
          return (
            <label className="tablero__field" key={spec.key}>
              <span>{t('properties.presetSeconds')}</span>
              <input
                type="number"
                step={0.1}
                min={spec.min / 1000}
                max={spec.max / 1000}
                disabled={!editing}
                value={typeof value === 'number' ? value / 1000 : ''}
                onChange={(e) => store.getState().setProps(deviceId, { [spec.key]: Math.round(Number(e.target.value) * 1000) })}
              />
            </label>
          );
        }
        return (
          <label className="tablero__field" key={spec.key}>
            <span>{t('properties.color')}</span>
            <select
              disabled={!editing}
              value={String(value)}
              onChange={(e) => store.getState().setProps(deviceId, { [spec.key]: e.target.value })}
            >
              {spec.options.map((option) => (
                <option key={String(option)} value={String(option)}>
                  {t(`properties.colors.${String(option)}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
