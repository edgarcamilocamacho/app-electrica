import { describe, expect, it } from 'vitest';
import { boardRegistry } from '../../../src/core/board/catalog';
import { parseBoard, serializeBoard } from '../../../src/core/board/persistence';
import { BoardBuilder, term } from '../../fixtures/board';

const sample = () => {
  const b = new BoardBuilder();
  const g = b.device('supply-1p', 0, 0, { ref: 'G1' });
  const h = b.device('pilot-lamp', 0, 40, { ref: 'H1' });
  b.wire(term(g, 'L'), term(h, 'X1'), { color: 'brown', gauge: 2 });
  b.wire(term(g, 'N'), term(h, 'X2'), { color: 'blue', gauge: 2 });
  return b.doc;
};

describe('archivo del tablero (esquema v2)', () => {
  it('serializa y vuelve a cargar el mismo documento', () => {
    const doc = sample();
    const result = parseBoard(serializeBoard(doc), boardRegistry);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc).toEqual(doc);
  });

  it('el JSON sale ordenado y estable', () => {
    const text = serializeBoard(sample());
    expect(text).toBe(serializeBoard(sample()));
    expect(text.startsWith('{\n  "schemaVersion": 2')).toBe(true);
  });

  it('rechaza un archivo de la versión clásica [R5 §15]', () => {
    const classic = JSON.stringify({ schemaVersion: 1, metadata: {}, components: {}, vertices: {}, segments: {} });
    const result = parseBoard(classic, boardRegistry);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLASSIC_FILE');
  });

  it('rechaza un tipo desconocido y un borne inexistente', () => {
    const doc = sample();
    const withUnknownType = serializeBoard(doc).replace('"supply-1p"', '"motor-3f"');
    const r1 = parseBoard(withUnknownType, boardRegistry);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error.code).toBe('UNKNOWN_TYPE');

    const withBadTerminal = serializeBoard(doc).replace('"terminalId": "X1"', '"terminalId": "X9"');
    const r2 = parseBoard(withBadTerminal, boardRegistry);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.code).toBe('UNKNOWN_TERMINAL');
  });

  it('rechaza JSON inválido y objetos sin versión', () => {
    expect(parseBoard('{', boardRegistry).ok).toBe(false);
    const noVersion = parseBoard('{"metadata":{}}', boardRegistry);
    expect(noVersion.ok).toBe(false);
    if (!noVersion.ok) expect(noVersion.error.code).toBe('NO_VERSION');
  });
});
