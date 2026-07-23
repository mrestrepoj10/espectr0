import { z } from "zod"

import {
  getMunicipalityTraceability,
  type MunicipalityTraceability,
} from "../nsr10/evidence"
import {
  NSR10_ENGINE_ID,
  NSR10_SOURCE_ID,
  parseNsr10TraceEnvelope,
} from "./nsr10-evidence"
import {
  normalizedInputValueSchema,
  scenarioEvidenceKeySchema,
  spectrumUnitSchema,
  type NormalizedInputValue,
  type NormalizedSpectrumResultData,
  type ScenarioEvidenceKey,
} from "./types"

export const SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION = 2 as const

const idSchema = z.string().trim().min(1)
const nullableTextSchema = z.string().trim().min(1).nullable()
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

export const spectrumEvidenceRectSchema = z
  .object({
    left: z.number().finite().min(0).max(1),
    top: z.number().finite().min(0).max(1),
    width: z.number().finite().positive().max(1),
    height: z.number().finite().positive().max(1),
  })
  .strict()
  .superRefine((rect, context) => {
    if (rect.left + rect.width > 1) {
      context.addIssue({
        code: "custom",
        message: "Evidence rectangle exceeds the page width",
        path: ["width"],
      })
    }
    if (rect.top + rect.height > 1) {
      context.addIssue({
        code: "custom",
        message: "Evidence rectangle exceeds the page height",
        path: ["height"],
      })
    }
  })

export const spectrumEvidenceDocumentSchema = z
  .object({
    sourceId: idSchema,
    issuingAuthority: nullableTextSchema,
    title: idSchema,
    edition: idSchema,
    adoptionInstrument: nullableTextSchema,
    officialUrl: z.string().url().nullable(),
    sourceUrl: z.string().url(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    localPath: nullableTextSchema,
  })
  .strict()

export const spectrumEvidenceCitationSchema = z
  .object({
    id: idSchema,
    sourceId: idSchema,
    kind: z.enum([
      "row",
      "cell",
      "clause",
      "equation",
      "warning",
      "applicability",
    ]),
    physicalPage: z.number().int().positive(),
    printedPage: nullableTextSchema,
    table: nullableTextSchema,
    row: nullableTextSchema,
    cell: nullableTextSchema,
    reference: idSchema,
    rect: spectrumEvidenceRectSchema,
    transcription: idSchema,
  })
  .strict()

export const spectrumDirectValueSchema = z
  .object({
    id: idSchema,
    label: idSchema,
    value: normalizedInputValueSchema,
    normalizedInputPath: z.array(idSchema).min(1),
    unit: spectrumUnitSchema.nullable(),
    provenance: z.literal("direct-source"),
    citationId: idSchema,
  })
  .strict()

export const spectrumMetricLineageSchema = z
  .object({
    id: idSchema,
    label: idSchema,
    value: z.number().finite(),
    unit: spectrumUnitSchema,
    formulaId: idSchema.nullable(),
    formula: nullableTextSchema,
    substitution: nullableTextSchema,
    reference: nullableTextSchema,
    dependencyIds: uniqueIdsSchema,
    citationIds: uniqueIdsSchema,
  })
  .strict()

export const spectrumBranchLineageSchema = z
  .object({
    branchId: idSchema,
    formulaId: idSchema,
    formula: nullableTextSchema,
    condition: nullableTextSchema,
    reference: nullableTextSchema,
    citationIds: uniqueIdsSchema,
    periodRangeSeconds: z
      .object({
        from: z.number().finite().nonnegative(),
        to: z.number().finite().nonnegative(),
      })
      .strict()
      .refine(({ from, to }) => to >= from, {
        message: "Branch period range must be ordered",
        path: ["to"],
      }),
    pointCount: z.number().int().positive(),
  })
  .strict()

export const spectrumEvidenceViewSchema = z
  .object({
    schemaVersion: z.literal(SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION),
    key: scenarioEvidenceKeySchema,
    status: z.enum(["available", "partial", "unavailable"]),
    study: z
      .object({ id: idSchema, version: idSchema, label: idSchema })
      .strict(),
    selection: z
      .object({
        optionId: idSchema.nullable(),
        location: nullableTextSchema,
        zone: nullableTextSchema,
        hazardId: idSchema.nullable(),
        hazardLabel: nullableTextSchema,
      })
      .strict(),
    documents: z.array(spectrumEvidenceDocumentSchema),
    directValues: z.array(spectrumDirectValueSchema),
    citations: z.array(spectrumEvidenceCitationSchema),
    metricLineage: z.array(spectrumMetricLineageSchema),
    branchLineage: z.array(spectrumBranchLineageSchema),
    unavailableClaims: z.array(
      z.object({ id: idSchema, reason: idSchema }).strict(),
    ),
  })
  .strict()
  .superRefine((view, context) => {
    if (view.status === "available" && view.unavailableClaims.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Available evidence cannot declare unavailable claims",
        path: ["unavailableClaims"],
      })
    }
    if (view.status !== "available" && view.unavailableClaims.length === 0) {
      context.addIssue({
        code: "custom",
        message: `${view.status} evidence must explain unavailable claims`,
        path: ["unavailableClaims"],
      })
    }
  })

