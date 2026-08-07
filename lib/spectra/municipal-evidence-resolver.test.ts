import { describe, expect, it } from "vitest"

import { resolveSpectrumEvidence } from "./evidence"
import { adaptDosquebradasSpectrum } from "../dosquebradas/adapter"
import { adaptMedellinSpectrum } from "../medellin"

describe("shared municipal evidence resolver", () => {
  it("resolves Medellín to its DAP support document and cited cells", () => {
    const result = adaptMedellinSpectrum({
      zoneId: "zone-01",
      hazardId: "design",
      importanceFactor: 1,
    })
    const evidence = resolveSpectrumEvidence(result)

    expect(evidence.selection.location).toBe("Medellín")
    expect(evidence.selection.zone).toContain("Noroccidental")
    expect(evidence.documents.length).toBeGreaterThan(0)
    // Every tabulated value the trace declares reaches the drawer.
    expect(evidence.directValues.length).toBe(6)
    expect(evidence.branchLineage.length).toBeGreaterThan(0)
    // The DAP support is external-only: cited, never shipped.
    expect(evidence.documents.every(({ localPath }) => localPath === null)).toBe(
      true,
    )
  })

  it("serves the two Tabla 27 pages behind the Dosquebradas coefficients", () => {
    const result = adaptDosquebradasSpectrum({
      zoneId: "zona-1",
      hazardId: "design",
      importanceFactor: 1,
    })
    const evidence = resolveSpectrumEvidence(result)

    const diagnostic = evidence.documents.find(
      ({ sourceId }) => sourceId === "pot-2024-diagnostico-amenazas",
    )
    expect(diagnostic?.localPath).toBe("/dosquebradas/pot-2024-tabla-27.pdf")
    expect(diagnostic?.localPageMap).toEqual({ "111": 1, "112": 2 })
    // The other locked sources stay pathless.
    for (const document of evidence.documents) {
      if (document.sourceId === diagnostic?.sourceId) continue
      expect(document.localPath, document.sourceId).toBeNull()
    }

    const cells = evidence.citations.filter(({ kind }) => kind === "cell")
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      // The drawer draws these over the extract, so they have to be attested.
      expect(cell.rect, cell.id).not.toBeNull()
      expect(diagnostic?.localPageMap?.[String(cell.physicalPage)]).toBeGreaterThan(0)
    }
  })
})
