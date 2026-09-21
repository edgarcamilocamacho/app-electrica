import { memo, useMemo } from 'react';
import { computeNets } from '../../core/connectivity/nets';
import { buildRefIndex } from '../../core/connectivity/refs';
import { componentBounds, vertexPosition } from '../../core/model/document';
import type { Selection } from '../../core/model/selection';
import type { CircuitDocument, Id, Point } from '../../core/model/types';
import type { Registry } from '../../core/registry/types';
import type { NetPotential, SimSnapshot } from '../../core/sim/engine';
import type { VertexClass } from '../../core/topology/classify';
import { formatSeconds } from '../i18n/format';
import { ANNOTATION_FONT } from '../input/hitTest';
import { SYMBOLS } from '../symbols/Symbols';
import { COLORS, FONT_FAMILY, LABEL_FONT, SMALL_FONT, STROKE, WIRE_STROKE } from '../theme';

export interface Marker {
  readonly at: Point;
  readonly segmentIds: readonly Id[];
}

export interface DiagramProps {
  readonly doc: CircuitDocument;
  readonly registry: Registry;
  readonly classes: ReadonlyMap<Id, VertexClass>;
  readonly sim?: SimSnapshot | null;
  readonly selection?: Selection;
  /** Componentes que se están colocando o moviendo. */
  readonly active?: readonly Id[];
  /** La vista previa es inválida: lo activo y lo conflictivo se dibujan en rojo. */
  readonly invalid?: boolean;
  readonly markers?: readonly Marker[];
  /** Componentes involucrados en una falla de simulación. */
  readonly fault?: readonly Id[];
  /** Exportación: sin selección ni marcas de edición (R3 Q3.7). */
  readonly exportMode?: boolean;
}

function potentialColor(p: NetPotential | undefined, sourceIndex: ReadonlyMap<Id, number>): string {
  if (!p) return COLORS.wire;
  switch (p.kind) {
    case 'short':
      return COLORS.short;
    case 'line':
      return COLORS.line[(sourceIndex.get(p.sources[0] ?? '') ?? 0) % COLORS.line.length]!;
    case 'neutral':
      return COLORS.neutral;
    case 'floating':
      return COLORS.floating;
  }
}