export type SpectrumEvidenceRect = z.infer<typeof spectrumEvidenceRectSchema>
export type SpectrumEvidenceDocument = z.infer<
  typeof spectrumEvidenceDocumentSchema
>
export type SpectrumEvidenceCitation = z.infer<
  typeof spectrumEvidenceCitationSchema
>
export type SpectrumDirectValue = z.infer<typeof spectrumDirectValueSchema>
export type SpectrumMetricLineage = z.infer<typeof spectrumMetricLineageSchema>
export type SpectrumBranchLineage = z.infer<typeof spectrumBranchLineageSchema>
export type SpectrumEvidenceView = z.infer<typeof spectrumEvidenceViewSchema>

export type SpectrumEvidenceResolver = {
  engineId: string
  resolve(
    result: NormalizedSpectrumResultData,
    key: ScenarioEvidenceKey,
  ): SpectrumEvidenceView
  validateRelations(
    result: NormalizedSpectrumResultData,
    key: ScenarioEvidenceKey,
    view: SpectrumEvidenceView,
  ): void
}

function sameEvidenceKey(left: ScenarioEvidenceKey, right: ScenarioEvidenceKey) {
  return (
    left.studyId === right.studyId &&
    left.studyVersion === right.studyVersion &&
    left.optionId === right.optionId &&
    left.hazardId === right.hazardId
  )
}

