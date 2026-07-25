import { z } from "zod"

import { municipalStudyScenarioSchema } from "../spectra/types"
import canonicalJson from "./data/canonical.json"

export const BOGOTA_STUDY_ID = "bogota-microzonation" as const
export const BOGOTA_STUDY_VERSION = "D670-2025/FOPAE-2010-v1" as const

export const bogotaHazardIdSchema = z.enum([
  "design",
  "limited-safety",
  "damage-threshold",
])

export const bogotaFieldIdSchema = z.enum([
  "fa",
  "fv",
  "transition_start",
  "transition_end",
  "long_period",
  "ground_peak",
])

const rowFieldsSchema = z
  .object({
    fa: z.number().finite().positive(),
    fv: z.number().finite().positive(),
    transition_start: z.number().finite().nonnegative(),
    transition_end: z.number().finite().positive(),
    long_period: z.number().finite().positive(),
    ground_peak: z.number().finite().nonnegative(),
  })
  .strict()
  .superRefine((fields, context) => {
    if (fields.transition_start >= fields.transition_end) {
      context.addIssue({
        code: "custom",
        message: "transition_start must be smaller than transition_end",
        path: ["transition_start"],
      })
    }
    if (fields.transition_end >= fields.long_period) {
      context.addIssue({
        code: "custom",
        message: "transition_end must be smaller than long_period",
        path: ["transition_end"],
      })
    }
  })

const optionSchema = z
  .object({
    id: z.string().trim().min(1),
    sourceLabel: z.string().trim().min(1),
  })
  .strict()

const hazardBaseShape = {
  label: z.string().trim().min(1),
  returnPeriodYears: z.number().int().positive(),
  probability: z.string().trim().min(1),
  dampingRatio: z.number().positive().max(1),
  printedPage: z.string().trim().min(1),
  physicalPage: z.number().int().positive(),
  tableReference: z.string().trim().min(1),
  sourceFields: z.array(bogotaFieldIdSchema),
}

const hazardSchema = z.discriminatedUnion("id", [
  z
    .object({
      id: z.literal("design"),
      ...hazardBaseShape,
      baseAccelerations: z
        .object({ Aa: z.number().finite().positive(), Av: z.number().finite().positive() })
        .strict(),
    })
    .strict(),
  z
    .object({
      id: z.literal("limited-safety"),
      ...hazardBaseShape,
      baseAccelerations: z
        .object({ Ae: z.number().finite().positive() })
        .strict(),
    })
    .strict(),
  z
    .object({
      id: z.literal("damage-threshold"),
      ...hazardBaseShape,
      baseAccelerations: z
        .object({ Ad: z.number().finite().positive() })
        .strict(),
    })
    .strict(),
])

const canonicalRowSchema = z
  .object({
    optionId: z.string().trim().min(1),
    hazardId: bogotaHazardIdSchema,
    fields: rowFieldsSchema,
  })
  .strict()

const expectedHazardIds = new Set(bogotaHazardIdSchema.options)
const expectedSourceFields = {
  design: ["fa", "fv", "transition_end", "long_period", "ground_peak"],
  "limited-safety": [
    "fa",
    "fv",
    "transition_end",
    "long_period",
    "ground_peak",
  ],
  "damage-threshold": [
    "fa",
    "fv",
    "transition_start",
    "transition_end",
    "long_period",
    "ground_peak",
  ],
} as const

