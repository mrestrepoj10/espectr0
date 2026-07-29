import { z } from "zod"

import canonicalJson from "./data/canonical.json"

export const MEDELLIN_STUDY_ID = "medellin-microzonation" as const
export const MEDELLIN_STUDY_VERSION = "dap-2011-historical-technical-table" as const

export const medellinZoneIdSchema = z.enum([
  "zone-01",
  "zone-02",
  "zone-03",
  "zone-04",
  "zone-05",
  "zone-06",
  "zone-07",
  "zone-08",
  "zone-09",
  "zone-10",
  "zone-11",
  "zone-12",
  "zone-13",
  "zone-14",
])

export const medellinHazardIdSchema = z.enum(["design", "damage-control"])

export const medellinComputationInputSchema = z
  .object({
    zoneId: medellinZoneIdSchema,
    hazardId: medellinHazardIdSchema,
    importanceFactor: z.number().finite().positive(),
  })
  .strict()

export const medellinScenarioSchema = z
  .object({
    type: z.literal("municipal-study"),
    studyId: z.literal(MEDELLIN_STUDY_ID),
    studyVersion: z.literal(MEDELLIN_STUDY_VERSION),
    inputs: medellinComputationInputSchema,
  })
  .strict()

const fieldsSchema = z
  .object({
    ground_peak: z.number().finite().positive(),
    short_amplification: z.number().finite().positive(),
    plateau_per_importance: z.number().finite().positive(),
    plateau_start: z.number().finite().positive(),
    decay_start: z.number().finite().positive(),
    decay_exponent: z.number().finite().positive(),
  })
  .strict()

const canonicalSchema = z
  .object({
    options: z.array(
      z
        .object({
          id: medellinZoneIdSchema,
          sourceLabel: z.string().min(1),
          description: z.string().min(1),
        })
        .strict(),
    ),
    hazards: z.array(
      z
        .object({
          id: medellinHazardIdSchema,
          label: z.string().min(1),
          dampingRatio: z.number().positive().max(1),
          returnPeriodYears: z.null(),
        })
        .strict(),
    ),
    rows: z.array(
      z
        .object({
          optionId: medellinZoneIdSchema,
          hazardId: medellinHazardIdSchema,
          fields: fieldsSchema,
        })
        .strict(),
    ),
  })
  .passthrough()

const canonical = canonicalSchema.parse(canonicalJson)

export const medellinOptions = Object.freeze(canonical.options)
export const medellinHazards = Object.freeze(canonical.hazards)
export const medellinRows = Object.freeze(canonical.rows)

export function findMedellinRow(zoneId: string, hazardId: string) {
  return (
    medellinRows.find(
      (row) => row.optionId === zoneId && row.hazardId === hazardId,
    ) ?? null
  )
}

export function findMedellinHazard(hazardId: string) {
  return medellinHazards.find(({ id }) => id === hazardId) ?? null
}

export type MedellinZoneId = z.infer<typeof medellinZoneIdSchema>
export type MedellinHazardId = z.infer<typeof medellinHazardIdSchema>
export type MedellinComputationInput = z.infer<
  typeof medellinComputationInputSchema
>
export type MedellinScenario = z.infer<typeof medellinScenarioSchema>
export type MedellinRow = (typeof medellinRows)[number]