function assertEvidenceView(
  result: NormalizedSpectrumResultData,
  view: SpectrumEvidenceView,
) {
  if (!sameEvidenceKey(result.scenarioEvidenceKey, view.key)) {
    throw new Error("Evidence view key does not match the normalized result")
  }
  if (
    view.study.id !== result.study.id ||
    view.study.version !== result.study.version
  ) {
    throw new Error("Evidence view study does not match the normalized result")
  }
  if (
    view.selection.optionId !== view.key.optionId ||
    view.selection.hazardId !== view.key.hazardId
  ) {
    throw new Error("Evidence selection does not match its scenario key")
  }
  if (view.selection.hazardLabel !== (result.hazard?.label ?? null)) {
    throw new Error("Evidence selection hazard label does not match the result")
  }
  const availabilityRank = { unavailable: 0, partial: 1, available: 2 } as const
  if (
    availabilityRank[view.status] >
    availabilityRank[result.evidenceAvailability.status]
  ) {
    throw new Error("Evidence view cannot upgrade normalized availability")
  }
  const sourceIds = new Set<string>()
  for (const document of view.documents) {
    if (sourceIds.has(document.sourceId)) {
      throw new Error(`Duplicate evidence document ID: ${document.sourceId}`)
    }
    if (!result.sourceIds.includes(document.sourceId)) {
      throw new Error(`Evidence document source is not declared: ${document.sourceId}`)
    }
    sourceIds.add(document.sourceId)
  }
  const citationIds = new Set<string>()
  for (const citation of view.citations) {
    if (citationIds.has(citation.id)) {
      throw new Error(`Duplicate evidence citation ID: ${citation.id}`)
    }
    if (!sourceIds.has(citation.sourceId)) {
      throw new Error(`Evidence citation has no document: ${citation.id}`)
    }
    citationIds.add(citation.id)
  }
  for (const value of view.directValues) {
    if (!citationIds.has(value.citationId)) {
      throw new Error(`Direct evidence value has no cell citation: ${value.id}`)
    }
    const citation = view.citations.find(({ id }) => id === value.citationId)
    if (citation?.kind !== "cell") {
      throw new Error(`Direct evidence value citation is not a cell: ${value.id}`)
    }
    let boundInput: NormalizedInputValue | undefined = result.normalizedInputs
    for (const segment of value.normalizedInputPath) {
      if (
        boundInput === null ||
        typeof boundInput !== "object" ||
        Array.isArray(boundInput) ||
        !(segment in boundInput)
      ) {
        throw new Error(`Direct evidence input path does not resolve: ${value.id}`)
      }
      boundInput = boundInput[segment]
    }
    if (JSON.stringify(boundInput) !== JSON.stringify(value.value)) {
      throw new Error(`Direct evidence value does not match normalized input: ${value.id}`)
    }
  }

  if (view.status === "unavailable") {
    if (
      view.documents.length > 0 ||
      view.directValues.length > 0 ||
      view.citations.length > 0 ||
      view.metricLineage.length > 0 ||
      view.branchLineage.length > 0
    ) {
      throw new Error("Unavailable evidence cannot expose unvalidated lineage")
    }
    return
  }

  const expectedMetrics =
    result.status === "ok"
      ? result.metrics.filter(({ formulaId }) => formulaId !== null)
      : []
  if (view.metricLineage.length !== expectedMetrics.length) {
    throw new Error("Evidence metric lineage is incomplete")
  }
  for (const metric of view.metricLineage) {
    const expected = expectedMetrics.find(({ id }) => id === metric.id)
    if (
      !expected ||
      metric.label !== expected.label ||
      metric.value !== expected.value ||
      metric.unit !== expected.unit ||
      metric.formulaId !== expected.formulaId ||
      JSON.stringify(metric.dependencyIds) !==
        JSON.stringify(expected.dependencyIds) ||
      JSON.stringify(metric.citationIds) !== JSON.stringify(expected.citationIds)
    ) {
      throw new Error(`Evidence metric lineage does not match result: ${metric.id}`)
    }
  }

  const expectedBranches = result.status === "ok" ? result.branches : []
  if (view.branchLineage.length !== expectedBranches.length) {
    throw new Error("Evidence branch lineage is incomplete")
  }
  for (const branch of view.branchLineage) {
    const expected = expectedBranches.find(({ id }) => id === branch.branchId)
    const points =
      result.status === "ok"
        ? result.points.filter(({ branchId }) => branchId === branch.branchId)
        : []
    if (
      !expected ||
      points.length === 0 ||
      branch.formulaId !== expected.formulaId ||
      JSON.stringify(branch.citationIds) !== JSON.stringify(expected.citationIds) ||
      branch.pointCount !== points.length ||
      branch.periodRangeSeconds.from !== points[0].tSeconds ||
      branch.periodRangeSeconds.to !== points[points.length - 1].tSeconds
    ) {
      throw new Error(`Evidence branch lineage does not match result: ${branch.branchId}`)
    }
  }
}

function evidenceStatus(result: NormalizedSpectrumResultData) {
  return result.evidenceAvailability.status
}

function unavailableClaims(result: NormalizedSpectrumResultData) {
  if (result.evidenceAvailability.status === "partial") {
    return result.evidenceAvailability.unavailableClaims
  }
  if (result.evidenceAvailability.status === "unavailable") {
    return [
      {
        id: "scenario-evidence",
        reason: result.evidenceAvailability.reason,
      },
    ]
  }
  return []
}

function nsr10Document(
  source: MunicipalityTraceability["source"],
): SpectrumEvidenceDocument {
  return {
    sourceId: NSR10_SOURCE_ID,
    issuingAuthority: null,
    title: source.document,
    edition: "Versión consolidada 2017",
    adoptionInstrument: null,
    officialUrl: null,
    sourceUrl: source.sourceUrl,
    sha256: source.pdfSha256,
    localPath: source.pdfPath,
  }
}

