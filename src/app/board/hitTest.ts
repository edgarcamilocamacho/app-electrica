/**
 * Qué hay bajo el cursor, en coordenadas de mundo. Prioridades (R2 §5, R3 Q3.6, adaptadas al
 * tablero): borne → cable → texto → aparato. El borne va primero porque es donde se cablea.
 */
import type { BoardDocument, TerminalRef } from '../../core/board/model';
import { deviceRect, terminalPosition, wiresBottomToTop } from '../../core/board/model';
import type { DeviceRegistry } from '../../core/board/registry';
import { routeSegments, wireRoute } from '../../core/board/wireGeometry';
import { distanceToSegment, rectContains } from '../../core/model/geometry';
import type { Id, Point } from '../../core/model/types';

export type BoardHit =
  | { readonly kind: 'terminal'; readonly ref: TerminalRef; readonly position: Point }
  | { readonly kind: 'wire'; readonly id: Id; readonly segmentIndex: number }
  | { readonly kind: 'annotation'; readonly id: Id }
  | { readonly kind: 'device'; readonly id: Id }
  | { readonly kind: 'empty' };

/** Radio de agarre de un tornillo, en unidades de grid. */
export const TERMINAL_GRAB = 1.4;
export const WIRE_GRAB = 0.7;
export const ANNOTATION_HEIGHT = 1.4;

export function hitTest(doc: BoardDocument, registry: DeviceRegistry, at: Point): BoardHit {
  let closestTerminal: { ref: TerminalRef; position: Point; d: number } | undefined;
  for (const device of Object.values(doc.devices)) {
    const def = registry.get(device.type);
    if (!def) continue;
    for (const terminal of def.terminals) {
      const position = terminalPosition(doc, registry, { deviceId: device.id, terminalId: terminal.id });
      const d = Math.hypot(position.x - at.x, position.y - at.y);
      if (d <= TERMINAL_GRAB && (!closestTerminal || d < closestTerminal.d)) {
        closestTerminal = { ref: { deviceId: device.id, terminalId: terminal.id }, position, d };
      }
    }
  }
  if (closestTerminal) return { kind: 'terminal', ref: closestTerminal.ref, position: closestTerminal.position };

  // En el mismo orden en que se dibujan: ante un empate (cables superpuestos) gana el de arriba,
  // que es el más grueso [R7 §1].
  let closestWire: { id: Id; segmentIndex: number; d: number } | undefined;
  for (const wire of wiresBottomToTop(doc)) {
    const segments = routeSegments(wireRoute(doc, registry, wire));
    segments.forEach((segment, index) => {
      const d = distanceToSegment(at, segment[0], segment[1]);
      const better = !closestWire || d < closestWire.d || (d === closestWire.d && closestWire.id !== wire.id);
      if (d <= WIRE_GRAB && better) {
        closestWire = { id: wire.id, segmentIndex: index, d };
      }
    });
  }
  if (closestWire) return { kind: 'wire', id: closestWire.id, segmentIndex: closestWire.segmentIndex };

  for (const note of Object.values(doc.annotations)) {
    const width = Math.max(2, note.text.length * 0.55);
    if (
      at.x >= note.position.x - 0.3 &&
      at.x <= note.position.x + width &&
      at.y >= note.position.y - ANNOTATION_HEIGHT &&
      at.y <= note.position.y + 0.4
    ) {
      return { kind: 'annotation', id: note.id };
    }
  }

  for (const device of Object.values(doc.devices)) {
    const def = registry.get(device.type);
    if (!def) continue;
    if (rectContains(deviceRect(device, def), at)) return { kind: 'device', id: device.id };
  }

  return { kind: 'empty' };
}

/** Objetos dentro de un rectángulo de selección. */
export function objectsInRect(
  doc: BoardDocument,
  registry: DeviceRegistry,
  a: Point,
  b: Point,
): { devices: Id[]; wires: Id[]; annotations: Id[] } {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const inside = (p: Point): boolean => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;

  const devices: Id[] = [];
  for (const device of Object.values(doc.devices)) {
    const def = registry.get(device.type);
    if (!def) continue;
    const rect = deviceRect(device, def);
    if (rect.minX >= minX && rect.maxX <= maxX && rect.minY >= minY && rect.maxY <= maxY) devices.push(device.id);
  }
  const wires: Id[] = [];
  for (const wire of Object.values(doc.wires)) {
    if (wireRoute(doc, registry, wire).every(inside)) wires.push(wire.id);
  }
  const annotations: Id[] = [];
  for (const note of Object.values(doc.annotations)) if (inside(note.position)) annotations.push(note.id);
  return { devices, wires, annotations };
}
