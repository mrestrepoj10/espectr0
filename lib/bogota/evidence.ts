import { z } from "zod"

import type { NormalizedSpectrumResultData } from "../spectra/types"
import claimsJson from "./evidence/claims-matrix.json"
import formulasJson from "./evidence/formula-inventory.json"
import manifestJson from "./evidence/manifest.json"
import {
  BOGOTA_STUDY_ID,
  bogotaFieldIdSchema,
  bogotaHazardIdSchema,
} from "./schema"

export const BOGOTA_TRACE_SCHEMA_ID = "bogota-spectrum-trace" as const
export const BOGOTA_TRACE_SCHEMA_VERSION = 1 as const

const idSchema = z.string().trim().min(1)
const citationIdListSchema = z.array(idSchema)

const evidenceValueSchema = z
  .object({
    id: idSchema,
    optionId: idSchema,
    hazardId: bogotaHazardIdSchema,
    fieldId: bogotaFieldIdSchema,
    value: z.number().finite(),
    unit: z.string().nullable(),
    provenance: z.enum(["direct-source", "derived"]),
    citationIds: citationIdListSchema,
    transformation: z.string().nullable(),
    derivedLineage: z
      .object({
        dependencies: z.array(
          z
            .object({
              valueId: idSchema,
              inputCitationIds: citationIdListSchema,
            })
            .strict(),
        ),
        formulaCitationId: idSchema,
        formula: idSchema,
        substitution: idSchema,
        result: z.number().finite(),
        unit: idSchema,
      })
      .strict()
      .optional(),
  })
  .strict()

const citationSchema = z
  .object({
    id: idSchema,
    sourceDocumentId: idSchema,
    regionKind: idSchema,
    physicalPage: z.number().int().positive(),
    printedPage: z.string().nullable(),
    reference: idSchema,
  })
  .passthrough()

const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    studyId: z.literal(BOGOTA_STUDY_ID),
    sources: z.array(z.object({ id: idSchema }).passthrough()).min(1),
    citations: z.array(citationSchema).min(1),
    applicabilityCitationIds: citationIdListSchema,
    coverage: z
      .object({
        optionIds: z.array(idSchema).length(16),
        hazardIds: z.array(bogotaHazardIdSchema).length(3),
        fieldIds: z.array(bogotaFieldIdSchema).length(6),
      })
      .strict(),
    values: z.array(evidenceValueSchema).length(288),
  })
  .passthrough()

const formulaSchema = z
  .object({
    id: idSchema,
    hazardId: bogotaHazardIdSchema,
    domain: idSchema,
    expression: idSchema,
    citation: z
      .object({
        sourceDocumentId: idSchema,
        physicalPage: z.number().int().positive(),
        printedPage: z.string().nullable(),
        reference: idSchema,
      })
      .passthrough(),
  })
  .strict()

const formulaInventorySchema = z
  .object({
    schemaVersion: z.literal(1),
    boundaryPolicy: idSchema,
    variables: z.record(z.string(), idSchema),
    formulas: z.array(formulaSchema).length(14),
  })
  .strict()

const claimSchema = z
  .object({
    id: idSchema,
    statement: idSchema,
    citation: z
      .object({
        sourceDocumentId: idSchema,
        physicalPage: z.number().int().positive(),
        printedPage: z.string().nullable(),
        reference: idSchema,
      })
      .passthrough(),
  })
  .strict()

const claimsMatrixSchema = z
  .object({
    schemaVersion: z.literal(1),
    claims: z.array(claimSchema).min(1),
    directMatrix: z.record(z.string(), z.unknown()),
  })
  .strict()

const manifest = manifestSchema.parse(manifestJson)
const formulaInventory = formulaInventorySchema.parse(formulasJson)
const claimsMatrix = claimsMatrixSchema.parse(claimsJson)

function uniqueMap<T extends { id: string }>(items: readonly T[], label: string) {
  const map = new Map<string, T>()
  for (const item of items) {
    if (map.has(item.id)) throw new Error(`Duplicate Bogotá ${label} ID: ${item.id}`)
    map.set(item.id, item)
  }
  return map
}

