import {
  SPECTRUM_EXPORT_SCHEMA_VERSION,
  normalizedSpectrumResultDataSchema,
  spectrumExportSchema,
} from "./types"

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
  return normalizedSpectrumResultDataSchema.parse(data)
}

export function createSpectrumExport(result: NormalizedSpectrumResult): SpectrumExport {
  return spectrumExportSchema.parse({
    schemaVersion: SPECTRUM_EXPORT_SCHEMA_VERSION,
    result: spectrumResultData(result),
  })
}