function nsr10CitationId(optionId: string, field: string) {
  return `nsr10:manifest-v4:municipality:${optionId}:${field}`
}

function nsr10Evidence(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey,
): SpectrumEvidenceView {
  const traceability = key.optionId
    ? getMunicipalityTraceability(key.optionId)
    : undefined
  const base = {
    schemaVersion: SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION,
    key,
    study: {
      id: result.study.id,
      version: result.study.version,
      label: "NSR-10 Nacional",
    },
    selection: {
      optionId: key.optionId,
      location: traceability
        ? `${traceability.municipality.municipio}, ${traceability.municipality.departamento}`
        : null,
      zone: null,
      hazardId: key.hazardId,
      hazardLabel: result.hazard?.label ?? null,
    },
    metricLineage: [] as SpectrumMetricLineage[],
    branchLineage: [] as SpectrumBranchLineage[],
  }

  if (!traceability) {
    return {
      ...base,
      status: "unavailable",
      documents: [],
      directValues: [],
      citations: [],
      unavailableClaims: [
        ...unavailableClaims(result),
        {
          id: "scenario-option",
          reason: key.optionId
            ? `No existe evidencia aprobada para la opción ${key.optionId}.`
            : "El resultado no declara una ubicación o zona verificable.",
        },
      ],
    }
  }

  const optionId = key.optionId
  if (!optionId) throw new Error("Resolved NSR-10 evidence has no option ID")

  const rowLabel = `${traceability.municipality.municipio} (${traceability.municipality.code})`
  const fieldEntries = [
    ["aa", "Aa", traceability.values.aa],
    ["av", "Av", traceability.values.av],
    ["ae", "Ae", traceability.values.ae],
    ["ad", "Ad", traceability.values.ad],
  ] as const
  const rowCitationId = nsr10CitationId(optionId, "row")
  const citations: SpectrumEvidenceCitation[] = [
    {
      id: rowCitationId,
      sourceId: NSR10_SOURCE_ID,
      kind: "row",
      physicalPage: traceability.pageNumber,
      printedPage: traceability.printedPage,
      table: traceability.source.appendix,
      row: rowLabel,
      cell: null,
      reference: `${traceability.source.appendix} · ${rowLabel}`,
      rect: traceability.row,
      transcription: `${traceability.municipality.municipio}, ${traceability.municipality.departamento}, código DANE ${traceability.municipality.code}: Aa ${traceability.values.aa.value}, Av ${traceability.values.av.value}, Ae ${traceability.values.ae.value}, Ad ${traceability.values.ad.value}.`,
    },
    ...fieldEntries.map(([field, label, entry]) => ({
      id: nsr10CitationId(optionId, field),
      sourceId: NSR10_SOURCE_ID,
      kind: "cell" as const,
      physicalPage: traceability.pageNumber,
      printedPage: traceability.printedPage,
      table: traceability.source.appendix,
      row: rowLabel,
      cell: label,
      reference: `${traceability.source.appendix} · ${rowLabel} · celda ${label}`,
      rect: entry.rect,
      transcription: `${label} = ${entry.value}`,
    })),
  ]
  const directValues = fieldEntries.map(([field, label, entry]) => ({
    id: field,
    label,
    value: entry.value,
    normalizedInputPath: [field],
    unit: "g" as const,
    provenance: "direct-source" as const,
    citationId: nsr10CitationId(optionId, field),
  }))

  let metricLineage: SpectrumMetricLineage[] = []
  let branchLineage: SpectrumBranchLineage[] = []
  if (result.status === "ok") {
    const trace = parseNsr10TraceEnvelope(result.trace)
    const stepById = new Map(trace.steps.map((step) => [step.id, step]))
    const traceBranchById = new Map<string, (typeof trace.branches)[number]>(
      trace.branches.map((branch) => [branch.id, branch]),
    )
    metricLineage = result.metrics
      .filter((metric) => metric.formulaId !== null)
      .map((metric) => {
      const step = metric.formulaId ? stepById.get(metric.formulaId) : undefined
      return {
        id: metric.id,
        label: metric.label,
        value: metric.value,
        unit: metric.unit,
        formulaId: metric.formulaId,
        formula: step?.formula ?? null,
        substitution: step?.substitution ?? null,
        reference: step?.reference ?? null,
        dependencyIds: [...metric.dependencyIds],
        citationIds: [...metric.citationIds],
        }
      })
    branchLineage = result.branches.map((branch) => {
      const points = result.points.filter(({ branchId }) => branchId === branch.id)
      const traceBranch = traceBranchById.get(branch.id)
      if (points.length === 0) {
        throw new Error(`Spectrum branch has no normalized points: ${branch.id}`)
      }
      return {
        branchId: branch.id,
        formulaId: branch.formulaId,
        formula: traceBranch?.formula ?? null,
        condition: traceBranch?.condition ?? null,
        reference: traceBranch?.reference ?? null,
        citationIds: [...branch.citationIds],
        periodRangeSeconds: {
          from: points[0].tSeconds,
          to: points[points.length - 1].tSeconds,
        },
        pointCount: points.length,
      }
    })
  }

  return {
    ...base,
    status: evidenceStatus(result),
    documents: [nsr10Document(traceability.source)],
    directValues,
    citations,
    metricLineage,
    branchLineage,
    unavailableClaims: unavailableClaims(result),
  }
}

