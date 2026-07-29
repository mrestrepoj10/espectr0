import { z } from "zod"

import canonicalJson from "./data/canonical.json"

export const DOSQUEBRADAS_STUDY_ID = "dosquebradas-microzonation" as const
export const DOSQUEBRADAS_STUDY_VERSION = "pot-2024-table-27+nsr10-2017" as const

export const dosquebradasZoneIdSchema = z.enum([
  "zona-1",
  "zona-2",
  "zona-3",
  "zona-4",
  "zona-5",
])

export const dosquebradasComputationInputSchema = z
  .object({
    zoneId: dosquebradasZoneIdSchema,
    hazardId: z.literal("design"),
    importanceFactor: z.number().finite().positive(),
  })
  .strict()

export const dosquebradasScenarioSchema = z
  .object({
    type: z.literal("municipal-study"),
    studyId: z.literal(DOSQUEBRADAS_STUDY_ID),
    studyVersion: z.literal(DOSQUEBRADAS_STUDY_VERSION),
    inputs: dosquebradasComputationInputSchema,
  })
  .strict()

const fieldsSchema = z
  .object({
    to: z.number().finite().positive(),
    tc: z.number().finite().positive(),
    tl: z.number().finite().positive(),
    aa: z.number().finite().positive(),
    fa: z.number().finite().positive(),
    fv: z.number().finite().positive(),
  })
  .strict()

const canonicalSchema = z
  .object({
    rows: z.array(
      z
        .object({
          optionId: dosquebradasZoneIdSchema,
          hazardId: z.literal("design"),
          fields: fieldsSchema,
        })
        .strict(),
    ),
  })
  .passthrough()

const canonical = canonicalSchema.parse(canonicalJson)

export const dosquebradasRows = Object.freeze(canonical.rows)

export function findDosquebradasRow(zoneId: string) {
  return dosquebradasRows.find(({ optionId }) => optionId === zoneId) ?? null
}

export type DosquebradasZoneId = z.infer<typeof dosquebradasZoneIdSchema>
export type DosquebradasComputationInput = z.infer<
  typeof dosquebradasComputationInputSchema
>
export type DosquebradasScenario = z.infer<typeof dosquebradasScenarioSchema>
export type DosquebradasRow = (typeof dosquebradasRows)[number]
