import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildRefIndex } from '../../core/connectivity/refs';
import { vertexPosition } from '../../core/model/document';
import type { ComponentInstance } from '../../core/model/types';
import { MAX_PRESET_MS, MIN_PRESET_MS } from '../../core/registry/catalog';
import type { PropSpec } from '../../core/registry/types';
import type { DeviceView } from '../../core/sim/engine';
import { formatSeconds, msToSecondsText, parseSecondsText } from '../i18n/format';
import { t, type MessageKey } from '../i18n/t';
import { useEditor, useEditorStore, useRegistry } from '../store/context';
import { docOf, selectionOfState } from '../store/editorStore';

/** Panel derecho de propiedades (spec §7.2). Se genera desde los descriptores del catálogo. */
export function Properties() {
  const { doc, selection, mode, sim } = useEditor(
    useShallow((s) => ({ doc: docOf(s), selection: selectionOfState(s), mode: s.mode, sim: s.simSnapshot })),
  );
  const count = selection.components.length + selection.segments.length + selection.annotations.length;
  const readOnly = mode !== 'edit';

  let body;
  if (count === 0) body = <p className="panel-empty">{t('properties.nothing')}</p>;
  else if (count > 1) body = <p className="panel-empty">{t('properties.multiple', { count })}</p>;
  else if (selection.components[0]) {
    const c = doc.components[selection.components[0]];
    body = c ? <ComponentProps component={c} readOnly={readOnly} view={sim?.devices.get(c.id)} /> : null;
  } else if (selection.annotations[0]) {
    const n = doc.annotations[selection.annotations[0]];
    body = n ? <AnnotationProps id={n.id} text={n.text} readOnly={readOnly} /> : null;
  } else if (selection.segments[0]) {
    const s = doc.segments[selection.segments[0]];
    body = s ? <SegmentInfo segmentId={s.id} /> : null;
  }

  return (
    <section className="panel properties" aria-label={t('properties.title')} data-testid="properties">
      <h2 className="panel-title">{t('properties.title')}</h2>
      {readOnly && count > 0 && <p className="panel-hint">{t('properties.readOnly')}</p>}
      {body}
    </section>
  );
}

function SegmentInfo({ segmentId }: { segmentId: string }) {
  const registry = useRegistry();
  const doc = useEditor(docOf);
  const s = doc.segments[segmentId]!;
  const a = vertexPosition(doc, doc.vertices[s.a]!, registry);
  const b = vertexPosition(doc, doc.vertices[s.b]!, registry);
  return (
    <div className="prop-list">
      <div className="prop-static">{t('properties.segment')}</div>
      <div className="prop-static">{a.y === b.y ? t('properties.segmentAxis') : t('properties.segmentAxisV')}</div>
      <div className="prop-static">{t('properties.segmentLength', { length: Math.abs(a.x - b.x) + Math.abs(a.y - b.y) })}</div>
    </div>
  );
}

function AnnotationProps({ id, text, readOnly }: { id: string; text: string; readOnly: boolean }) {
  const store = useEditorStore();
  const focusText = useEditor((s) => s.focusText);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusText > 0) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [focusText, id]);
  return (
    <div className="prop-list">
      <label className="prop">
        <span>{t('properties.text')}</span>
        <textarea
          ref={ref}
          rows={3}
          value={text}
          readOnly={readOnly}
          data-testid="prop-text"
          onChange={(e) => store.getState().updateAnnotation(id, e.target.value)}
        />
      </label>
    </div>
  );
}

function ComponentProps({ component, readOnly, view }: { component: ComponentInstance; readOnly: boolean; view: DeviceView | undefined }) {
  const registry = useRegistry();
  const def = registry.require(component.type);
  return (
    <div className="prop-list" data-component={component.id}>
      <div className="prop-static prop-type">{t(`components.${component.type}` as MessageKey)}</div>
      {def.props.map((spec) => (
        <PropField key={spec.key} component={component} spec={spec} readOnly={readOnly} />
      ))}
      {view && <RuntimeView view={view} />}
    </div>
  );
}

