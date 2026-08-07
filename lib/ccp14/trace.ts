import { z } from "zod"

import { spectrumUnitSchema } from "../spectra/types"

import { CCP14_TRACE_SCHEMA_ID, CCP14_TRACE_SCHEMA_VERSION } from "./constants"

const idSchema = z.string().trim().min(1)

const ccp14TraceStepSchema = z
  .object({
    id: idSchema,
    classification: z.enum(["user-input", "derived"]),
    label: idSchema,
    value: z.union([z.number().finite(), z.string(), z.boolean()]),
    unit: spectrumUnitSchema.or(z.enum(["class", "choice"])),
    dependencies: z.array(idSchema),
    citationIds: z.array(idSchema),
    expression: idSchema.optional(),
    substitution: idSchema.optional(),
  })
  .strict()

const ccp14TracePayloadSchema = z
  .object({
    schemaVersion: z.literal(CCP14_TRACE_SCHEMA_VERSION),
    context: z.record(z.string(), z.unknown()),
    steps: z.array(ccp14TraceStepSchema),
    branches: z.array(
      z.object({ id: idSchema, formulaId: idSchema }).strict(),
    ),
  })
  .strict()

export const ccp14TraceEnvelopeSchema = z
  .object({
    schemaId: z.literal(CCP14_TRACE_SCHEMA_ID),
    schemaVersion: z.literal(CCP14_TRACE_SCHEMA_VERSION),
    data: ccp14TracePayloadSchema,
  })
  .strict()

export type Ccp14TraceStep = z.infer<typeof ccp14TraceStepSchema>
export type Ccp14TracePayload = z.infer<typeof ccp14TracePayloadSchema>

export function parseCcp14TraceEnvelope(trace: unknown): Ccp14TracePayload {
  return ccp14TraceEnvelopeSchema.parse(trace).data
}
