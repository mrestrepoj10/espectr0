import clauseCitations from "./data/clause-citations.json"
import formulaInventory from "./research/formula-inventory.json"
import { ccp14Study } from "./evidence/study-data.mjs"

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

import { CCP14_ENGINE_ID, CCP14_STUDY_LABEL } from "./constants"
import { resolveCcp14MapLocation } from "./map-locations"
import { parseCcp14TraceEnvelope, type Ccp14TraceStep } from "./trace"

type StudySource = {
  id: string
  issuingAuthority: string
  officialTitle: string
  edition: string
  revision: string | null
  adoptionInstrument: string
  officialUrl: string
  sha256: string
}

type StudyCitation = {
  id: string
  sourceDocumentId: string
  regionKind: string
  physicalPage: number
  printedPage: string | null
  reference: string
  rect: { left: number; top: number; width: number; height: number }
  extractedToken: string
}

const studySources = new Map<string, StudySource>(
  (ccp14Study.sources as StudySource[]).map((source) => [source.id, source]),
)
const studyCitations = new Map<string, StudyCitation>(
  (ccp14Study.citations as StudyCitation[]).map((citation) => [
    citation.id,
    citation,
  ]),
)
const clauseCitationsById = new Map(
  clauseCitations.citations.map((citation) => [citation.id, citation]),
)
/** Branch order in the locked formula inventory follows 3.10.4.2 Eqs. -1, -4 and -5. */
const branchConditions: Record<string, string> = {
  "initial-linear": formulaInventory.spectrumBranches[0].condition,
  plateau: formulaInventory.spectrumBranches[1].condition,
  "inverse-period": formulaInventory.spectrumBranches[2].condition,
}