function PropField({ component, spec, readOnly }: { component: ComponentInstance; spec: PropSpec; readOnly: boolean }) {
  const store = useEditorStore();
  const value = component.props[spec.key];
  const update = (v: unknown) => store.getState().updateProps(component.id, { [spec.key]: v });
  const label = t(`properties.${spec.key === 'presetMs' ? 'presetSeconds' : spec.key}` as MessageKey);
  const testId = `prop-${spec.key}`;

  switch (spec.kind) {
    case 'text':
    case 'ref':
      return (
        <label className="prop">
          <span>{label}</span>
          <input type="text" value={String(value ?? '')} readOnly={readOnly} data-testid={testId} onChange={(e) => update(e.target.value)} />
        </label>
      );
    case 'link':
      return <LinkField component={component} label={label} readOnly={readOnly} onChange={update} />;
    case 'boolean':
      return (
        <label className="prop prop-inline">
          <input type="checkbox" checked={value === true} disabled={readOnly} data-testid={testId} onChange={(e) => update(e.target.checked)} />
          <span>{label}</span>
        </label>
      );
    case 'durationMs':
      return <DurationField value={typeof value === 'number' ? value : spec.default} label={label} readOnly={readOnly} onCommit={update} />;
    case 'choice':
      return (
        <label className="prop">
          <span>{label}</span>
          <select value={String(value)} disabled={readOnly} data-testid={testId} onChange={(e) => update(typeof spec.default === 'number' ? Number(e.target.value) : e.target.value)}>
            {spec.options.map((o) => (
              <option key={String(o)} value={String(o)}>
                {spec.key === 'color' ? t(`properties.colors.${o}` as MessageKey) : spec.key === 'initialPosition' ? t(`properties.positions.${o}` as MessageKey) : String(o)}
              </option>
            ))}
          </select>
        </label>
      );
  }
}

function LinkField({ component, label, readOnly, onChange }: { component: ComponentInstance; label: string; readOnly: boolean; onChange: (v: string) => void }) {
  const registry = useRegistry();
  const doc = useEditor(docOf);
  const behavior = registry.require(component.type).behavior;
  const wantTimer = behavior.kind === 'contact' && behavior.linkTo === 'timer';
  const options = useMemo(() => {
    const index = buildRefIndex(doc, registry);
    return [...index.targets.entries()]
      .filter(([, ids]) => ids.some((id) => (registry.require(doc.components[id]!.type).behavior.kind === 'timer') === wantTimer))
      .map(([ref]) => ref)
      .sort();
  }, [doc, registry, wantTimer]);
  const value = typeof component.props.link === 'string' ? component.props.link : '';
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label className="prop">
      <span>{label}</span>
      <select value={value} disabled={readOnly} data-testid="prop-link" onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('properties.linkNone')}</option>
        <optgroup label={wantTimer ? t('properties.linkTimers') : t('properties.linkCoils')}>
          {all.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}

function DurationField({ value, label, readOnly, onCommit }: { value: number; label: string; readOnly: boolean; onCommit: (ms: number) => void }) {
  const [text, setText] = useState(msToSecondsText(value));
  useEffect(() => setText(msToSecondsText(value)), [value]);
  const commit = () => {
    const ms = parseSecondsText(text);
    if (ms === undefined) setText(msToSecondsText(value));
    else onCommit(ms);
  };
  return (
    <label className="prop">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        readOnly={readOnly}
        data-testid="prop-presetMs"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
      <small>{t('properties.presetHint', { min: msToSecondsText(MIN_PRESET_MS), max: msToSecondsText(MAX_PRESET_MS) })}</small>
    </label>
  );
}

function RuntimeView({ view }: { view: DeviceView }) {
  const rows: [string, string][] = [];
  if (view.energized !== undefined && !view.timer) rows.push([t('properties.runtime'), view.energized ? t('properties.energized') : t('properties.deenergized')]);
  if (view.conducting !== undefined) rows.push([t('properties.runtime'), view.conducting ? t('properties.conducting') : t('properties.open')]);
  if (view.actuated !== undefined) rows.push(['', view.actuated ? t('properties.actuated') : t('properties.released')]);
  if (view.position !== undefined) rows.push([t('properties.initialPosition'), t(`properties.positions.${view.position}` as MessageKey)]);
  if (view.timer) {
    const phase = view.timer.phase === 'running' ? 'timerRunning' : view.timer.phase === 'done' ? 'timerDone' : 'timerIdle';
    rows.push([t('properties.timerPhase'), t(`properties.${phase}`)]);
    rows.push([t('properties.elapsed'), formatSeconds(view.timer.elapsedMs)]);
    rows.push([t('properties.remaining'), formatSeconds(view.timer.remainingMs)]);
    rows.push([t('properties.output'), view.timer.output ? t('properties.on') : t('properties.off')]);
  }
  return (
    <div className="runtime" data-testid="runtime">
      {rows.map(([k, v], i) => (
        <div key={i} className="runtime-row">
          <span>{k}</span>
          <strong>{v}</strong>
        </div>
      ))}
      {view.mismatchedSupply && <p className="runtime-note">{t('properties.mismatch')}</p>}
    </div>
  );
}
