import { createMunicipalEvidenceResolver } from "../spectra/municipal-evidence-resolver"

import canonical from "./data/canonical.json"
import formulaInventory from "./evidence/formula-inventory.json"
import claimsMatrix from "./evidence/claims-matrix.json"
import manifest from "./evidence/manifest.json"

type Rect = { left: number; top: number; width: number; height: number }

/**
 * Equations and applicability regions live outside the manifest here, and the
 * claims matrix repeats the equation ids. The formula entries come last so they
 * win the lookup: they carry the attested rectangle and the transcribed
 * equation that a claim label would replace with a short phrase.
 */
const extraCitations = [
  ...claimsMatrix.claims.map((claim) => ({
    id: claim.citation.citationId,
    sourceDocumentId: claim.citation.sourceDocumentId,
    regionKind: "applicability",
    physicalPage: claim.citation.physicalPage,
    printedPage: claim.citation.printedPage,
    reference: claim.claim,
    rect: null,
    extractedToken: claim.claim,
  })),
  ...formulaInventory.formulas.map(({ citation, expression }) => ({
    id: citation.citationId,
    sourceDocumentId: citation.sourceDocumentId,
    regionKind: citation.regionKind,
    physicalPage: citation.physicalPage,
    printedPage: citation.printedPage,
    reference: citation.reference,
    rect: citation.rect as Rect | null,
    extractedToken: expression ?? citation.reference,
  })),
]

/**
 * Declared here rather than imported from the adapter: the adapter pulls in
 * study-relations, which registers this resolver, so importing back would leave
 * the identifier undefined at registration time.
 */
const MEDELLIN_ENGINE_ID = "medellin-spectrum"

const zoneLabels = new Map(
  canonical.options.map((option) => [option.id, `${option.sourceLabel} — ${option.description}`]),
)

export const medellinEvidenceResolver = createMunicipalEvidenceResolver({
  engineId: MEDELLIN_ENGINE_ID,
  studyLabel: "Microzonificación sísmica del área urbana de Medellín",
  location: "Medellín",
  sources: manifest.sources,
  citations: manifest.citations,
  formulas: formulaInventory.formulas,
  extraCitations,
  zoneLabel: (optionId) => zoneLabels.get(optionId) ?? optionId,
})