function documentFor(sourceId: string): SpectrumEvidenceDocument {
  const source = studySources.get(sourceId)
  if (!source) throw new Error(`Missing CCP-14 evidence source ${sourceId}`)
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
 * The site-factor and R tables are cited cell by cell in the locked study
 * descriptor; every other claim, conflict, and applicability trigger is cited at
 * clause level. Both feed one citation lookup so a result citation ID always
 * resolves to an attested page of the official publication.
 */
function citationFor(citationId: string): SpectrumEvidenceCitation {
  const clause = clauseCitationsById.get(citationId)
  if (clause) {
    return {
      id: clause.id,
      sourceId: clause.sourceId,
      kind: clause.kind as SpectrumEvidenceCitation["kind"],
      physicalPage: clause.physicalPage,
      printedPage: clause.printedPage,
      table: null,
      row: null,
      cell: null,
      reference: clause.reference,
      rect: ("rect" in clause ? clause.rect : null) ?? null,
      transcription: clause.transcription,
    }
  }
  const study = studyCitations.get(citationId)
  if (!study) throw new Error(`Missing CCP-14 evidence citation ${citationId}`)
  const [table, row, cell] = study.reference.split(", ")
  const isTableRegion = study.regionKind === "cell" || study.regionKind === "row"
  return {
    id: study.id,
    sourceId: study.sourceDocumentId,
    kind:
      study.regionKind === "cell"
        ? "cell"
        : study.regionKind === "row"
          ? "row"
          : study.regionKind === "applicability"
            ? "applicability"
            : "clause",
    physicalPage: study.physicalPage,
    printedPage: study.printedPage,
    table: isTableRegion ? table ?? null : null,
    row: isTableRegion ? row ?? null : null,
    cell: study.regionKind === "cell" ? cell ?? null : null,
    reference: study.reference,
    rect: study.rect,
    transcription: study.extractedToken,
  }
}

/**
 * A site factor is direct source evidence only when the lookup landed on one
 * tabulated cell. Interpolated factors cite the two bracketing cells plus the
 * interpolation note, so they stay derived lineage instead.
 */
function directValueFor(step: Ccp14TraceStep): SpectrumDirectValue | null {
  if (step.citationIds.length !== 1) return null
  const citation = studyCitations.get(step.citationIds[0])
  if (!citation || citation.regionKind !== "cell") return null
  return {
    id: step.id,
    label: step.label,
    value: step.value,
    normalizedInputPath: null,
    traceStepId: step.id,
    unit: "dimensionless",
    provenance: "direct-source",
    citationId: citation.id,
  }
}

/** The place the reading was declared for, as printed on Figuras 3.10.2.1-1 a -3. */
function mapLocationLabel(result: NormalizedSpectrumResultData) {
  const id = result.normalizedInputs.mapLocationId
  return typeof id === "string" ? resolveCcp14MapLocation(id).label : null
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

function ccp14Evidence(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey,
): SpectrumEvidenceView {
  const base = {
    schemaVersion: SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION,
    key,
    study: {
      id: result.study.id,
      version: result.study.version,
      label: CCP14_STUDY_LABEL,
    },
    selection: {
      optionId: key.optionId,
      location: mapLocationLabel(result),
      zone: key.optionId ? `Perfil de sitio ${key.optionId}` : null,
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
        {
          id: "scenario-applicability",
          reason: result.applicability.message,
        },
      ],
    }
  }

  const trace = parseCcp14TraceEnvelope(result.trace)
  const stepById = new Map(trace.steps.map((step) => [step.id, step]))
  const citations = result.citationIds.map(citationFor)
  const directValues = (["Fpga", "Fa", "Fv"] as const)
    .map((factorId) => stepById.get(`ccp14-factor-${factorId.toLowerCase()}`))
    .filter((step): step is Ccp14TraceStep => step !== undefined)
    .map(directValueFor)
    .filter((value): value is SpectrumDirectValue => value !== null)
  const metricLineage: SpectrumMetricLineage[] = result.metrics
    .filter((metric) => metric.formulaId !== null)
    .map((metric) => {
      const step = metric.formulaId ? stepById.get(metric.formulaId) : undefined
      return {
        id: metric.id,
        label: metric.label,
        value: metric.value,
        unit: metric.unit as SpectrumUnit,
        formulaId: metric.formulaId,
        formula: step?.expression ?? null,
        substitution: step?.substitution ?? null,
        reference:
          clauseCitationsById.get(step?.citationIds[0] ?? "")?.reference ?? null,
        dependencyIds: [...metric.dependencyIds],
        citationIds: [...metric.citationIds],
      }
    })
  const branchLineage: SpectrumBranchLineage[] = result.branches.map((branch) => {
    const points = result.points.filter(({ branchId }) => branchId === branch.id)
    if (points.length === 0) {
      throw new Error(`Spectrum branch has no normalized points: ${branch.id}`)
    }
    const step = stepById.get(branch.formulaId)
    return {
      branchId: branch.id,
      formulaId: branch.formulaId,
      formula: step?.expression ?? null,
      condition: branchConditions[branch.id] ?? null,
      reference:
        clauseCitationsById.get("claim-spectrum-branches")?.reference ?? null,
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
    directValues,
    citations,
    metricLineage,
    branchLineage,
    unavailableClaims: unavailableClaims(result),
  }
}

function validateCcp14Relations(
  result: NormalizedSpectrumResultData,
  key: ScenarioEvidenceKey,
  view: SpectrumEvidenceView,
) {
  const expected = parseSpectrumEvidenceView(ccp14Evidence(result, key))
  if (JSON.stringify(view) !== JSON.stringify(expected)) {
    throw new Error(
      "CCP-14 evidence view does not match its installed source and trace model",
    )
  }
  const citationIds = new Set(view.citations.map(({ id }) => id))
  for (const citationId of result.citationIds) {
    if (view.status !== "unavailable" && !citationIds.has(citationId)) {
      throw new Error(`CCP-14 evidence view omits result citation ${citationId}`)
    }
  }
}

export const ccp14EvidenceResolver: SpectrumEvidenceResolver = {
  engineId: CCP14_ENGINE_ID,
  resolve: (result, key) => parseSpectrumEvidenceView(ccp14Evidence(result, key)),
  validateRelations: validateCcp14Relations,
}
