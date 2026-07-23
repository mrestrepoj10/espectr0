import { describe, expect, it } from "vitest"

import {
  SPECTRUM_CONTRACT_SCHEMA_VERSION,
  SPECTRUM_EXPORT_SCHEMA_VERSION,
} from "./types"
import { adaptNsr10Spectrum } from "./nsr10-adapter"
import {
  formatSpectrumCsv,
  formatSpectrumEtabs,
  formatSpectrumJson,
  spectrumExportFilename,
  spectrumResultData,
} from "./export"

const context = {
  municipality: {
    code: "76001",
    municipio: "Cali",
    departamento: "Valle del Cauca",
  },
} as const
const params = {
  aa: 0.25,
  av: 0.25,
  ae: 0.15,
  ad: 0.09,
  soilProfile: "D",
  importanceGroup: "II",
} as const

describe("normalized contextual exports", () => {
  it("serializes the complete versioned result rather than an engine-specific trace", () => {
    const result = adaptNsr10Spectrum(params, context)
    const exported = JSON.parse(formatSpectrumJson(result))

    expect(exported).toMatchObject({
      schemaVersion: SPECTRUM_EXPORT_SCHEMA_VERSION,
      result: {
        schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
        status: "ok",
        scenarioEvidenceKey: {
          studyId: "nsr10-national",
          optionId: "76001",
          hazardId: "design",
        },
      },
    })
    expect(exported.result).not.toHaveProperty("saAt")
    expect(formatSpectrumJson(result).endsWith("\n")).toBe(true)
  })

  it("preserves NSR CSV and ETABS numerical columns from normalized points", () => {
    const result = adaptNsr10Spectrum(params, context)
    if (result.status !== "ok") throw new Error("Expected supported fixture")

    const csvLines = formatSpectrumCsv(result).split("\n")
    const etabsLines = formatSpectrumEtabs(result).split("\n")
    expect(csvLines[0]).toBe("T (s),Sa (g)")
    expect(csvLines[1]).toBe(
      `${result.points[0].tSeconds},${result.points[0].saG}`,
    )
    expect(etabsLines[0]).toBe(
      `${result.points[0].tSeconds}\t${result.points[0].saG}`,
    )
    expect(csvLines).toHaveLength(result.points.length + 1)
    expect(etabsLines).toHaveLength(result.points.length)
    expect(spectrumExportFilename(result, "csv")).toBe(
      "espectr0-76001-design.csv",
    )
    expect(spectrumExportFilename(result, "etabs.txt")).toBe(
      "espectr0-76001-design.etabs.txt",
    )
  })

  it("fails closed for unsupported capabilities and non-applicable spectra", () => {
    const ok = adaptNsr10Spectrum(params, context)
    expect(() =>
      formatSpectrumCsv({
        ...ok,
        capabilities: {
          ...ok.capabilities,
          csvExport: { supported: false, reason: "CSV disabled by study" },
        },
      }),
    ).toThrow("CSV disabled by study")

    const siteSpecific = adaptNsr10Spectrum(
      { ...params, soilProfile: "F" },
      context,
    )
    expect(() => formatSpectrumCsv(siteSpecific)).toThrow(/applicable/)
    expect(() => formatSpectrumEtabs(siteSpecific)).toThrow(/applicable/)
    expect(() => formatSpectrumJson(siteSpecific)).not.toThrow()
  })

  it("rejects evidence-key identity drift before export", () => {
    const result = adaptNsr10Spectrum(params, context)
    expect(() =>
      spectrumResultData({
        ...result,
        scenarioEvidenceKey: {
          ...result.scenarioEvidenceKey,
          studyId: "ccp14",
        },
      }),
    ).toThrow()
  })
})
