import {
  SPECTRUM_EXPORT_SCHEMA_VERSION,
  normalizedSpectrumResultDataSchema,
  spectrumExportSchema,
} from "./types"
import {
  NSR10_ENGINE_ID,
  assertNsr10LineageResolves,
  parseNsr10TraceEnvelope,
} from "./nsr10-evidence"

import type {
  NormalizedSpectrumResult,
  NormalizedSpectrumResultData,
  SpectrumExport,
} from "./types"
import type { SpectrumCapabilityKey } from "./capabilities"

type SuccessfulSpectrumResult = Extract<NormalizedSpectrumResult, { status: "ok" }>

export function spectrumResultData(
  result: NormalizedSpectrumResult,
): NormalizedSpectrumResultData {
  const data = { ...result }
  Reflect.deleteProperty(data, "saAt")
  const parsed = normalizedSpectrumResultDataSchema.parse(data)
  if (parsed.engine.id === NSR10_ENGINE_ID) {
    if (parsed.status === "ok") parseNsr10TraceEnvelope(parsed.trace)
    else if (parsed.trace) parseNsr10TraceEnvelope(parsed.trace)
    assertNsr10LineageResolves(parsed)
  }
  return parsed
}

export function createSpectrumExport(result: NormalizedSpectrumResult): SpectrumExport {
  return spectrumExportSchema.parse({
    schemaVersion: SPECTRUM_EXPORT_SCHEMA_VERSION,
    result: spectrumResultData(result),
  })
}

export function assertSpectrumExportCapability(
  result: NormalizedSpectrumResult,
  capability: SpectrumCapabilityKey,
) {
  const decision = result.capabilities[capability]
  if (!decision.supported) {
    throw new Error(decision.reason)
  }
}

function successfulResult(
  result: NormalizedSpectrumResult,
  capability: SpectrumCapabilityKey,
): SuccessfulSpectrumResult {
  assertSpectrumExportCapability(result, capability)
  if (result.status !== "ok") {
    throw new Error(
      `Export ${capability} requires an applicable normalized spectrum result.`,
    )
  }
  return result
}

function slugifyExportPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function spectrumExportFilename(
  result: NormalizedSpectrumResult,
  suffix: "json" | "csv" | "etabs.txt" | "svg" | "png" | "pdf",
) {
  const option = result.scenarioEvidenceKey.optionId ?? result.study.id
  const hazard = result.scenarioEvidenceKey.hazardId ?? "sin-amenaza"
  return `espectr0-${slugifyExportPart(option)}-${slugifyExportPart(hazard)}.${suffix}`
}

export function formatSpectrumJson(result: NormalizedSpectrumResult) {
  assertSpectrumExportCapability(result, "jsonExport")
  return `${JSON.stringify(createSpectrumExport(result), null, 2)}\n`
}

export function formatSpectrumCsv(result: NormalizedSpectrumResult) {
  const successful = successfulResult(result, "csvExport")
  const rows = successful.points.map(
    ({ tSeconds, saG }) => `${tSeconds},${saG}`,
  )
  return ["T (s),Sa (g)", ...rows].join("\n")
}

export function formatSpectrumEtabs(result: NormalizedSpectrumResult) {
  const successful = successfulResult(result, "etabsExport")
  return successful.points
    .map(({ tSeconds, saG }) => `${tSeconds}\t${saG}`)
    .join("\n")
}
