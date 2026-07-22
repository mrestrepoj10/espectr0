import { z } from "zod"

import { spectrumCapabilitiesSchema } from "./capabilities"

export const SPECTRUM_CONTRACT_SCHEMA_VERSION = 1 as const
export const SPECTRUM_EXPORT_SCHEMA_VERSION = 1 as const

export const spectrumScenarioTypeSchema = z.enum([
  "nsr10-national",
  "ccp14",
  "municipal-study",
])

export const normalizedInputValueSchema: z.ZodType<NormalizedInputValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(normalizedInputValueSchema),
    z.record(z.string(), normalizedInputValueSchema),
  ]),
)

export const normalizedInputsSchema = z.record(
  z.string(),
  normalizedInputValueSchema,
)

const scenarioBaseShape = {
  studyVersion: z.string().trim().min(1),
  inputs: normalizedInputsSchema,
}

export const nsr10NationalScenarioSchema = z
  .object({
    type: z.literal("nsr10-national"),
    studyId: z.literal("nsr10-national"),
    ...scenarioBaseShape,
  })
  .strict()

export const ccp14ScenarioSchema = z
  .object({
    type: z.literal("ccp14"),
    studyId: z.literal("ccp14"),
    ...scenarioBaseShape,
  })
  .strict()

export const municipalStudyScenarioSchema = z
  .object({
    type: z.literal("municipal-study"),
    studyId: z.string().trim().min(1),
    ...scenarioBaseShape,
  })
  .strict()

export const spectrumScenarioSchema = z.discriminatedUnion("type", [
  nsr10NationalScenarioSchema,
  ccp14ScenarioSchema,
  municipalStudyScenarioSchema,
])

export const spectrumUnitSchema = z.enum([
  "g",
  "s",
  "years",
  "ratio",
  "dimensionless",
])

export const spectrumMetricSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    value: z.number().finite(),
    unit: spectrumUnitSchema,
    formulaId: z.string().trim().min(1).nullable(),
    citationIds: z.array(z.string().trim().min(1)),
  })
  .strict()

export const normalizedSpectrumPointSchema = z
  .object({
    tSeconds: z.number().finite().nonnegative(),
    saG: z.number().finite().nonnegative(),
    branchId: z.string().trim().min(1),
    formulaId: z.string().trim().min(1),
    citationIds: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()

export const spectrumBranchMetadataSchema = z
  .object({
    id: z.string().trim().min(1),
    formulaId: z.string().trim().min(1),
    citationIds: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()

export const spectrumWarningSchema = z
  .object({
    severity: z.enum(["info", "warning", "error"]),
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    citationIds: z.array(z.string().trim().min(1)),
  })
  .strict()

export const applicabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("applicable") }).strict(),
  z
    .object({
      status: z.enum([
        "site-specific-study-required",
        "unsupported",
        "not-applicable",
      ]),
      reasonCode: z.string().trim().min(1),
      message: z.string().trim().min(1),
      citationIds: z.array(z.string().trim().min(1)),
    })
    .strict(),
])

export const normalizedSpectrumOrdinateSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ok"),
      point: normalizedSpectrumPointSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("unavailable"),
      applicability: applicabilitySchema,
    })
    .strict(),
])

export const normalizedSpectrumResultDataSchema = z
  .object({
    schemaVersion: z.literal(SPECTRUM_CONTRACT_SCHEMA_VERSION),
    status: z.enum(["ok", "site-specific-study-required"]),
    engine: z
      .object({
        id: z.string().trim().min(1),
        version: z.string().trim().min(1),
      })
      .strict(),
    study: z
      .object({
        id: z.string().trim().min(1),
        version: z.string().trim().min(1),
      })
      .strict(),
    scenarioType: spectrumScenarioTypeSchema,
    normalizedInputs: normalizedInputsSchema,
    points: z.array(normalizedSpectrumPointSchema),
    metrics: z.array(spectrumMetricSchema),
    formulaIds: z.array(z.string().trim().min(1)),
    branches: z.array(spectrumBranchMetadataSchema),
    hazard: z
      .object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
        returnPeriodYears: z.number().int().positive(),
        dampingRatio: z.number().positive().max(1),
      })
      .strict(),
    warnings: z.array(spectrumWarningSchema),
    applicability: applicabilitySchema,
    sourceIds: z.array(z.string().trim().min(1)).min(1),
    citationIds: z.array(z.string().trim().min(1)).min(1),
    traceSchemaVersion: z.number().int().positive(),
    trace: normalizedInputValueSchema.nullable(),
    capabilities: spectrumCapabilitiesSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.status === "ok" && result.applicability.status !== "applicable") {
      context.addIssue({
        code: "custom",
        message: "Successful spectra must be applicable",
        path: ["applicability"],
      })
    }
    if (result.status === "site-specific-study-required") {
      if (result.applicability.status !== "site-specific-study-required") {
        context.addIssue({
          code: "custom",
          message: "Site-specific results require matching applicability metadata",
          path: ["applicability"],
        })
      }
      if (result.points.length > 0) {
        context.addIssue({
          code: "custom",
          message: "Unavailable site-specific spectra cannot expose sampled points",
          path: ["points"],
        })
      }
    }
  })

export const spectrumExportSchema = z
  .object({
    schemaVersion: z.literal(SPECTRUM_EXPORT_SCHEMA_VERSION),
    result: normalizedSpectrumResultDataSchema,
  })
  .strict()

export type NormalizedInputValue =
  | string
  | number
  | boolean
  | null
  | NormalizedInputValue[]
  | { [key: string]: NormalizedInputValue }
export type NormalizedInputs = Record<string, NormalizedInputValue>
export type SpectrumScenarioType = z.infer<typeof spectrumScenarioTypeSchema>
export type Nsr10NationalScenario = z.infer<typeof nsr10NationalScenarioSchema>
export type Ccp14Scenario = z.infer<typeof ccp14ScenarioSchema>
export type MunicipalStudyScenario = z.infer<typeof municipalStudyScenarioSchema>
export type SpectrumScenario = z.infer<typeof spectrumScenarioSchema>
export type SpectrumUnit = z.infer<typeof spectrumUnitSchema>
export type SpectrumMetric = z.infer<typeof spectrumMetricSchema>
export type NormalizedSpectrumPoint = z.infer<typeof normalizedSpectrumPointSchema>
export type SpectrumBranchMetadata = z.infer<typeof spectrumBranchMetadataSchema>
export type SpectrumWarning = z.infer<typeof spectrumWarningSchema>
export type Applicability = z.infer<typeof applicabilitySchema>
export type NormalizedSpectrumOrdinate = z.infer<
  typeof normalizedSpectrumOrdinateSchema
>
export type NormalizedSpectrumResultData = z.infer<
  typeof normalizedSpectrumResultDataSchema
>
export type NormalizedSpectrumResult = NormalizedSpectrumResultData & {
  saAt(tSeconds: number): NormalizedSpectrumOrdinate
}
export type SpectrumExport = z.infer<typeof spectrumExportSchema>