export const Diagram = memo(function Diagram(props: DiagramProps) {
  const { doc, registry, classes, sim, selection, active = [], invalid = false, markers = [], fault = [], exportMode = false } = props;

  const nets = useMemo(() => computeNets(doc), [doc]);
  const refIndex = useMemo(() => buildRefIndex(doc, registry), [doc, registry]);
  const sourceIndex = useMemo(() => {
    const sources = Object.values(doc.components)
      .filter((c) => c.type === 'ac-source')
      .map((c) => c.id)
      .sort();
    return new Map(sources.map((id, i) => [id, i]));
  }, [doc]);

  const pos = (vid: Id) => vertexPosition(doc, doc.vertices[vid]!, registry);
  const selectedSegments = new Set(exportMode ? [] : (selection?.segments ?? []));
  const selectedComponents = new Set(exportMode ? [] : (selection?.components ?? []));
  const selectedAnnotations = new Set(exportMode ? [] : (selection?.annotations ?? []));
  const activeSet = new Set(active);
  const faultSet = new Set(fault);
  const conflictSegments = new Set(markers.flatMap((m) => m.segmentIds));

  const wireColor = (segmentId: Id): string => {
    if (invalid && conflictSegments.has(segmentId)) return COLORS.invalid;
    if (!sim) return COLORS.wire;
    const net = nets.netOfSegment.get(segmentId);
    return potentialColor(net ? sim.netPotentials.get(net) : undefined, sourceIndex);
  };

  const segments = Object.values(doc.segments).filter((s) => doc.vertices[s.a] && doc.vertices[s.b]);

  return (
    <g data-testid="diagram">
      {/* Resaltado de selección debajo de los cables */}
      {segments
        .filter((s) => selectedSegments.has(s.id))
        .map((s) => {
          const a = pos(s.a);
          const b = pos(s.b);
          return <line key={`h-${s.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={COLORS.selectionHalo} strokeWidth={0.8} strokeLinecap="round" />;
        })}

      {/* Cables */}
      {segments.map((s) => {
        const a = pos(s.a);
        const b = pos(s.b);
        const color = wireColor(s.id);
        const short = color === COLORS.short;
        return (
          <line
            key={s.id}
            data-segment-id={s.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={selectedSegments.has(s.id) ? COLORS.selection : color}
            strokeWidth={short ? WIRE_STROKE * 2.4 : WIRE_STROKE}
            strokeLinecap="round"
            {...(short && !exportMode ? { className: 'wire-short' } : {})}
          />
        );
      })}

      {/* Marcas topológicas: junction ● y extremo libre ○ */}
      {Object.values(doc.vertices).map((v) => {
        const cls = classes.get(v.id);
        if (cls !== 'junction' && cls !== 'free-end') return null;
        const p = pos(v.id);
        const seg = segments.find((s) => s.a === v.id || s.b === v.id);
        const color = seg ? wireColor(seg.id) : COLORS.wire;
        return cls === 'junction' ? (
          <circle key={v.id} data-vertex-class="junction" cx={p.x} cy={p.y} r={0.34} fill={color} />
        ) : (
          <circle key={v.id} data-vertex-class="free-end" cx={p.x} cy={p.y} r={0.3} fill={COLORS.paper} stroke={color} strokeWidth={STROKE} />
        );
      })}

      {/* Componentes */}
      {Object.values(doc.components).map((c) => {
        const Symbol = SYMBOLS[c.type];
        if (!Symbol) return null;
        const view = sim?.devices.get(c.id);
        const isActive = activeSet.has(c.id);
        const color = faultSet.has(c.id)
          ? COLORS.short
          : isActive && invalid
            ? COLORS.invalid
            : selectedComponents.has(c.id) || isActive
              ? COLORS.selection
              : COLORS.ink;
        const b = componentBounds(c, registry);
        const ref = typeof c.props.ref === 'string' ? c.props.ref : '';
        const label = typeof c.props.label === 'string' ? c.props.label : '';
        let linkedTimer: 'TON' | 'TOF' | undefined;
        const behavior = registry.get(c.type)?.behavior;
        if (behavior?.kind === 'contact' && behavior.linkTo === 'timer') {
          const r = refIndex.resolve(c.id);
          if (r.status === 'ok') linkedTimer = doc.components[r.targetId]?.type === 'timer-tof' ? 'TOF' : 'TON';
        }
        const timer = view?.timer;
        return (
          <g
            key={c.id}
            data-component-id={c.id}
            data-ref={ref}
            data-type={c.type}
            {...(view?.energized !== undefined ? { 'data-energized': String(view.energized) } : {})}
            {...(view?.conducting !== undefined ? { 'data-conducting': String(view.conducting) } : {})}
          >
            {(selectedComponents.has(c.id) || (isActive && !exportMode)) && (
              <rect
                x={b.minX - 0.35}
                y={b.minY - 0.35}
                width={b.maxX - b.minX + 0.7}
                height={b.maxY - b.minY + 0.7}
                rx={0.4}
                fill={isActive && invalid ? COLORS.invalidHalo : COLORS.selectionHalo}
              />
            )}
            <g transform={`translate(${c.position.x} ${c.position.y}) rotate(${c.rotation})`}>
              <Symbol props={c.props} view={view} color={color} linkedTimer={linkedTimer} />
            </g>
            {ref && (
              <text x={b.maxX + 0.5} y={(b.minY + b.maxY) / 2 - (label ? 0.2 : -0.35)} fontSize={LABEL_FONT} fontFamily={FONT_FAMILY} fontWeight={600} fill={color}>
                {ref}
              </text>
            )}
            {label && (
              <text x={b.maxX + 0.5} y={(b.minY + b.maxY) / 2 + 0.9} fontSize={SMALL_FONT} fontFamily={FONT_FAMILY} fill={COLORS.inkMuted}>
                {label}
              </text>
            )}
            {timer && (
              <text
                data-timer-label
                x={b.maxX + 0.5}
                y={(b.minY + b.maxY) / 2 + (label ? 1.9 : 1.3)}
                fontSize={SMALL_FONT}
                fontFamily={FONT_FAMILY}
                fill={timer.phase === 'running' ? COLORS.line[0] : COLORS.inkMuted}
              >
                {`${formatSeconds(timer.elapsedMs)} / ${formatSeconds(timer.presetMs)}`}
              </text>
            )}
          </g>
        );
      })}

      {/* Anotaciones */}
      {Object.values(doc.annotations).map((n) => (
        <text
          key={n.id}
          data-annotation-id={n.id}
          x={n.position.x}
          y={n.position.y}
          fontSize={ANNOTATION_FONT}
          fontFamily={FONT_FAMILY}
          fill={selectedAnnotations.has(n.id) ? COLORS.selection : COLORS.ink}
        >
          {n.text.split('\n').map((line, i) => (
            <tspan key={i} x={n.position.x} dy={i === 0 ? 0 : ANNOTATION_FONT * 1.25}>
              {line}
            </tspan>
          ))}
        </text>
      ))}

      {/* Marcas de ambigüedad */}
      {!exportMode &&
        markers.map((m, i) => (
          <circle key={`m-${i}`} data-marker cx={m.at.x} cy={m.at.y} r={0.9} fill={COLORS.invalidHalo} stroke={COLORS.invalid} strokeWidth={STROKE} />
        ))}
    </g>
  );
});
