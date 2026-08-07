import claimsMatrix from "./evidence/claims-matrix.json"
import formulaInventory from "./evidence/formula-inventory.json"
import evidenceManifest from "./evidence/manifest.json"

import {
  SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION,
  parseSpectrumEvidenceView,
  type SpectrumBranchLineage,
  type SpectrumDirectValue,
  type SpectrumEvidenceCitation,
  type SpectrumEvidenceDocument,
  type SpectrumEvidenceResolver,
  type SpectrumEvidenceView,
  type SpectrumMetricLineage,
} from "../spectra/evidence"
import type {
  NormalizedSpectrumResultData,
  ScenarioEvidenceKey,
  SpectrumUnit,
} from "../spectra/types"

import canonical from "./data/canonical.json"
import { bogotaValueEvidenceId } from "./evidence"

/**
 * Declared here rather than imported from the adapter: the adapter pulls in
 * study-relations, which registers this resolver, so importing back would leave
 * the identifier undefined at registration time.
 */
const BOGOTA_ENGINE_ID = "bogota-spectrum"

type ManifestCitation = (typeof evidenceManifest.citations)[number]
type ManifestValue = (typeof evidenceManifest.values)[number]

const sources = new Map(
  evidenceManifest.sources.map((source) => [source.id, source]),
)
const citations = new Map<string, ManifestCitation>(
  evidenceManifest.citations.map((citation) => [citation.id, citation]),
)
const values = new Map<string, ManifestValue>(
  (evidenceManifest.values as ManifestValue[]).map((value) => [value.id, value]),
)
/** Scope and warning claims are cited from the claims matrix, not the manifest. */
const claims = new Map(claimsMatrix.claims.map((claim) => [claim.id, claim]))
const formulas = new Map(
  formulaInventory.formulas.map((formula) => [formula.id, formula]),
)
const optionLabels = new Map(
  canonical.options.map((option) => [option.id, option.sourceLabel]),
)

function documentFor(sourceId: string): SpectrumEvidenceDocument {
  const source = sources.get(sourceId)
  if (!source) throw new Error(`Missing Bogotá evidence source ${sourceId}`)
  return {
    sourceId,
    issuingAuthority: source.issuingAuthority,
    title: source.officialTitle,
    edition: source.revision
      ? `${source.edition} · ${source.revision}`
      : source.edition,
    adoptionInstrument: source.adoptionInstrument,
    officialUrl: source.officialUrl,
    sourceUrl: source.officialUrl,
    sha256: source.sha256,
    localPath: null,
  }
}

/**
 * The FOPAE report is cited cell by cell for the tabulated coefficients and at
 * table or clause level for everything else, so one lookup covers whatever a
 * result cites.
 */
function citationFor(citationId: string): SpectrumEvidenceCitation {
  const claim = claims.get(citationId)
  if (claim) {
    return {
      id: citationId,
      sourceId: claim.citation.sourceDocumentId,
      kind: citationId.startsWith("warning-") ? "warning" : "applicability",
      physicalPage: claim.citation.physicalPage,
      printedPage: claim.citation.printedPage,
      table: null,
      row: null,
      cell: null,
      reference: claim.citation.reference,
      rect: claim.citation.rect ?? null,
      transcription: claim.statement,
    }
  }
  const citation = citations.get(citationId)
  if (!citation) throw new Error(`Missing Bogotá evidence citation ${citationId}`)
  const parentId =
    "parentCitationId" in citation
      ? (citation as { parentCitationId?: string | null }).parentCitationId ?? null
      : null
  const parent = parentId ? citations.get(parentId) : null
  const isTableRegion =
    citation.regionKind === "cell" || citation.regionKind === "row"
  return {
    id: citation.id,
    sourceId: citation.sourceDocumentId,
    kind:
      citation.regionKind === "cell"
        ? "cell"
        : citation.regionKind === "row"
          ? "row"
          : citation.regionKind === "applicability"
            ? "applicability"
            : citation.regionKind === "equation"
              ? "equation"
              : "clause",
    physicalPage: citation.physicalPage,
    printedPage: citation.printedPage,
    table: isTableRegion
      ? (parent?.reference ?? citation.reference).split(",")[0]
      : null,
    row: isTableRegion ? parent?.reference ?? null : null,
    cell: citation.regionKind === "cell" ? citation.extractedToken : null,
    reference: citation.reference,
    rect: citation.rect ?? null,
    transcription: citation.extractedToken,
  }
}

/**
 * Every tabulated coefficient of the selected zone and hazard, bound to the
 * trace step that carries it, with the cell of Tabla 7.5 that states it.
 */
