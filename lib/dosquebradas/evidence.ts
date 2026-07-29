import manifestJson from "./evidence/manifest.json"

import type { NormalizedSpectrumResultData } from "../spectra/types"

type EvidenceManifest = {
  sources: { id: string }[]
  citations: { id: string }[]
}

const manifest = manifestJson as EvidenceManifest
const sourceIds = new Set(manifest.sources.map(({ id }) => id))
const citationIds = new Set(manifest.citations.map(({ id }) => id))

export const dosquebradasSourceIds = [
  "pot-2024-diagnostico-amenazas",
  "pot-2024-dts-general",
  "nsr10-title-a-2017",
] as const

export const dosquebradasFormulaCitation = {
  av: "nsr10-a.2.6-2",
  plateau: "nsr10-a.2.6-3",
  inverse: "nsr10-a.2.6-1",
} as const

export function dosquebradasCellCitation(zoneId: string, fieldId: string) {
  const id = `cell-${zoneId}-${fieldId}`
  if (!citationIds.has(id)) throw new Error(`Unknown Dosquebradas cell citation: ${id}`)
  return id
}

export function assertDosquebradasLineageResolves(
  result: NormalizedSpectrumResultData,
) {
  for (const id of result.sourceIds) {
    if (!sourceIds.has(id)) throw new Error(`Unknown Dosquebradas source: ${id}`)
  }
  for (const id of result.citationIds) {
    if (!citationIds.has(id)) throw new Error(`Unknown Dosquebradas citation: ${id}`)
  }
  if (!result.trace) return

  const stepIds = new Set(result.trace.data.steps.map(({ id }) => id))
  for (const step of result.trace.data.steps) {
    const candidate = step as {
      id: string
      classification?: string
      dependencies: string[]
      citationIds?: string[]
    }
    for (const dependency of candidate.dependencies) {
      if (!stepIds.has(dependency)) {
        throw new Error(`Dosquebradas trace dependency is unresolved: ${dependency}`)
      }
    }
    for (const id of candidate.citationIds ?? []) {
      if (!citationIds.has(id)) {
        throw new Error(`Dosquebradas trace citation is unresolved: ${id}`)
      }
    }
    if (candidate.classification === "derived" && !(candidate.citationIds?.length)) {
      throw new Error(`Derived Dosquebradas trace step has no citation: ${candidate.id}`)
    }
    if (candidate.classification === "direct-source") {
      const match = /^dosquebradas-(zona-[1-5])-(to|tc|tl|aa|fa|fv)$/.exec(
        candidate.id,
      )
      if (!match) throw new Error(`Unrecognized direct Dosquebradas step: ${candidate.id}`)
      const expected = dosquebradasCellCitation(match[1], match[2])
      if (
        candidate.dependencies.length !== 0 ||
        candidate.citationIds?.length !== 1 ||
        candidate.citationIds[0] !== expected
      ) {
        throw new Error(`Direct Dosquebradas step does not resolve exactly: ${candidate.id}`)
      }
    }
  }
}
