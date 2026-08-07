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
} from "./evidence"
import type {
  NormalizedSpectrumResultData,
  ScenarioEvidenceKey,
  SpectrumUnit,
} from "./types"

/**
 * The municipal studies publish the same shape of evidence: a manifest of
 * sources and cited cells, a small formula inventory for the curve branches,
 * and a trace whose direct-source steps carry the tabulated values. Three
 * near-identical resolvers were the alternative to this one.
 */
type ManifestSource = {
  id: string
  issuingAuthority?: string | null
  officialTitle: string
  edition: string
  revision?: string | null
  adoptionInstrument?: string | null
  officialUrl: string
  sha256: string
}

type ManifestCitation = {
  id: string
  sourceDocumentId: string
  regionKind: string
  physicalPage: number
  printedPage?: string | null
  reference: string
  rect?: { left: number; top: number; width: number; height: number } | null
  extractedToken: string
  parentCitationId?: string | null
}

type FormulaEntry = {
  id: string
  /** Null where the inventory records a formula it could not transcribe. */
  expression: string | null
  /** The inventories spell the branch range either way. */
  domain?: string | null
  condition?: string | null
  citationId?: string | null
  citation?: { reference?: string | null } | null
}

export type MunicipalEvidenceResolverConfig = {
  engineId: string
  studyLabel: string
  location: string
  sources: readonly ManifestSource[]
  citations: readonly ManifestCitation[]
  formulas: readonly FormulaEntry[]
  /**
   * Citations a study keeps outside its manifest — the equation regions of the
   * formula inventory, the applicability regions of the claims matrix. A result
   * cites them like any other, so one lookup has to cover all three.
   */
  extraCitations?: readonly ManifestCitation[]
  /**
   * Pages of a source served locally, keyed by source id. An extract renumbers
   * its pages, so the map says where each cited page sits inside the file.
   */
  extracts?: Readonly<
    Record<string, { path: string; pageMap: Readonly<Record<string, number>> }>
  >
  /** Human label for an option id, for the drawer's selection header. */
  zoneLabel: (optionId: string) => string | null
}

const CITATION_KINDS = new Set([
  "row",
  "cell",
  "clause",
  "equation",
  "warning",
  "applicability",
])

function citationKind(regionKind: string, id: string) {
  if (id.startsWith("warning-")) return "warning" as const
  if (CITATION_KINDS.has(regionKind)) {
    return regionKind as SpectrumEvidenceCitation["kind"]
  }
  // A table-level region is a clause-shaped pointer at the whole table.
  return "clause" as const
}