export const bogotaCanonicalSchema = z
  .object({
    schemaVersion: z.literal(1),
    studyId: z.literal(BOGOTA_STUDY_ID),
    status: z.literal("research-only-not-activated"),
    controllingInstrument: z.literal("decreto-distrital-670-2025"),
    historicalAdoptionInstrument: z.literal("decreto-distrital-523-2010"),
    technicalSource: z.literal("fopae-2010-final-report-v1"),
    fieldSemantics: z
      .object({
        fa: z.string().trim().min(1),
        fv: z.string().trim().min(1),
        transition_start: z.string().trim().min(1),
        transition_end: z.string().trim().min(1),
        long_period: z.string().trim().min(1),
        ground_peak: z.string().trim().min(1),
      })
      .strict(),
    options: z.array(optionSchema).length(16),
    hazards: z.array(hazardSchema).length(3),
    rows: z.array(canonicalRowSchema).length(48),
  })
  .strict()
  .superRefine((data, context) => {
    const optionIds = new Set<string>()
    data.options.forEach((option, index) => {
      if (optionIds.has(option.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate option: ${option.id}`,
          path: ["options", index, "id"],
        })
      }
      optionIds.add(option.id)
    })

    const hazardIds = new Set<string>()
    data.hazards.forEach((hazard, index) => {
      if (hazardIds.has(hazard.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate hazard: ${hazard.id}`,
          path: ["hazards", index, "id"],
        })
      }
      hazardIds.add(hazard.id)
      if (
        JSON.stringify(hazard.sourceFields) !==
        JSON.stringify(expectedSourceFields[hazard.id])
      ) {
        context.addIssue({
          code: "custom",
          message: `Unexpected source fields for ${hazard.id}`,
          path: ["hazards", index, "sourceFields"],
        })
      }
    })
    if (
      hazardIds.size !== expectedHazardIds.size ||
      [...expectedHazardIds].some((id) => !hazardIds.has(id))
    ) {
      context.addIssue({
        code: "custom",
        message: "Canonical hazards must be exactly the three approved R2 hazards",
        path: ["hazards"],
      })
    }

    const expectedRows = new Set(
      [...optionIds].flatMap((optionId) =>
        [...expectedHazardIds].map((hazardId) => `${optionId}/${hazardId}`),
      ),
    )
    const seenRows = new Set<string>()
    data.rows.forEach((row, index) => {
      const key = `${row.optionId}/${row.hazardId}`
      if (!expectedRows.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Unexpected canonical row: ${key}`,
          path: ["rows", index],
        })
      }
      if (seenRows.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate canonical row: ${key}`,
          path: ["rows", index],
        })
      }
      seenRows.add(key)
      if (
        row.hazardId !== "damage-threshold" &&
        row.fields.transition_start !== 0
      ) {
        context.addIssue({
          code: "custom",
          message: `${row.hazardId} must use the approved graphical T=0 origin`,
          path: ["rows", index, "fields", "transition_start"],
        })
      }
    })
    for (const key of expectedRows) {
      if (!seenRows.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Missing canonical row: ${key}`,
          path: ["rows"],
        })
      }
    }
  })

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

export const bogotaCanonical = deepFreeze(
  bogotaCanonicalSchema.parse(canonicalJson),
)

const canonicalOptionIds = new Set(bogotaCanonical.options.map(({ id }) => id))
export const bogotaZoneIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine((id) => canonicalOptionIds.has(id), "Unknown Bogotá response zone")

export const bogotaNormalizedInputsSchema = z
  .object({
    zoneId: bogotaZoneIdSchema,
    hazardId: bogotaHazardIdSchema,
    importanceFactor: z.number().finite().positive(),
    fillThicknessMeters: z.number().finite().nonnegative().nullable(),
    rigidBasePeriodSeconds: z.number().finite().nonnegative().nullable(),
  })
  .strict()

export const bogotaComputationInputSchema = bogotaNormalizedInputsSchema.extend({
  importanceFactor: z.number().finite().positive().default(1),
  fillThicknessMeters: z.number().finite().nonnegative().nullable().default(null),
  rigidBasePeriodSeconds: z.number().finite().nonnegative().nullable().default(null),
})

export const bogotaScenarioSchema = municipalStudyScenarioSchema.pipe(
  z
    .object({
      type: z.literal("municipal-study"),
      studyId: z.literal(BOGOTA_STUDY_ID),
      studyVersion: z.literal(BOGOTA_STUDY_VERSION),
      inputs: bogotaNormalizedInputsSchema,
    })
    .strict(),
)

export type BogotaHazardId = z.infer<typeof bogotaHazardIdSchema>
export type BogotaFieldId = z.infer<typeof bogotaFieldIdSchema>
export type BogotaCanonical = z.infer<typeof bogotaCanonicalSchema>
export type BogotaCanonicalRow = BogotaCanonical["rows"][number]
export type BogotaHazard = BogotaCanonical["hazards"][number]
export type BogotaNormalizedInputs = z.infer<typeof bogotaNormalizedInputsSchema>
export type BogotaComputationInput = z.input<typeof bogotaComputationInputSchema>
export type BogotaScenario = z.infer<typeof bogotaScenarioSchema>
