import { z } from "zod"

import { spectrumCapabilitiesSchema } from "./capabilities"

export const SPECTRUM_CONTRACT_SCHEMA_VERSION = 1 as const
export const SPECTRUM_EXPORT_SCHEMA_VERSION = 1 as const

export const spectrumScenarioTypeSchema = z.enum([
  "nsr10-national",
  "ccp14",
  "municipal-study",
])

export type NormalizedInputValue =
  | string
  | number
  | boolean
  | null
  | NormalizedInputValue[]
  | { [key: string]: NormalizedInputValue }

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
  .refine(({ studyId }) => studyId !== "nsr10-national" && studyId !== "ccp14", {
    message: "Municipal studies cannot use reserved national study IDs",
    path: ["studyId"],
  })

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

const idSchema = z.string().trim().min(1)
const uniqueIdsSchema = z.array(idSchema).superRefine((ids, context) => {
  const seen = new Set<string>()
  ids.forEach((id, index) => {
    if (seen.has(id)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate identifier: ${id}`,
        path: [index],
      })
    }
    seen.add(id)
  })
})

export const spectrumMetricSchema = z
  .object({
    id: idSchema,
    label: idSchema,
    value: z.number().finite(),
    unit: spectrumUnitSchema,
    formulaId: idSchema.nullable(),
    dependencyIds: uniqueIdsSchema,
    citationIds: uniqueIdsSchema,
  })
  .strict()

export const normalizedSpectrumPointSchema = z
  .object({
    tSeconds: z.number().finite().nonnegative(),
    saG: z.number().finite().nonnegative(),
    branchId: idSchema,
    formulaId: idSchema,
    citationIds: uniqueIdsSchema,
  })
  .strict()

export const spectrumBranchMetadataSchema = z
  .object({
    id: idSchema,
    formulaId: idSchema,
    citationIds: uniqueIdsSchema,
  })
  .strict()

export const spectrumWarningSchema = z
  .object({
    severity: z.enum(["info", "warning", "error"]),
    code: idSchema,
    message: idSchema,
    citationIds: uniqueIdsSchema,
  })
  .strict()

const applicabilityDetailsShape = {
  reasonCode: idSchema,
  message: idSchema,
  citationIds: uniqueIdsSchema,
}

export const applicableSchema = z.object({ status: z.literal("applicable") }).strict()

export const invalidInputApplicabilitySchema = z
  .object({ status: z.literal("invalid-input"), ...applicabilityDetailsShape })
  .strict()
export const unsupportedApplicabilitySchema = z
  .object({ status: z.literal("unsupported"), ...applicabilityDetailsShape })
  .strict()
export const notApplicableApplicabilitySchema = z
  .object({ status: z.literal("not-applicable"), ...applicabilityDetailsShape })
  .strict()
export const siteSpecificApplicabilitySchema = z
  .object({
    status: z.literal("site-specific-study-required"),
    ...applicabilityDetailsShape,
  })
  .strict()

export const nonApplicableSchema = z.discriminatedUnion("status", [
  invalidInputApplicabilitySchema,
  unsupportedApplicabilitySchema,
  notApplicableApplicabilitySchema,
  siteSpecificApplicabilitySchema,
])

export const applicabilitySchema = z.discriminatedUnion("status", [
  applicableSchema,
  invalidInputApplicabilitySchema,
  unsupportedApplicabilitySchema,
  notApplicableApplicabilitySchema,
  siteSpecificApplicabilitySchema,
])

export const normalizedSpectrumOrdinateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), point: normalizedSpectrumPointSchema }).strict(),
  z
    .object({
      status: z.literal("invalid-input"),
      applicability: invalidInputApplicabilitySchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("unsupported"),
      applicability: unsupportedApplicabilitySchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("not-applicable"),
      applicability: notApplicableApplicabilitySchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("site-specific-study-required"),
      applicability: siteSpecificApplicabilitySchema,
    })
    .strict(),
])

export const evidenceAvailabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available") }).strict(),
  z
    .object({
      status: z.literal("partial"),
      unavailableClaims: z
        .array(
          z
            .object({ id: idSchema, reason: idSchema })
            .strict(),
        )
        .min(1),
    })
    .strict(),
  z.object({ status: z.literal("unavailable"), reason: idSchema }).strict(),
])

const traceStepSchema = z
  .object({ id: idSchema, dependencies: uniqueIdsSchema })
  .passthrough()
const traceBranchSchema = z.object({ id: idSchema }).passthrough()
const tracePayloadSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    steps: z.array(traceStepSchema),
    branches: z.array(traceBranchSchema),
  })
  .passthrough()

export const spectrumTraceEnvelopeSchema = z
  .object({
    schemaId: idSchema,
    schemaVersion: z.number().int().positive(),
    data: tracePayloadSchema,
  })
  .strict()
  .superRefine((trace, context) => {
    if (trace.schemaVersion !== trace.data.schemaVersion) {
      context.addIssue({
        code: "custom",
        message: "Trace envelope and payload versions must agree",
        path: ["data", "schemaVersion"],
      })
    }
  })

const hazardSchema = z
  .object({
    id: idSchema,
    label: idSchema,
    returnPeriodYears: z.number().int().positive(),
    dampingRatio: z.number().positive().max(1),
  })
  .strict()

const identityShape = {
  schemaVersion: z.literal(SPECTRUM_CONTRACT_SCHEMA_VERSION),
  engine: z
    .object({
      id: idSchema,
      version: idSchema,
      studyId: idSchema,
      studyVersion: idSchema,
      scenarioType: spectrumScenarioTypeSchema,
    })
    .strict(),
  study: z.object({ id: idSchema, version: idSchema }).strict(),
  scenarioType: spectrumScenarioTypeSchema,
  normalizedInputs: normalizedInputsSchema,
  warnings: z.array(spectrumWarningSchema),
  sourceIds: uniqueIdsSchema,
  citationIds: uniqueIdsSchema,
  evidenceAvailability: evidenceAvailabilitySchema,
  traceSchemaVersion: z.number().int().positive(),
  capabilities: spectrumCapabilitiesSchema,
}

const successfulSpectrumResultSchema = z
  .object({
    ...identityShape,
    status: z.literal("ok"),
    applicability: applicableSchema,
    points: z.array(normalizedSpectrumPointSchema).min(1),
    metrics: z.array(spectrumMetricSchema).min(1),
    formulaIds: uniqueIdsSchema.min(1),
    branches: z.array(spectrumBranchMetadataSchema).min(1),
    hazard: hazardSchema,
    trace: spectrumTraceEnvelopeSchema,
  })
  .strict()

function failedResultSchema<
  TStatus extends
    | "invalid-input"
    | "unsupported"
    | "not-applicable"
    | "site-specific-study-required",
  TApplicability extends z.ZodTypeAny,
>(status: TStatus, applicability: TApplicability) {
  return z
    .object({
      ...identityShape,
      status: z.literal(status),
      applicability,
      hazard: hazardSchema.nullable(),
      trace: spectrumTraceEnvelopeSchema.nullable(),
    })
    .strict()
}

const invalidInputResultSchema = failedResultSchema(
  "invalid-input",
  invalidInputApplicabilitySchema,
)
const unsupportedResultSchema = failedResultSchema(
  "unsupported",
  unsupportedApplicabilitySchema,
)
const notApplicableResultSchema = failedResultSchema(
  "not-applicable",
  notApplicableApplicabilitySchema,
)
const siteSpecificResultSchema = failedResultSchema(
  "site-specific-study-required",
  siteSpecificApplicabilitySchema,
)

function assertIdentity(
  result: {
    scenarioType: SpectrumScenarioType
    study: { id: string; version: string }
    engine: {
      studyId: string
      studyVersion: string
      scenarioType: SpectrumScenarioType
    }
  },
  context: z.RefinementCtx,
) {
  if (
    result.engine.studyId !== result.study.id ||
    result.engine.studyVersion !== result.study.version ||
    result.engine.scenarioType !== result.scenarioType
  ) {
    context.addIssue({
      code: "custom",
      message: "Result identity must agree with its engine declaration",
      path: ["engine"],
    })
  }
  const expectedStudyId =
    result.scenarioType === "nsr10-national"
      ? "nsr10-national"
      : result.scenarioType === "ccp14"
        ? "ccp14"
        : null
  if (expectedStudyId !== null && result.study.id !== expectedStudyId) {
    context.addIssue({
      code: "custom",
      message: `${result.scenarioType} results must use study ${expectedStudyId}`,
      path: ["study", "id"],
    })
  }
  if (
    result.scenarioType === "municipal-study" &&
    (result.study.id === "nsr10-national" || result.study.id === "ccp14")
  ) {
    context.addIssue({
      code: "custom",
      message: "Municipal results cannot use reserved national study IDs",
      path: ["study", "id"],
    })
  }
}

function addRelationalIssue(
  context: z.RefinementCtx,
  message: string,
  path: PropertyKey[],
) {
  context.addIssue({ code: "custom", message, path })
}

export const normalizedSpectrumResultDataSchema = z
  .discriminatedUnion("status", [
    successfulSpectrumResultSchema,
    invalidInputResultSchema,
    unsupportedResultSchema,
    notApplicableResultSchema,
    siteSpecificResultSchema,
  ])
  .superRefine((result, context) => {
    assertIdentity(result, context)
    if (result.trace && result.traceSchemaVersion !== result.trace.schemaVersion) {
      addRelationalIssue(
        context,
        "Result and trace schema versions must agree",
        ["traceSchemaVersion"],
      )
    }

    const topCitationIds = new Set(result.citationIds)
    result.warnings.forEach((warning, index) => {
      warning.citationIds.forEach((id) => {
        if (!topCitationIds.has(id)) {
          addRelationalIssue(context, `Warning citation is not declared: ${id}`, [
            "warnings",
            index,
            "citationIds",
          ])
        }
      })
    })
    if (result.applicability.status !== "applicable") {
      result.applicability.citationIds.forEach((id) => {
        if (!topCitationIds.has(id)) {
          addRelationalIssue(context, `Applicability citation is not declared: ${id}`, [
            "applicability",
            "citationIds",
          ])
        }
      })
    }

    if (result.status !== "ok") return

    const branchById = new Map(result.branches.map((branch) => [branch.id, branch]))
    const formulaIds = new Set(result.formulaIds)
    const traceFormulaIds = new Set([
      ...result.trace.data.steps.map(({ id }) => id),
      ...result.trace.data.branches.map(({ id }) => id),
    ])
    const traceStepIds = new Set(result.trace.data.steps.map(({ id }) => id))
    const traceBranchIds = new Set(result.trace.data.branches.map(({ id }) => id))

    result.branches.forEach((branch, index) => {
      if (!traceBranchIds.has(branch.id)) {
        addRelationalIssue(context, `Branch is absent from trace: ${branch.id}`, [
          "branches",
          index,
          "id",
        ])
      }
      if (!formulaIds.has(branch.formulaId)) {
        addRelationalIssue(context, `Branch formula is not declared: ${branch.formulaId}`, [
          "branches",
          index,
          "formulaId",
        ])
      }
      if (!traceFormulaIds.has(branch.formulaId)) {
        addRelationalIssue(context, `Branch formula is absent from trace: ${branch.formulaId}`, [
          "branches",
          index,
          "formulaId",
        ])
      }
      branch.citationIds.forEach((id) => {
        if (!topCitationIds.has(id)) {
          addRelationalIssue(context, `Branch citation is not declared: ${id}`, [
            "branches",
            index,
            "citationIds",
          ])
        }
      })
    })

    result.points.forEach((point, index) => {
      const branch = branchById.get(point.branchId)
      if (!branch) {
        addRelationalIssue(context, `Point branch is not declared: ${point.branchId}`, [
          "points",
          index,
          "branchId",
        ])
      } else if (branch.formulaId !== point.formulaId) {
        addRelationalIssue(context, "Point formula does not match its branch", [
          "points",
          index,
          "formulaId",
        ])
      }
      point.citationIds.forEach((id) => {
        if (!topCitationIds.has(id)) {
          addRelationalIssue(context, `Point citation is not declared: ${id}`, [
            "points",
            index,
            "citationIds",
          ])
        }
      })
    })

    result.metrics.forEach((metric, index) => {
      if (metric.formulaId !== null) {
        if (!formulaIds.has(metric.formulaId)) {
          addRelationalIssue(context, `Metric formula is not declared: ${metric.formulaId}`, [
            "metrics",
            index,
            "formulaId",
          ])
        }
        if (!traceFormulaIds.has(metric.formulaId)) {
          addRelationalIssue(context, `Metric formula is absent from trace: ${metric.formulaId}`, [
            "metrics",
            index,
            "formulaId",
          ])
        }
      }
      metric.dependencyIds.forEach((id) => {
        if (!traceStepIds.has(id)) {
          addRelationalIssue(context, `Metric dependency is absent from trace: ${id}`, [
            "metrics",
            index,
            "dependencyIds",
          ])
        }
        if (!formulaIds.has(id)) {
          addRelationalIssue(context, `Metric dependency is not declared: ${id}`, [
            "metrics",
            index,
            "dependencyIds",
          ])
        }
      })
      metric.citationIds.forEach((id) => {
        if (!topCitationIds.has(id)) {
          addRelationalIssue(context, `Metric citation is not declared: ${id}`, [
            "metrics",
            index,
            "citationIds",
          ])
        }
      })
    })

    result.formulaIds.forEach((id, index) => {
      if (!traceFormulaIds.has(id)) {
        addRelationalIssue(context, `Formula is absent from trace: ${id}`, [
          "formulaIds",
          index,
        ])
      }
    })
  })

export const spectrumExportSchema = z
  .object({
    schemaVersion: z.literal(SPECTRUM_EXPORT_SCHEMA_VERSION),
    result: normalizedSpectrumResultDataSchema,
  })
  .strict()

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
export type NonApplicable = z.infer<typeof nonApplicableSchema>
export type SpectrumTraceEnvelope = z.infer<typeof spectrumTraceEnvelopeSchema>
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
