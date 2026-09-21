import type { OpContext } from '../../model/document';
import type { CircuitDocument, Id } from '../../model/types';
import { canonicalizeGraph } from '../canonicalize';
import type { WorkGraph } from '../graph';
import { introducedViolations, type Violation } from '../validity';

/**
 * Resultado de toda operación de edición. `doc` siempre viene, aunque la operación sea inválida:
 * la UI lo usa como vista previa en rojo (PLAN §5.1). Solo se confirma si `ok`.
 */
export interface EditResult {
  readonly doc: CircuitDocument;
  readonly ok: boolean;
  /** Ambigüedades que la operación agregaría. */
  readonly violations: readonly Violation[];
  /** Segmentos para los que no hubo ruta sin ambigüedad. */
  readonly failedSegments: readonly Id[];
  readonly reason?: EditFailureReason;
}

export type EditFailureReason = 'AMBIGUOUS' | 'NO_ROUTE' | 'NOT_FOUND' | 'INVALID_INPUT';

export function finalizeEdit(
  before: CircuitDocument,
  g: WorkGraph,
  ctx: OpContext,
  failedSegments: readonly Id[] = [],
): EditResult {
  canonicalizeGraph(g, ctx);
  const doc = g.toDocument();
  const violations = introducedViolations(before, doc, ctx.registry);
  const ok = violations.length === 0 && failedSegments.length === 0;
  return {
    doc,
    ok,
    violations,
    failedSegments,
    ...(ok ? {} : { reason: failedSegments.length > 0 ? 'NO_ROUTE' : 'AMBIGUOUS' }),
  };
}

export function rejected(doc: CircuitDocument, reason: EditFailureReason): EditResult {
  return { doc, ok: false, violations: [], failedSegments: [], reason };
}