const sourceById = uniqueMap(manifest.sources, "source")
const citationById = uniqueMap(manifest.citations, "citation")
const valueById = uniqueMap(manifest.values, "value")
const formulaById = uniqueMap(formulaInventory.formulas, "formula")
const claimById = uniqueMap(claimsMatrix.claims, "claim")

for (const citation of manifest.citations) {
  if (!sourceById.has(citation.sourceDocumentId)) {
    throw new Error(`Bogotá citation ${citation.id} has an unknown source`)
  }
}
for (const formula of formulaInventory.formulas) {
  if (!sourceById.has(formula.citation.sourceDocumentId)) {
    throw new Error(`Bogotá formula ${formula.id} has an unknown source`)
  }
}
for (const claim of claimsMatrix.claims) {
  if (!sourceById.has(claim.citation.sourceDocumentId)) {
    throw new Error(`Bogotá claim ${claim.id} has an unknown source`)
  }
}

export const bogotaSourceIds = Object.freeze([...sourceById.keys()])

export function bogotaValueEvidenceId(
  hazardId: string,
  optionId: string,
  fieldId: string,
) {
  return `value-${hazardId}-${optionId}-${fieldId}`
}

export function resolveBogotaValueEvidence(id: string) {
  return valueById.get(id) ?? null
}

export function resolveBogotaFormulaEvidence(id: string) {
  return formulaById.get(id) ?? null
}

export function resolveBogotaClaimEvidence(id: string) {
  return claimById.get(id) ?? null
}

export function resolveBogotaCitation(id: string) {
  return citationById.get(id) ?? claimById.get(id) ?? null
}

export function bogotaFormulaCitationId(formulaId: string) {
  const formula = formulaById.get(formulaId)
  if (!formula) throw new Error(`Unknown Bogotá formula: ${formulaId}`)
  const citationId = `table-${formula.hazardId}`
  const citation = citationById.get(citationId)
  if (!citation) throw new Error(`Missing Bogotá formula citation: ${citationId}`)
  if (
    citation.sourceDocumentId !== formula.citation.sourceDocumentId ||
    citation.physicalPage !== formula.citation.physicalPage
  ) {
    throw new Error(`Bogotá formula ${formulaId} citation drifts from R2`)
  }
  return citationId
}

export const bogotaTraceStepSchema = z
  .object({
    id: idSchema,
    classification: z.enum(["direct-source", "derived", "user-input"]),
    label: idSchema,
    value: z.number().finite(),
    unit: z.enum(["g", "s", "dimensionless"]),
    dependencies: z.array(idSchema),
    evidenceIds: z.array(idSchema),
    citationIds: citationIdListSchema,
    expression: z.string().optional(),
    substitution: z.string().optional(),
  })
  .strict()

export const bogotaTraceBranchSchema = z
  .object({
    id: idSchema,
    formulaId: idSchema,
    domain: idSchema,
    citationIds: citationIdListSchema,
  })
  .strict()