export function createMunicipalEvidenceResolver(
  config: MunicipalEvidenceResolverConfig,
): SpectrumEvidenceResolver {
  const { engineId, studyLabel, location } = config
  const sources = new Map(config.sources.map((source) => [source.id, source]))
  const citations = new Map(
    [...config.citations, ...(config.extraCitations ?? [])].map((citation) => [
      citation.id,
      citation,
    ]),
  )
  /**
   * Indexed by inventory id and by the citation it carries: a branch names its
   * formula either way across the studies, and a miss silently empties the
   * branch's expression and range instead of failing.
   */
  const formulas = new Map<string, FormulaEntry>()
  for (const formula of config.formulas) {
    formulas.set(formula.id, formula)
    if (formula.citationId) formulas.set(formula.citationId, formula)
  }
  function formulaFor(formulaId: string) {
    return (
      formulas.get(formulaId) ??
      [...formulas.values()].find(
        (formula) =>
          formula.citationId !== undefined &&
          formula.citationId !== null &&
          formulaId.endsWith(formula.citationId),
      )
    )
  }

  function documentFor(sourceId: string): SpectrumEvidenceDocument {
    const source = sources.get(sourceId)
    if (!source) throw new Error(`Missing ${studyLabel} evidence source ${sourceId}`)
    const extract = config.extracts?.[sourceId]
    return {
      sourceId,
      issuingAuthority: source.issuingAuthority ?? null,
      title: source.officialTitle,
      edition: source.revision
        ? `${source.edition} · ${source.revision}`
        : source.edition,
      adoptionInstrument: source.adoptionInstrument ?? null,
      officialUrl: source.officialUrl,
      sourceUrl: source.officialUrl,
      sha256: source.sha256,
      localPath: extract?.path ?? null,
      localPageMap: extract ? { ...extract.pageMap } : null,
    }
  }

  function citationFor(citationId: string): SpectrumEvidenceCitation {
    const citation = citations.get(citationId)
    if (!citation) {
      throw new Error(`Missing ${studyLabel} evidence citation ${citationId}`)
    }
    const parent = citation.parentCitationId
      ? citations.get(citation.parentCitationId)
      : null
    const isTableRegion =
      citation.regionKind === "cell" || citation.regionKind === "row"
    return {
      id: citation.id,
      sourceId: citation.sourceDocumentId,
      kind: citationKind(citation.regionKind, citation.id),
      physicalPage: citation.physicalPage,
      printedPage: citation.printedPage ?? null,
      table: isTableRegion
        ? (parent?.reference ?? citation.reference).split(",")[0]
        : null,
      row: isTableRegion ? (parent?.reference ?? null) : null,
      cell: citation.regionKind === "cell" ? citation.extractedToken : null,
      reference: citation.reference,
      rect: citation.rect ?? null,
      transcription: citation.extractedToken,
    }
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

  function build(
    result: NormalizedSpectrumResultData,
    key: ScenarioEvidenceKey,
  ): SpectrumEvidenceView {
    const resolved = result.citationIds.map(citationFor)
    const citationById = new Map(resolved.map((citation) => [citation.id, citation]))
    const base = {
      schemaVersion: SPECTRUM_EVIDENCE_VIEW_SCHEMA_VERSION,
      key,
      study: {
        id: result.study.id,
        version: result.study.version,
        label: studyLabel,
      },
      selection: {
        optionId: key.optionId,
        location,
        zone: key.optionId ? config.zoneLabel(key.optionId) : null,
        hazardId: key.hazardId,
        hazardLabel: result.hazard?.label ?? null,
      },
    }

    // Nothing may accompany an unavailable view — assertEvidenceView rejects
    // documents, citations and lineage alike on one.
    if (result.evidenceAvailability.status === "unavailable") {
      return {
        ...base,
        status: "unavailable",
        documents: [],
        directValues: [],
        citations: [],
        metricLineage: [],
        branchLineage: [],
        unavailableClaims: unavailableClaims(result),
      }
    }

    // A blocked scenario still has sources and the warnings that block it; only
    // the lineage of a spectrum that was never computed drops out.
    if (result.status !== "ok") {
      return {
        ...base,
        status: result.evidenceAvailability.status,
        documents: result.sourceIds.map(documentFor),
        directValues: [],
        citations: resolved,
        metricLineage: [],
        branchLineage: [],
        unavailableClaims: unavailableClaims(result),
      }
    }

    const steps = result.trace?.data.steps ?? []
    const stepById = new Map(steps.map((step) => [step.id as string, step]))
    const directValues: SpectrumDirectValue[] = steps.flatMap((step) => {
      if ((step as { classification?: string }).classification !== "direct-source") {
        return []
      }
      const citationId = (step as { citationIds?: string[] }).citationIds?.[0]
      if (!citationId || !citationById.has(citationId)) return []
      return [
        {
          id: step.id as string,
          label: String((step as { label?: string }).label ?? step.id),
          value: (step as { value?: number }).value as number,
          normalizedInputPath: null,
          traceStepId: step.id as string,
          unit: ((step as { unit?: string }).unit ?? null) as SpectrumUnit | null,
          provenance: "direct-source" as const,
          citationId,
        },
      ]
    })

    const metricLineage: SpectrumMetricLineage[] = result.metrics
      .filter((metric) => metric.formulaId !== null)
      .map((metric) => {
        const step = metric.formulaId ? stepById.get(metric.formulaId) : undefined
        const formula = metric.formulaId ? formulaFor(metric.formulaId) : undefined
        const expression = (step as { expression?: string } | undefined)?.expression
        const citedReference = metric.citationIds
          .map((id) => citationById.get(id))
          .find(Boolean)?.reference
        return {
          id: metric.id,
          label: metric.label,
          value: metric.value,
          unit: metric.unit as SpectrumUnit,
          formulaId: metric.formulaId,
          formula: expression ?? formula?.expression ?? null,
          substitution:
            (step as { substitution?: string } | undefined)?.substitution ?? null,
          reference: formula?.citation?.reference ?? citedReference ?? null,
          dependencyIds: [...metric.dependencyIds],
          citationIds: [...metric.citationIds],
        }
      })

    const branchLineage: SpectrumBranchLineage[] = result.branches.map((branch) => {
      const points = result.points.filter(({ branchId }) => branchId === branch.id)
      if (points.length === 0) {
        throw new Error(`Spectrum branch has no normalized points: ${branch.id}`)
      }
      const formula = formulaFor(branch.formulaId)
      const citedReference = branch.citationIds
        .map((id) => citationById.get(id))
        .find(Boolean)?.reference
      return {
        branchId: branch.id,
        formulaId: branch.formulaId,
        formula: formula?.expression ?? null,
        condition: formula?.condition ?? formula?.domain ?? null,
        reference: formula?.citation?.reference ?? citedReference ?? null,
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
      citations: resolved,
      metricLineage,
      branchLineage,
      unavailableClaims: unavailableClaims(result),
    }
  }

  return {
    engineId,
    resolve: (result, key) => parseSpectrumEvidenceView(build(result, key)),
    validateRelations(result, key, view) {
      const expected = parseSpectrumEvidenceView(build(result, key))
      if (JSON.stringify(view) !== JSON.stringify(expected)) {
        throw new Error(
          `${studyLabel} evidence view does not match its installed source and trace model`,
        )
      }
      if (view.status === "unavailable") return
      const seen = new Set(view.citations.map(({ id }) => id))
      for (const citationId of result.citationIds) {
        if (!seen.has(citationId)) {
          throw new Error(
            `${studyLabel} evidence view omits result citation ${citationId}`,
          )
        }
      }
      // Every tabulated value the trace declares must reach the drawer.
      if (result.status === "ok") {
        const declared = (result.trace?.data.steps ?? []).filter(
          (step) =>
            (step as { classification?: string }).classification === "direct-source",
        ).length
        if (view.directValues.length !== declared) {
          throw new Error(
            `${studyLabel} evidence view carries ${view.directValues.length} of ${declared} direct values`,
          )
        }
      }
    },
  }
}
