import claimsJson from "./evidence/claims-matrix.json"
import manifestJson from "./evidence/manifest.json"

import type { NormalizedSpectrumResultData } from "../spectra/types"

type Manifest = {
  sources: { id: string }[]
  citations: { id: string }[]
}
type Claims = { claims: { id: string }[] }

const manifest = manifestJson as Manifest
const claims = claimsJson as Claims
const sourceIds = new Set(manifest.sources.map(({ id }) => id))
const citationIds = new Set([
  ...manifest.citations.map(({ id }) => id),
  ...claims.claims.map(({ id }) => id),
])

export const medellinSourceIds = ["medellin-dap-2011-support"] as const

export const medellinFormulaCitation = {
  smax: "equation-plateau",
  plateau: "figure-spectrum-branches",
  decay: "equation-tail",
} as const

export function medellinCellCitation(
  hazardId: string,
  zoneId: string,
  fieldId: string,
) {
  const id = `cell-${hazardId}-${zoneId}-${fieldId}`
  if (!citationIds.has(id)) throw new Error(`Unknown Medellín cell citation: ${id}`)
  return id
}

export function assertMedellinLineageResolves(
  result: NormalizedSpectrumResultData,
) {
  for (const id of result.sourceIds) {
    if (!sourceIds.has(id)) throw new Error(`Unknown Medellín source: ${id}`)
  }
  for (const id of result.citationIds) {
    if (!citationIds.has(id)) throw new Error(`Unknown Medellín citation: ${id}`)
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
        throw new Error(`Medellín trace dependency is unresolved: ${dependency}`)
      }
    }
    for (const id of candidate.citationIds ?? []) {
      if (!citationIds.has(id)) {
        throw new Error(`Medellín trace citation is unresolved: ${id}`)
      }
    }
    if (candidate.classification === "derived" && !candidate.citationIds?.length) {
      throw new Error(`Derived Medellín trace step has no citation: ${candidate.id}`)
    }
    if (candidate.classification === "direct-source") {
      const match = /^medellin-(design|damage-control)-(zone-\d{2})-(ground_peak|short_amplification|plateau_per_importance|plateau_start|decay_start|decay_exponent)$/.exec(
        candidate.id,
      )
      if (!match) throw new Error(`Unrecognized direct Medellín step: ${candidate.id}`)
      const expected = medellinCellCitation(match[1], match[2], match[3])
      if (
        candidate.dependencies.length !== 0 ||
        candidate.citationIds?.length !== 1 ||
        candidate.citationIds[0] !== expected
      ) {
        throw new Error(`Direct Medellín step does not resolve exactly: ${candidate.id}`)
      }
    }
  }
}