export const bogotaTracePayloadSchema = z
  .object({
    schemaVersion: z.literal(BOGOTA_TRACE_SCHEMA_VERSION),
    context: z
      .object({
        zoneId: idSchema,
        hazardId: bogotaHazardIdSchema,
        importanceFactor: z.number().finite().positive(),
        boundaryPolicy: idSchema,
      })
      .strict(),
    steps: z.array(bogotaTraceStepSchema).min(1),
    branches: z.array(bogotaTraceBranchSchema).min(1),
  })
  .strict()
  .superRefine((trace, context) => {
    const stepIds = new Set<string>()
    trace.steps.forEach((step, index) => {
      if (stepIds.has(step.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate trace step: ${step.id}`,
          path: ["steps", index, "id"],
        })
      }
      stepIds.add(step.id)
    })
    trace.steps.forEach((step, index) => {
      for (const dependency of step.dependencies) {
        if (!stepIds.has(dependency)) {
          context.addIssue({
            code: "custom",
            message: `Missing trace dependency: ${dependency}`,
            path: ["steps", index, "dependencies"],
          })
        }
      }
    })
  })

export type BogotaTracePayload = z.infer<typeof bogotaTracePayloadSchema>

function assertCitationIds(ids: readonly string[], owner: string) {
  for (const id of ids) {
    if (!resolveBogotaCitation(id)) {
      throw new Error(`${owner} refers to unknown Bogotá citation ${id}`)
    }
  }
}

function assertStepEvidence(step: BogotaTracePayload["steps"][number]) {
  for (const evidenceId of step.evidenceIds) {
    if (
      !resolveBogotaValueEvidence(evidenceId) &&
      !resolveBogotaFormulaEvidence(evidenceId) &&
      !resolveBogotaClaimEvidence(evidenceId)
    ) {
      throw new Error(`Trace step ${step.id} has unknown evidence ${evidenceId}`)
    }
  }
  assertCitationIds(step.citationIds, `Trace step ${step.id}`)

  const valueEvidence = resolveBogotaValueEvidence(step.id)
  if (valueEvidence) {
    if (valueEvidence.value !== step.value) {
      throw new Error(`Trace step ${step.id} drifts from canonical evidence`)
    }
    if (valueEvidence.provenance !== step.classification) {
      throw new Error(`Trace step ${step.id} misclassifies canonical evidence`)
    }
    if (valueEvidence.provenance === "direct-source") {
      if (JSON.stringify(valueEvidence.citationIds) !== JSON.stringify(step.citationIds)) {
        throw new Error(`Trace step ${step.id} citation lineage drifts from R2`)
      }
    } else {
      const lineage = valueEvidence.derivedLineage
      if (!lineage) throw new Error(`Derived evidence ${step.id} has no lineage`)
      if (!step.citationIds.includes(lineage.formulaCitationId)) {
        throw new Error(`Derived trace step ${step.id} omits its formula citation`)
      }
      const expectedDependencies = lineage.dependencies.map(({ valueId }) => valueId)
      if (JSON.stringify(expectedDependencies) !== JSON.stringify(step.dependencies)) {
        throw new Error(`Derived trace step ${step.id} dependency lineage drifts from R2`)
      }
    }
  }
}

export function assertBogotaLineageResolves(result: NormalizedSpectrumResultData) {
  for (const sourceId of result.sourceIds) {
    if (!sourceById.has(sourceId)) {
      throw new Error(`Unknown Bogotá source ${sourceId}`)
    }
  }
  assertCitationIds(result.citationIds, "Result")
  result.warnings.forEach((warning) =>
    assertCitationIds(warning.citationIds, `Warning ${warning.code}`),
  )
  if (result.applicability.status !== "applicable") {
    assertCitationIds(result.applicability.citationIds, "Applicability")
  }
  if (result.status !== "ok") return

  const trace = bogotaTracePayloadSchema.parse(result.trace.data)
  const stepById = new Map(trace.steps.map((step) => [step.id, step]))
  const branchById = new Map(trace.branches.map((branch) => [branch.id, branch]))
  trace.steps.forEach(assertStepEvidence)
  trace.branches.forEach((branch) => {
    if (!resolveBogotaFormulaEvidence(branch.formulaId)) {
      throw new Error(`Branch ${branch.id} has unknown formula ${branch.formulaId}`)
    }
    assertCitationIds(branch.citationIds, `Branch ${branch.id}`)
  })
  for (const id of result.formulaIds) {
    if (!stepById.has(id) && !branchById.has(id)) {
      throw new Error(`Declared Bogotá formula/lineage ID is unresolved: ${id}`)
    }
  }
  result.points.forEach((point) =>
    assertCitationIds(point.citationIds, `Point T=${point.tSeconds}`),
  )
  result.metrics.forEach((metric) =>
    assertCitationIds(metric.citationIds, `Metric ${metric.id}`),
  )
}

export const bogotaBoundaryPolicy = formulaInventory.boundaryPolicy
