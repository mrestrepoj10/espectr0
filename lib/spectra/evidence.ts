import {
  getMunicipalityTraceability,
  type MunicipalityTraceability,
} from "../nsr10/evidence"
import {
  NSR10_ENGINE_ID,
  NSR10_SOURCE_ID,
  parseNsr10TraceEnvelope,
} from "./nsr10-evidence"

import type {
  NormalizedInputValue,
  NormalizedSpectrumResultData,
  ScenarioEvidenceKey,
  SpectrumUnit,
} from "./types"

export const SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION = 1 as const

export type SpectrumEvidenceRect = {
  left: number
  top: number
  width: number
  height: number
}

export type SpectrumEvidenceDocument = {
  sourceId: string
  issuingAuthority: string | null
  title: string
  edition: string
  adoptionInstrument: string | null
  officialUrl: string | null
  sourceUrl: string
  sha256: string
  localPath: string | null
}

export type SpectrumEvidenceCitation = {
  id: string
  sourceId: string
  kind: "row" | "cell" | "clause" | "equation" | "warning" | "applicability"
  physicalPage: number
  printedPage: string | null
  table: string | null
  row: string | null
  cell: string | null
  reference: string
  rect: SpectrumEvidenceRect
  transcription: string
}

export type SpectrumDirectValue = {
  id: string
  label: string
  value: NormalizedInputValue
  unit: SpectrumUnit | null
  provenance: "direct-source"
  citationId: string
}

export type SpectrumMetricLineage = {
  id: string
  label: string
  value: number
  unit: SpectrumUnit
  formulaId: string | null
  formula: string | null
  substitution: string | null
  reference: string | null
  dependencyIds: string[]
  citationIds: string[]
}

export type SpectrumBranchLineage = {
  branchId: string
  formulaId: string
  formula: string | null
  condition: string | null
  reference: string | null
  citationIds: string[]
  periodRangeSeconds: { from: number; to: number }
  pointCount: number
}

export type SpectrumEvidenceView = {
  schemaVersion: typeof SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION
  key: ScenarioEvidenceKey
  status: "available" | "partial" | "unavailable"
  study: { id: string; version: string; label: string }
  selection: {
    optionId: string | null
    location: string | null
    zone: string | null
    hazardId: string | null
    hazardLabel: string | null
  }
  documents: SpectrumEvidenceDocument[]
  directValues: SpectrumDirectValue[]
  citations: SpectrumEvidenceCitation[]
  metricLineage: SpectrumMetricLineage[]
  branchLineage: SpectrumBranchLineage[]
  unavailableClaims: Array<{ id: string; reason: string }>
}

export type SpectrumEvidenceResolver = {
  engineId: string
  resolve(
    result: NormalizedSpectrumResultData,
    key: ScenarioEvidenceKey,
  ): SpectrumEvidenceView
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
  const sourceIds = new Set<string>()
  for (const document of view.documents) {
    if (sourceIds.has(document.sourceId)) {
      throw new Error(`Duplicate evidence document ID: ${document.sourceId}`)
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
    const view = resolver
      ? resolver.resolve(result, key)
      : unavailableResolverView(result, key)
    assertEvidenceView(result, view)
    return view
  }
}

export const spectrumEvidenceResolverRegistry =
  new SpectrumEvidenceResolverRegistry().register({
    engineId: NSR10_ENGINE_ID,
    resolve: nsr10Evidence,
  })

export function resolveSpectrumEvidence(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey = result.scenarioEvidenceKey,
) {
  return spectrumEvidenceResolverRegistry.resolve(result, key)
}