function directValuesFor(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey,
): SpectrumDirectValue[] {
  if (result.status !== "ok" || !key.optionId || !key.hazardId) return []
  const steps = result.trace?.data.steps ?? []
  return steps.flatMap((step) => {
    const id = step.id as string
    const value = values.get(id)
    if (!value || value.provenance !== "direct-source") return []
    const citationId = value.citationIds[0]
    if (!citationId || !citations.get(citationId)?.rect) return []
    return [
      {
        id,
        label: String((step as { label?: string }).label ?? value.fieldId),
        value: value.value,
        normalizedInputPath: null,
        traceStepId: id,
        unit: ((step as { unit?: string }).unit ?? null) as SpectrumUnit | null,
        provenance: "direct-source" as const,
        citationId,
      },
    ]
  })
}

function unavailableClaims(result: NormalizedSpectrumResultData) {
  if (result.evidenceAvailability.status === "partial") {
    return result.evidenceAvailability.unavailableClaims
  }
  if (result.evidenceAvailability.status === "unavailable") {
    return [
      { id: "scenario-evidence", reason: result.evidenceAvailability.reason },
    ]
  }
  return []
}

function bogotaEvidence(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey,
): SpectrumEvidenceView {
  const base = {
    schemaVersion: SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION,
    key,
    study: {
      id: result.study.id,
      version: result.study.version,
      label: "Microzonificación sísmica de Bogotá D.C.",
    },
    selection: {
      optionId: key.optionId,
      location: "Bogotá D.C.",
      zone: key.optionId ? optionLabels.get(key.optionId) ?? key.optionId : null,
      hazardId: key.hazardId,
      hazardLabel: result.hazard?.label ?? null,
    },
  }

  if (result.status !== "ok") {
    return {
      ...base,
      status: "unavailable",
      documents: [],
      directValues: [],
      citations: [],
      metricLineage: [],
      branchLineage: [],
      unavailableClaims: [
        ...unavailableClaims(result),
        { id: "scenario-applicability", reason: result.applicability.message },
      ],
    }
  }

  const steps = result.trace?.data.steps ?? []
  const stepById = new Map(steps.map((step) => [step.id as string, step]))
  const metricLineage: SpectrumMetricLineage[] = result.metrics
    .filter((metric) => metric.formulaId !== null)
    .map((metric) => {
      const step = metric.formulaId ? stepById.get(metric.formulaId) : undefined
      const formula = metric.formulaId ? formulas.get(metric.formulaId) : undefined
      return {
        id: metric.id,
        label: metric.label,
        value: metric.value,
        unit: metric.unit as SpectrumUnit,
        formulaId: metric.formulaId,
        formula: formula?.expression ?? null,
        substitution:
          (step as { substitution?: string } | undefined)?.substitution ?? null,
        reference: formula?.citation.reference ?? null,
        dependencyIds: [...metric.dependencyIds],
        citationIds: [...metric.citationIds],
      }
    })
  const branchLineage: SpectrumBranchLineage[] = result.branches.map((branch) => {
    const points = result.points.filter(({ branchId }) => branchId === branch.id)
    if (points.length === 0) {
      throw new Error(`Spectrum branch has no normalized points: ${branch.id}`)
    }
    const formula = formulas.get(branch.formulaId)
    return {
      branchId: branch.id,
      formulaId: branch.formulaId,
      formula: formula?.expression ?? null,
      condition: formula?.domain ?? null,
      reference: formula?.citation.reference ?? null,
      citationIds: [...branch.citationIds],
      periodRangeSeconds: {
        from: points[0].tSeconds,
        to: points[points.length - 1].tSeconds,
      },
      pointCount: points.length,
    }
  })

  return {
    ...base,
    status: result.evidenceAvailability.status,
    documents: result.sourceIds.map(documentFor),
    directValues: directValuesFor(result, key),
    citations: result.citationIds.map(citationFor),
    metricLineage,
    branchLineage,
    unavailableClaims: unavailableClaims(result),
  }
}

function validateBogotaRelations(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey,
  view: SpectrumEvidenceView,
) {
  const expected = parseSpectrumEvidenceView(bogotaEvidence(result, key))
  if (JSON.stringify(view) !== JSON.stringify(expected)) {
    throw new Error(
      "Bogotá evidence view does not match its installed source and trace model",
    )
  }
  if (view.status === "unavailable") return
  const seen = new Set(view.citations.map(({ id }) => id))
  for (const citationId of result.citationIds) {
    if (!seen.has(citationId)) {
      throw new Error(`Bogotá evidence view omits result citation ${citationId}`)
    }
  }
  // Each tabulated coefficient must still resolve to the cell that states it.
  if (result.status === "ok" && key.optionId && key.hazardId) {
    for (const field of ["fa", "fv"]) {
      const id = bogotaValueEvidenceId(key.hazardId, key.optionId, field)
      if (values.has(id) && !view.directValues.some((value) => value.id === id)) {
        throw new Error(`Bogotá evidence view omits direct value ${id}`)
      }
    }
  }
}

export const bogotaEvidenceResolver: SpectrumEvidenceResolver = {
  engineId: BOGOTA_ENGINE_ID,
  resolve: (result, key) => parseSpectrumEvidenceView(bogotaEvidence(result, key)),
  validateRelations: validateBogotaRelations,
}
