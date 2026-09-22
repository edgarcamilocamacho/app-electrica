/**
 * Interfaz del tablero: barra agrupada, biblioteca con miniaturas, lienzo, propiedades,
 * diagnósticos y barra de estado.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useStore } from 'zustand';
import { emptyBoard, WIRE_COLORS, WIRE_GAUGES, type WireColor, type WireGauge } from '../../core/board/model';
import type { DeviceDefinition } from '../../core/board/registry';
import type { SimSnapshot } from '../../core/board/sim/engine';
import { starterBoard } from '../../examples/board';
import { browserStorage } from '../../platform/storage';
import { t } from '../i18n/t';
import { BoardCanvas } from './BoardCanvas';
import { DeviceThumb } from './DeviceThumb';
import {
  exportBoard,
  openBoard,
  readBoardAutosave,
  saveBoard,
  writeBoardAutosave,
  type BoardFileState,
} from './files';
import {
  IconChevron,
  IconErase,
  IconFile,
  IconFit,
  IconPlay,
  IconRedo,
  IconSelect,
  IconStop,
  IconText,
  IconUndo,
  IconWarning,
  IconWire,
} from './icons';
import { docOf, selectionOf, SPEEDS, type BoardStore, type BoardToolKind } from './store';
import { WIRE_TONES } from './theme';
import './board.css';

const TOOLS: readonly { kind: BoardToolKind; key: string; icon: () => ReactElement; label: string }[] = [
  { kind: 'select', key: 'S', icon: IconSelect, label: t('tools.select') },
  { kind: 'wire', key: 'C', icon: IconWire, label: t('tools.wire') },
  { kind: 'erase', key: 'B', icon: IconErase, label: t('tools.erase') },
  { kind: 'text', key: 'T', icon: IconText, label: t('tools.text') },
];

export function BoardApp({ store, autoAdvance = true }: { store: BoardStore; autoAdvance?: boolean }): ReactElement {
  const state = useStore(store);
  const doc = docOf(state);
  const selection = selectionOf(state);
  const editing = state.mode === 'edit';
  const file = useRef<BoardFileState>({ name: '' });
  const [menuOpen, setMenuOpen] = useState(false);

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
      if (ctrl && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        s.copySelection();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        s.paste();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelection();
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
        case 'a':
          fitView(s);
          break;
        case 'escape':
          // Escape siempre deja la herramienta Seleccionar.
          setMenuOpen(false);
          s.cancel();
          s.setTool('select');
          break;
        case 'delete':
        case 'backspace':
          if (s.mode === 'edit' && !s.wiring) s.deleteSelection();
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
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { code: string; severity: string; count: number; params: Record<string, string | number>; at?: { x: number; y: number } }
    >();
    for (const d of diagnostics) {
      const found = map.get(d.code);
      if (found) found.count += 1;
      else map.set(d.code, { code: d.code, severity: d.severity, count: 1, params: { ...d.params }, ...(d.at ? { at: d.at } : {}) });
    }
    return [...map.values()];
  }, [diagnostics]);
  const blocking = grouped.filter((d) => d.severity === 'blocking');

  const selectedDevice = selection.devices.length === 1 ? doc.devices[selection.devices[0]!] : undefined;
  const selectedDef = selectedDevice ? state.registry.get(selectedDevice.type) : undefined;

  const newBoard = (): void => {
    file.current = { name: '' };
    store
      .getState()
      .loadDocument(emptyBoard({ name: '', createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() }));
  };

  const open = (): void => {
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
  };

  const save = (): void => {
    void (async () => {
      const saved = await saveBoard(store, file.current);
      if (saved) file.current = { name: saved.name, ...(saved.handle ? { handle: saved.handle } : {}) };
    })();
  };

  const exportAs = (format: 'png' | 'svg' | 'pdf'): void => {
    void exportBoard(store, format, file.current.name || t('app.untitled'));
  };

  const loadExample = (): void => {
    file.current = { name: '' };
    store
      .getState()
      .loadDocument(
        starterBoard({ ids: { next: (p) => `${p}${Math.random().toString(36).slice(2, 8)}` }, registry: state.registry }),
      );
  };

  return (
    <div className="tb-app" onPointerDown={() => setMenuOpen(false)}>
      <header className="tb-bar">
        <span className="tb-brand">{t('app.title')}</span>

        <div className="tb-seg" role="group">
          {TOOLS.map(({ kind, key, icon: Icon, label }) => (
            <button
              key={kind}
              type="button"
              className={`tb-seg__btn${state.tool === kind && editing ? ' is-on' : ''}`}
              data-testid={`tool-${kind}`}
              disabled={!editing}
              title={t('tools.withKey', { name: label, key })}
              onClick={() => store.getState().setTool(kind)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <span className="tb-divider" />

        <div className="tb-menu" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`tb-btn${menuOpen ? ' is-on' : ''}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <IconFile />
            <span>{t('toolbar.file')}</span>
            <IconChevron />
          </button>
          {menuOpen && (
            <div className="tb-menu__list" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); newBoard(); }}>
                {t('menu.new')}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); open(); }}>
                {t('menu.open')}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); save(); }}>
                {t('menu.save')}
              </button>
              <hr />
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); exportAs('png'); }}>
                {t('menu.exportPng')}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); exportAs('svg'); }}>
                {t('menu.exportSvg')}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); exportAs('pdf'); }}>
                {t('menu.exportPdf')}
              </button>
              <hr />
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); loadExample(); }}>
                {t('toolbar.examples')}
              </button>
            </div>
          )}
        </div>

        <span className="tb-divider" />

        <button
          type="button"
          className="tb-icon"
          title={t('toolbar.undo')}
          disabled={!state.canUndo()}
          onClick={() => store.getState().undo()}
        >
          <IconUndo />
        </button>
        <button
          type="button"
          className="tb-icon"
          title={t('toolbar.redo')}
          disabled={!state.canRedo()}
          onClick={() => store.getState().redo()}
        >
          <IconRedo />
        </button>
        <button type="button" className="tb-icon" title={t('toolbar.fit')} onClick={() => fitView(store.getState())}>
          <IconFit />
        </button>

        <span className="tb-spacer" />

        {state.mode === 'simulating' && (
          <div className="tb-seg tb-seg--small" role="group" aria-label={t('toolbar.speed')}>
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                className={`tb-seg__btn${state.speed === speed ? ' is-on' : ''}`}
                onClick={() => store.getState().setSpeed(speed)}
              >
                <span>{t('toolbar.speedValue', { value: speed })}</span>
              </button>
            ))}
          </div>
        )}

        {state.mode === 'edit' ? (
          <button
            type="button"
            className="tb-btn tb-btn--primary"
            data-testid="simulate"
            disabled={blocking.length > 0}
            title={blocking.length > 0 ? t('messages.cannotSimulate', { count: blocking.length }) : t('toolbar.simulate')}
            onClick={() => store.getState().startSim()}
          >
            <IconPlay />
            <span>{t('toolbar.simulate')}</span>
          </button>
        ) : (
          <button type="button" className="tb-btn tb-btn--danger" data-testid="stop" onClick={() => store.getState().backToEdit()}>
            <IconStop />
            <span>{t('toolbar.stop')}</span>
          </button>
        )}
      </header>

      <aside className="tb-side tb-side--left">
        <h2 className="tb-title">{t('library.title')}</h2>
        {byCategory.map(([category, defs]) => (
          <section className="tb-group" key={category}>
            <h3 className="tb-group__title">{t(`library.categories.${category}` as Parameters<typeof t>[0])}</h3>
            <div className="tb-lib">
              {defs.map((def) => (
                <button
                  key={def.type}
                  type="button"
                  className={`tb-card${state.placing?.type === def.type ? ' is-on' : ''}`}
                  data-testid={`library-${def.type}`}
                  disabled={!editing}
                  title={t(`components.${def.type}` as Parameters<typeof t>[0])}
                  onClick={() => store.getState().startPlacing(def.type, { x: 0, y: 0 })}
                >
                  <DeviceThumb def={def} />
                  <span>{t(`components.${def.type}` as Parameters<typeof t>[0])}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </aside>

      <main className="tb-canvas">
        <BoardCanvas store={store} />
        {state.mode === 'error' && (
          <div className="tb-error" role="alert" data-testid="error-panel">
            <IconWarning />
            <div className="tb-error__text">
              <strong>{t('status.error')}</strong>
              <p>{`${faultMessage(state.sim?.fault)} ${t('board.fault.frozen')}`}</p>
            </div>
            <button type="button" className="tb-btn" onClick={() => store.getState().backToEdit()}>
              {t('board.fault.back')}
            </button>
          </div>
        )}
      </main>

      <aside className="tb-side tb-side--right">
        <h2 className="tb-title">{t('properties.title')}</h2>
        {selectedDevice && selectedDef ? (
          <DeviceProps
            store={store}
            deviceId={selectedDevice.id}
            def={selectedDef}
            props={selectedDevice.props}
            editing={editing}
          />
        ) : (
          <p className="tb-hint">{state.tool === 'wire' ? t('board.wireHint') : t('properties.nothing')}</p>
        )}

        <section className="tb-group">
          <h3 className="tb-group__title">{t('board.wireStyle')}</h3>
          <div className="tb-field">
            <span>{t('board.wireColor')}</span>
            <div className="tb-swatches">
              {WIRE_COLORS.map((color: WireColor) => (
                <button
                  key={color}
                  type="button"
                  title={t(`board.colors.${color}` as Parameters<typeof t>[0])}
                  className={`tb-swatch${state.wireStyle.color === color ? ' is-on' : ''}`}
                  style={{ background: WIRE_TONES[color].off }}
                  onClick={() => store.getState().setWireLook(color)}
                />
              ))}
            </div>
          </div>
          <label className="tb-field">
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
        </section>

        <section className="tb-group">
          <h3 className="tb-group__title">{t('diagnostics.title')}</h3>
          {grouped.length === 0 ? (
            <p className="tb-hint">{t('diagnostics.none')}</p>
          ) : (
            <ul className="tb-diags">
              {grouped.map((d) => (
                <li key={d.code} className={`tb-diag is-${d.severity}`}>
                  <span className="tb-diag__text">
                    {t(`board.diag.${d.code}` as Parameters<typeof t>[0], {
                      ...d.params,
                      x: d.at ? Math.round(d.at.x) : 0,
                      y: d.at ? Math.round(d.at.y) : 0,
                      count: d.count,
                    })}
                  </span>
                  {d.count > 1 && <span className="tb-diag__count">{d.count}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <footer className="tb-status">
        <span className={`tb-mode is-${state.mode}`} data-testid="mode">
          {state.mode === 'edit' ? t('status.edit') : state.mode === 'simulating' ? t('status.simulating') : t('status.error')}
        </span>
        <span>{`${Object.keys(doc.devices).length} · ${Object.keys(doc.wires).length}`}</span>
        {state.mode === 'simulating' && state.sim && (
          <span>{t('status.time', { value: (state.sim.clockMs / 1000).toFixed(1).replace('.', ',') })}</span>
        )}
        <span className="tb-spacer" />
        <span>{t('status.zoom', { value: Math.round(state.viewport.zoom * 100) })}</span>
      </footer>
    </div>
  );
}

function fitView(s: ReturnType<BoardStore['getState']>): void {
  const host = document.querySelector('.tb-canvas');
  if (host instanceof HTMLElement) s.fitView({ width: host.clientWidth, height: host.clientHeight });
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
    <section className="tb-group">
      <div className="tb-selected">
        <DeviceThumb def={def} width={64} height={46} />
        <div>
          <strong>{t(`components.${def.type}` as Parameters<typeof t>[0])}</strong>
          <span className="tb-hint">{t('board.terminalCount', { count: def.terminals.length })}</span>
        </div>
      </div>
      {def.props.map((spec) => {
        const value = props[spec.key];
        if (spec.kind === 'ref' || spec.kind === 'text') {
          return (
            <label className="tb-field" key={spec.key}>
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
            <label className="tb-field tb-field--row" key={spec.key}>
              <input
                type="checkbox"
                disabled={!editing}
                checked={value === true}
                onChange={(e) => store.getState().setProps(deviceId, { [spec.key]: e.target.checked })}
              />
              <span>{t('properties.initiallyActuated')}</span>
            </label>
          );
        }
        if (spec.kind === 'durationMs') {
          return (
            <label className="tb-field" key={spec.key}>
              <span>{t('properties.presetSeconds')}</span>
              <input
                type="number"
                step={0.1}
                min={spec.min / 1000}
                max={spec.max / 1000}
                disabled={!editing}
                value={typeof value === 'number' ? value / 1000 : ''}
                onChange={(e) =>
                  store.getState().setProps(deviceId, { [spec.key]: Math.round(Number(e.target.value) * 1000) })
                }
              />
            </label>
          );
        }
        const isPosition = spec.key === 'initialPosition';
        return (
          <label className="tb-field" key={spec.key}>
            <span>{isPosition ? t('properties.initialPosition') : t('properties.color')}</span>
            <select
              disabled={!editing}
              value={String(value)}
              onChange={(e) =>
                store.getState().setProps(deviceId, { [spec.key]: isPosition ? Number(e.target.value) : e.target.value })
              }
            >
              {spec.options.map((option) => (
                <option key={String(option)} value={String(option)}>
                  {isPosition
                    ? t(`properties.positions.${String(option)}` as Parameters<typeof t>[0])
                    : t(`properties.colors.${String(option)}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </section>
  );
}