function unavailableResolverView(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey,
): SpectrumEvidenceView {
  return {
    schemaVersion: SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION,
    key,
    status: "unavailable",
    study: {
      id: result.study.id,
      version: result.study.version,
      label: result.study.id,
    },
    selection: {
      optionId: key.optionId,
      location: null,
      zone: null,
      hazardId: key.hazardId,
      hazardLabel: result.hazard?.label ?? null,
    },
    documents: [],
    directValues: [],
    citations: [],
    metricLineage: [],
    branchLineage: [],
    unavailableClaims: [
      {
        id: "evidence-resolver",
        reason: `No hay un resolvedor de evidencia instalado para ${result.engine.id}.`,
      },
    ],
  }
}

export class SpectrumEvidenceResolverRegistry {
  readonly #resolvers = new Map<string, SpectrumEvidenceResolver>()

  register(resolver: SpectrumEvidenceResolver) {
    if (this.#resolvers.has(resolver.engineId)) {
      throw new Error(`Evidence resolver already registered: ${resolver.engineId}`)
    }
    if (typeof resolver.validateRelations !== "function") {
      throw new Error(
        `Evidence resolver has no relation validator: ${resolver.engineId}`,
      )
    }
    this.#resolvers.set(resolver.engineId, resolver)
    return this
  }

  resolve(
    result: NormalizedSpectrumResultData,
    key: ScenarioEvidenceKey = result.scenarioEvidenceKey,
  ) {
    if (!sameEvidenceKey(result.scenarioEvidenceKey, key)) {
      throw new Error("Scenario evidence key does not match the normalized result")
    }
    const resolver = this.#resolvers.get(result.engine.id)
    const view = spectrumEvidenceViewSchema.parse(
      resolver
        ? resolver.resolve(result, key)
        : unavailableResolverView(result, key),
    )
    assertEvidenceView(result, view)
    resolver?.validateRelations(result, key, view)
    return view
  }
}

function assertCanonicalNsr10EvidenceView(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey,
  view: SpectrumEvidenceView,
) {
  const expected = spectrumEvidenceViewSchema.parse(nsr10Evidence(result, key))
  if (JSON.stringify(view) !== JSON.stringify(expected)) {
    throw new Error(
      "NSR-10 evidence view does not match its installed source and trace model",
    )
  }
}

export const nsr10EvidenceResolver: SpectrumEvidenceResolver = {
  engineId: NSR10_ENGINE_ID,
  resolve: nsr10Evidence,
  validateRelations: assertCanonicalNsr10EvidenceView,
}

export const spectrumEvidenceResolverRegistry =
  new SpectrumEvidenceResolverRegistry().register(nsr10EvidenceResolver)

export function resolveSpectrumEvidence(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey = result.scenarioEvidenceKey,
) {
  return spectrumEvidenceResolverRegistry.resolve(result, key)
}
