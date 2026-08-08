import { z } from "zod"

import canonicalJson from "./data/canonical.json"

export const MANIZALES_STUDY_ID = "manizales-microzonation" as const
export const MANIZALES_STUDY_VERSION = "uniandes-2002-figura-8.5" as const

export const manizalesZoneIdSchema = z.enum(["zone-a", "zone-b", "zone-c"])

export const manizalesComputationInputSchema = z
  .object({
    zoneId: manizalesZoneIdSchema,
    hazardId: z.literal("design"),
    importanceFactor: z.number().finite().positive(),
  })
  .strict()

export const manizalesScenarioSchema = z
  .object({
    type: z.literal("municipal-study"),
    studyId: z.literal(MANIZALES_STUDY_ID),
    studyVersion: z.literal(MANIZALES_STUDY_VERSION),
    inputs: manizalesComputationInputSchema,
  })
  .strict()

const fieldsSchema = z
  .object({
    to: z.number().finite().positive(),
    tc: z.number().finite().positive(),
    tl: z.number().finite().positive(),
    am: z.number().finite().positive(),
    an: z.number().finite().positive(),
    fa: z.number().finite().positive(),
    fv: z.number().finite().positive(),
  })
  .strict()

const canonicalSchema = z
  .object({
    rows: z.array(
      z
        .object({
          optionId: manizalesZoneIdSchema,
          hazardId: z.literal("design"),
          fields: fieldsSchema,
        })
        .strict(),
    ),
    presentation: z
      .object({
        spectraPresentedThroughSeconds: z.number().finite().positive(),
        specialSeismicAnalysisRequiredAtOrAboveSeconds: z.number().finite().positive(),
        sampledThroughSeconds: z.number().finite().positive(),
      })
      .passthrough(),
  })
  .passthrough()

const canonical = canonicalSchema.parse(canonicalJson)

export const manizalesRows = Object.freeze(canonical.rows)
export const manizalesPresentation = Object.freeze(canonical.presentation)

export function findManizalesRow(zoneId: string) {
  return manizalesRows.find(({ optionId }) => optionId === zoneId) ?? null
}

export type ManizalesZoneId = z.infer<typeof manizalesZoneIdSchema>
export type ManizalesComputationInput = z.infer<typeof manizalesComputationInputSchema>
export type ManizalesScenario = z.infer<typeof manizalesScenarioSchema>
export type ManizalesRow = (typeof manizalesRows)[number]
