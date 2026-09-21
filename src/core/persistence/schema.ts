import { z } from 'zod';

/**
 * Esquema del archivo JSON (PLAN §14.1). En el archivo, las entidades se indexan por id y el id
 * no se repite dentro de cada objeto; al cargar se reconstruye.
 */

const IntPoint = z.object({ x: z.number().int(), y: z.number().int() }).strict();

const FileComponent = z
  .object({
    type: z.string().min(1),
    position: IntPoint,
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    props: z.record(z.string(), z.unknown()),
  })
  .strict();

const FileVertex = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('point'), position: IntPoint }).strict(),
  z.object({ kind: z.literal('terminal'), componentId: z.string().min(1), terminalId: z.string().min(1) }).strict(),
]);

const FileSegment = z.object({ a: z.string().min(1), b: z.string().min(1) }).strict();

const FileAnnotation = z.object({ position: IntPoint, text: z.string() }).strict();

export const FileDocumentV1 = z
  .object({
    schemaVersion: z.literal(1),
    metadata: z
      .object({
        name: z.string(),
        createdAt: z.string(),
        modifiedAt: z.string(),
      })
      .strict(),
    components: z.record(z.string(), FileComponent),
    vertices: z.record(z.string(), FileVertex),
    segments: z.record(z.string(), FileSegment),
    annotations: z.record(z.string(), FileAnnotation).default({}),
    view: z
      .object({
        pan: z.object({ x: z.number(), y: z.number() }).strict(),
        zoom: z.number().positive(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type FileDocument = z.infer<typeof FileDocumentV1>;
