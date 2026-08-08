import manifestJson from "./evidence/manifest.json"

import type { NormalizedSpectrumResultData } from "../spectra/types"

type EvidenceManifest = {
  sources: { id: string }[]
  citations: { id: string }[]
}

const manifest = manifestJson as EvidenceManifest
const sourceIds = new Set(manifest.sources.map(({ id }) => id))
const citationIds = new Set(manifest.citations.map(({ id }) => id))

export const manizalesSourceIds = [
  "manizales-uniandes-2002-figuras",
  "manizales-uniandes-2002",
  "nsr10-title-a-2017",
] as const

export const manizalesFormulaCitation = {
  entrance: "equation-entrance",
  plateau: "equation-plateau",
  inverse: "equation-inverse",
  floor: "equation-floor",
} as const

export function manizalesCellCitation(zoneId: string, fieldId: string) {
  const id = `cell-${zoneId}-${fieldId}`
  if (!citationIds.has(id)) throw new Error(`Unknown Manizales cell citation: ${id}`)
  return id
}

export function assertManizalesLineageResolves(result: NormalizedSpectrumResultData) {
  for (const id of result.sourceIds) {
    if (!sourceIds.has(id)) throw new Error(`Unknown Manizales source: ${id}`)
  }
  for (const id of result.citationIds) {
    if (!citationIds.has(id)) throw new Error(`Unknown Manizales citation: ${id}`)
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
        throw new Error(`Manizales trace dependency is unresolved: ${dependency}`)
      }
    }
    for (const id of candidate.citationIds ?? []) {
      if (!citationIds.has(id)) {
        throw new Error(`Manizales trace citation is unresolved: ${id}`)
      }
    }
    if (candidate.classification === "derived" && !candidate.citationIds?.length) {
      throw new Error(`Derived Manizales trace step has no citation: ${candidate.id}`)
    }
    if (candidate.classification === "direct-source") {
      const match = /^manizales-(zone-[abc])-(to|tc|tl|am|an|fa|fv)$/.exec(candidate.id)
      if (!match) throw new Error(`Unrecognized direct Manizales step: ${candidate.id}`)
      const expected = manizalesCellCitation(match[1], match[2])
      if (
        candidate.dependencies.length !== 0 ||
        candidate.citationIds?.length !== 1 ||
        candidate.citationIds[0] !== expected
      ) {
        throw new Error(`Direct Manizales step does not resolve exactly: ${candidate.id}`)
      }
    }
  }
}
