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
