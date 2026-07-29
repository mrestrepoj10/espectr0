import canonicalJson from "./data/canonical.json"
import claimsMatrix from "./evidence/claims-matrix.json"
import formulaInventory from "./evidence/formula-inventory.json"
import evidenceManifest from "./evidence/manifest.json"

import {
  SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION,
  spectrumEvidenceViewSchema,
  type SpectrumBranchLineage,
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

const CALI_ENGINE_ID = "cali-spectrum"
const FULL_PAGE = { left: 0, top: 0, width: 1, height: 1 } as const

type ManifestCitation = (typeof evidenceManifest.citations)[number]
type FormulaEvidence = (typeof formulaInventory.formulas)[number]
type ClaimEvidence = (typeof claimsMatrix.claims)[number]

const manifestCitations = new Map(
  evidenceManifest.citations.map((citation) => [citation.id, citation]),
)
const formulas = new Map(
  formulaInventory.formulas.map((formula) => [formula.id, formula]),
)
const claims = new Map(claimsMatrix.claims.map((claim) => [claim.id, claim]))
const sources = new Map(evidenceManifest.sources.map((source) => [source.id, source]))

function documentFor(sourceId: string): SpectrumEvidenceDocument {
  const source = sources.get(sourceId)
  if (!source) throw new Error(`Missing Cali evidence source ${sourceId}`)
  return {
    sourceId,
    issuingAuthority: source.issuingAuthority,
    title: source.officialTitle,
    edition: source.revision ? `${source.edition} · ${source.revision}` : source.edition,
    adoptionInstrument: source.adoptionInstrument,
    officialUrl: source.officialUrl,
    sourceUrl: source.officialUrl,
    sha256: source.sha256,
    localPath: null,
  }
}

function manifestCitation(citation: ManifestCitation): SpectrumEvidenceCitation {
  const parentId =
    "parentCitationId" in citation ? citation.parentCitationId ?? null : null
  const parent = parentId ? manifestCitations.get(parentId) : null
  return {
    id: citation.id,
    sourceId: citation.sourceDocumentId,
    kind: citation.regionKind === "cell" ? "cell" : citation.regionKind === "row" ? "row" : "applicability",
    physicalPage: citation.physicalPage,
    printedPage: citation.printedPage,
    table: citation.reference.startsWith("Tabla ")
      ? citation.reference.split(",")[0]
      : null,
    row: parent?.reference ?? null,
    cell:
      citation.regionKind === "cell"
        ? `Columna ${citation.id.split("-").at(-1) ?? "?"}`
        : null,
    reference: citation.reference,
    rect: citation.rect,
    transcription: citation.extractedToken,
  }
}

function formulaCitation(
  id: string,
  formula: FormulaEvidence,
): SpectrumEvidenceCitation {
  return {
    id,
    sourceId: formula.citation.sourceDocumentId,
    kind: "equation",
    physicalPage: formula.citation.physicalPage,
    printedPage: formula.citation.printedPage,
    table: null,
    row: formula.range,
    cell: null,
    reference: formula.citation.reference,
    rect: "rect" in formula.citation ? formula.citation.rect : FULL_PAGE,
    transcription: formula.equation,
  }
}

function claimCitation(id: string, claim: ClaimEvidence): SpectrumEvidenceCitation {
  return {
    id,
    sourceId: claim.citation.sourceDocumentId,
    kind: claim.kind === "warning" ? "warning" : "applicability",
    physicalPage: claim.citation.physicalPage,
    printedPage: claim.citation.printedPage,
    table: null,
    row: null,
    cell: null,
    reference: claim.citation.reference,
    rect:
      "rect" in claim.citation && claim.citation.rect
        ? claim.citation.rect
        : FULL_PAGE,
    transcription: claim.statement,
  }
}

function resolveCitation(id: string): SpectrumEvidenceCitation {
  const direct = manifestCitations.get(id)
  if (direct) return manifestCitation(direct)
  if (id.startsWith("formula-")) {
    const formula = formulas.get(id.slice("formula-".length))
    if (formula) return formulaCitation(id, formula)
  }
  if (id.startsWith("claim-")) {
    const claim = claims.get(id.slice("claim-".length))
    if (claim) return claimCitation(id, claim)
  }
  throw new Error(`Missing Cali evidence citation ${id}`)
}

function unavailableClaims(result: NormalizedSpectrumResultData) {
  if (result.evidenceAvailability.status === "partial") {
    return result.evidenceAvailability.unavailableClaims
  }
  if (result.evidenceAvailability.status === "unavailable") {
    return [{ id: "scenario-evidence", reason: result.evidenceAvailability.reason }]
  }
  return []
}

function caliEvidence(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey,
): SpectrumEvidenceView {
  const citations = result.citationIds.map(resolveCitation)
  const citationById = new Map(citations.map((citation) => [citation.id, citation]))
  const traceSteps = result.trace?.data.steps ?? []
  const stepById = new Map(traceSteps.map((step) => [step.id, step]))
  const component = canonicalJson.curveComponents.find(({ id }) => id === key.optionId)
  const directSteps = traceSteps.filter(
    (step) => step.classification === "direct-source" && step.id.includes("-column-"),
  )
  const directValues = directSteps.map((step) => {
    const citationId = Array.isArray(step.citationIds) ? step.citationIds[0] : null
    if (typeof citationId !== "string" || !citationById.has(citationId)) {
      throw new Error(`Cali direct trace step has no resolved citation: ${step.id}`)
    }
    return {
      id: step.id,
      label: String(step.label),
      value: step.value as number,
      normalizedInputPath: null,
      traceStepId: step.id,
      unit: step.unit as SpectrumUnit,
      provenance: "direct-source" as const,
      citationId,
    }
  })

  let metricLineage: SpectrumMetricLineage[] = []
  let branchLineage: SpectrumBranchLineage[] = []
  if (result.status === "ok") {
    metricLineage = result.metrics
      .filter(({ formulaId }) => formulaId !== null)
      .map((metric) => {
        const step = metric.formulaId ? stepById.get(metric.formulaId) : undefined
        const firstCitation = metric.citationIds
          .map((id) => citationById.get(id))
          .find(Boolean)
        return {
          id: metric.id,
          label: metric.label,
          value: metric.value,
          unit: metric.unit,
          formulaId: metric.formulaId,
          formula: typeof step?.expression === "string" ? step.expression : null,
          substitution:
            typeof step?.substitution === "string" ? step.substitution : null,
          reference: firstCitation?.reference ?? null,
          dependencyIds: [...metric.dependencyIds],
          citationIds: [...metric.citationIds],
        }
      })
    branchLineage = result.branches.map((branch) => {
      const points = result.points.filter(({ branchId }) => branchId === branch.id)
      const formula = formulas.get(branch.formulaId)
      if (!formula || points.length === 0) {
        throw new Error(`Cali branch evidence is incomplete: ${branch.id}`)
      }
      return {
        branchId: branch.id,
        formulaId: branch.formulaId,
        formula: formula.equation,
        condition: formula.range,
        reference: formula.citation.reference,
        citationIds: [...branch.citationIds],
        periodRangeSeconds: {
          from: points[0].tSeconds,
          to: points[points.length - 1].tSeconds,
        },
        pointCount: points.length,
      }
    })
  }

  return spectrumEvidenceViewSchema.parse({
    schemaVersion: SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION,
    key,
    status: result.evidenceAvailability.status,
    study: {
      id: result.study.id,
      version: result.study.version,
      label: "Microzonificación sísmica de Santiago de Cali",
    },
    selection: {
      optionId: key.optionId,
      location: "Santiago de Cali",
      zone: component?.sourceLabel ?? null,
      hazardId: key.hazardId,
      hazardLabel: result.hazard?.label ?? null,
    },
    documents: result.sourceIds.map(documentFor),
    directValues,
    citations,
    metricLineage,
    branchLineage,
    unavailableClaims: unavailableClaims(result),
  })
}

function validateCaliRelations(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey,
  view: SpectrumEvidenceView,
) {
  const expected = caliEvidence(result, key)
  if (JSON.stringify(view) !== JSON.stringify(expected)) {
    throw new Error("Cali evidence view does not match its installed source and trace model")
  }
  const citationIds = new Set(view.citations.map(({ id }) => id))
  for (const citationId of result.citationIds) {
    if (!citationIds.has(citationId)) {
      throw new Error(`Cali evidence view omits result citation ${citationId}`)
    }
  }
}

export const caliEvidenceResolver: SpectrumEvidenceResolver = {
  engineId: CALI_ENGINE_ID,
  resolve: caliEvidence,
  validateRelations: validateCaliRelations,
}
