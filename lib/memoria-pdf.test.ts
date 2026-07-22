import { describe, expect, it } from "vitest"

import { computeCalculationTrace, lookupMunicipioByCode } from "./nsr10"
import {
  calculationMemoriaFilename,
  collectMemoriaSource,
  createSpectrumChartGeometry,
  flattenTracePoints,
  normalizePdfText,
  selectRepresentativeBoundaryPoints,
  slugifyPdfPart,
} from "./memoria-pdf"

function caliTrace() {
  const municipality = lookupMunicipioByCode("76001")
  if (!municipality) throw new Error("Cali fixture is missing")
  const trace = computeCalculationTrace(
    {
      aa: municipality.aa,
      av: municipality.av,
      ae: municipality.ae,
      ad: municipality.ad,
      hazardLevel: "design",
      soilProfile: "D",
      importanceGroup: "I",
      mode: "general",
    },
    { municipality },
  )
  if ("status" in trace) throw new Error("Supported fixture returned no trace")
  return trace
}

describe("calculation memoria PDF helpers", () => {
  it("builds a stable ASCII filename", () => {
    const trace = caliTrace()
    expect(slugifyPdfPart("San Andrés y Providencia")).toBe(
      "san-andres-y-providencia",
    )
    expect(calculationMemoriaFilename(trace)).toBe(
      "espectr0-memoria-cali-design.pdf",
    )
  })

  it("selects branch-boundary checks but not the chart endpoint", () => {
    const selected = selectRepresentativeBoundaryPoints(caliTrace())
    expect(selected.map(({ point }) => point.t)).toEqual([
      0,
      selected[1].point.t,
      selected[2].point.t,
    ])
    expect(selected.map(({ step }) => step.id)).toEqual([
      "sa-at-0",
      expect.stringMatching(/^sa-at-/),
      expect.stringMatching(/^sa-at-/),
    ])
  })

  it("creates a bounded SVG path from all trace points", () => {
    const points = flattenTracePoints(caliTrace())
    const geometry = createSpectrumChartGeometry(points, 500, 220)
    expect(points.length).toBeGreaterThan(100)
    expect(geometry.path).toMatch(/^M 38\.00 /)
    expect(geometry.path.split(" L ")).toHaveLength(points.length)
    expect(geometry.plotLeft + geometry.plotWidth).toBeLessThanOrEqual(500)
    expect(geometry.plotTop + geometry.plotHeight).toBeLessThanOrEqual(220)
  })

  it("reuses the pinned Appendix A-4 municipality citation", () => {
    expect(collectMemoriaSource(caliTrace())).toMatchObject({
      appendix: "Apéndice A-4",
      municipalityPage: 191,
      municipalityPrintedPage: "A-177",
      pdfSha256: "47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0",
    })
  })

  it("normalizes unsupported dash variants while retaining superscripts", () => {
    expect(normalizePdfText("0 ≤ T − T² — prueba")).toBe(
      "0 <= T - T² - prueba",
    )
  })
})
