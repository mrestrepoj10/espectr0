import manifestData from "../nsr10/evidence/manifest.json"
import { calculationTraceSchema } from "../nsr10"
import {
  getMunicipalityTraceability,
  getNormativeCitation,
} from "../nsr10/evidence"
import { sourceEvidenceManifestSchema } from "../nsr10/evidence/schema"

import type {
  CalculationTrace,
  CalculationTraceContext,
  SpectrumParams,
} from "../nsr10"
import type { NormalizedSpectrumResultData } from "./types"

export const NSR10_EVIDENCE_COMPATIBILITY_SCHEMA_VERSION = 1 as const
export const NSR10_ENGINE_ID = "nsr10-existing-adapter" as const
export const NSR10_SOURCE_ID = "nsr10:manifest-v4:source" as const
export const NSR10_TRACE_SCHEMA_ID = "nsr10:calculation-trace" as const

const manifest = sourceEvidenceManifestSchema.parse(manifestData)

export const nsr10EvidenceCompatibility = {
  schemaVersion: NSR10_EVIDENCE_COMPATIBILITY_SCHEMA_VERSION,
  sources: {
    [NSR10_SOURCE_ID]: {
      manifestSchemaVersion: manifest.schemaVersion,
      pdfSha256: manifest.source.pdfSha256,
      source: manifest.source,
    },
  },
} as const

export function nsr10MunicipalityCitationId(code: string) {
  return `nsr10:manifest-v4:municipality:${code}`
}

export function resolveNsr10SourceId(id: string) {
  return id === NSR10_SOURCE_ID
    ? nsr10EvidenceCompatibility.sources[NSR10_SOURCE_ID]
    : undefined
}

export function resolveNsr10CitationId(id: string) {
  const municipalityPrefix = "nsr10:manifest-v4:municipality:"
  if (id.startsWith(municipalityPrefix)) {
    return getMunicipalityTraceability(id.slice(municipalityPrefix.length))
  }
  const normativePrefix = "nsr10:manifest-v4:normative:"
  if (id.startsWith(normativePrefix)) {
    return getNormativeCitation(id.slice(normativePrefix.length))
  }
  return undefined
}

export function resolveNsr10FormulaId(trace: CalculationTrace, id: string) {
  return (
    trace.steps.find((step) => step.id === id) ??
    trace.branches.find((branch) => branch.id === id)
  )
}

export function resolveNsr10DependencyId(trace: CalculationTrace, id: string) {
  return trace.steps.find((step) => step.id === id)
}

export function parseNsr10TraceEnvelope(trace: {
  schemaId: string
  schemaVersion: number
  data: unknown
}) {
  if (trace.schemaId !== NSR10_TRACE_SCHEMA_ID) {
    throw new Error(`Unexpected NSR-10 trace schema: ${trace.schemaId}`)
  }
  const parsed = calculationTraceSchema.parse(trace.data)
  if (parsed.schemaVersion !== trace.schemaVersion) {
    throw new Error("NSR-10 trace envelope version does not match its payload")
  }
  for (const [kind, entries] of [
    ["step", parsed.steps],
    ["branch", parsed.branches],
  ] as const) {
    const ids = new Set<string>()
    for (const entry of entries) {
      if (ids.has(entry.id)) {
        throw new Error(`Duplicate NSR-10 trace ${kind} ID: ${entry.id}`)
      }
      ids.add(entry.id)
    }
  }
  return parsed
}

export function validateNsr10MunicipalityContext(
  params: SpectrumParams,
  context: CalculationTraceContext,
) {
  const supplied = context.municipality
  if (!supplied) return null

  const traceability = getMunicipalityTraceability(supplied.code)
  if (!traceability) {
    throw new RangeError(`No approved NSR-10 municipality evidence for ${supplied.code}`)
  }
  const canonical = traceability.municipality
  if (
    canonical.municipio !== supplied.municipio ||
    canonical.departamento !== supplied.departamento
  ) {
    throw new RangeError(
      `Municipality context does not match approved NSR-10 record ${supplied.code}`,
    )
  }

  const suppliedCoefficients = [
    ["Aa", params.aa, canonical.aa],
    ["Av", params.av, canonical.av],
    ...(params.ae === undefined ? [] : [["Ae", params.ae, canonical.ae]]),
    ...(params.ad === undefined ? [] : [["Ad", params.ad, canonical.ad]]),
  ] as const
  for (const [label, suppliedValue, canonicalValue] of suppliedCoefficients) {
    if (suppliedValue !== canonicalValue) {
      throw new RangeError(
        `${label} does not match approved NSR-10 municipality ${supplied.code}`,
      )
    }
  }

  return {
    citationId: nsr10MunicipalityCitationId(supplied.code),
    traceability,
  }
}

export function assertNsr10LineageResolves(
  result: NormalizedSpectrumResultData,
): void {
  for (const id of result.sourceIds) {
    if (!resolveNsr10SourceId(id)) throw new Error(`Unresolved NSR-10 source ID: ${id}`)
  }
  for (const id of result.citationIds) {
    if (!resolveNsr10CitationId(id)) {
      throw new Error(`Unresolved NSR-10 citation ID: ${id}`)
    }
  }
  if (result.status !== "ok") return
  const trace = result.trace.data as unknown as CalculationTrace
  const stepById = new Map(trace.steps.map((step) => [step.id, step]))
  for (const id of result.formulaIds) {
    if (!resolveNsr10FormulaId(trace, id)) {
      throw new Error(`Unresolved NSR-10 formula ID: ${id}`)
    }
  }
  for (const metric of result.metrics) {
    if (metric.formulaId !== null) {
      const formulaStep = stepById.get(metric.formulaId)
      if (!formulaStep) {
        throw new Error(
          `NSR-10 metric formula does not resolve to a trace step: ${metric.formulaId}`,
        )
      }
      if (
        metric.dependencyIds.length !== formulaStep.dependencies.length ||
        metric.dependencyIds.some(
          (dependencyId, index) =>
            dependencyId !== formulaStep.dependencies[index],
        )
      ) {
        throw new Error(
          `NSR-10 metric dependencies do not match formula ${metric.formulaId}`,
        )
      }
    }
    for (const id of metric.dependencyIds) {
      if (!resolveNsr10DependencyId(trace, id)) {
        throw new Error(`Unresolved NSR-10 dependency ID: ${id}`)
      }
    }
  }
}
