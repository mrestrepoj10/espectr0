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

  it("keeps a formula citation's rect and equation over the claim that repeats it", () => {
    const evidence = resolveSpectrumEvidence(
      adaptMedellinSpectrum({
        zoneId: "zone-01",
        hazardId: "design",
        importanceFactor: 1,
      }),
    )

    // The claims matrix repeats every equation id; the claim label carries no
    // rectangle and no transcription, so the formula entry has to win.
    const equation = evidence.citations.find(({ id }) => id === "equation-plateau")
    expect(equation?.kind).toBe("equation")
    expect(equation?.rect).not.toBeNull()
    expect(equation?.transcription).toContain("Smax")
  })

  it("reads a branch range whichever field the inventory spells it in", () => {
    const evidence = resolveSpectrumEvidence(
      adaptDosquebradasSpectrum({
        zoneId: "zona-1",
        hazardId: "design",
        importanceFactor: 1,
      }),
    )

    // Dosquebradas names its branches by citation and records the range under
    // `condition`; reading only `id`/`domain` emptied both fields.
    expect(evidence.branchLineage.map(({ formula, condition }) => [formula, condition]))
      .toEqual([
        ["Sa = 2.5 × Aa × Fa × I", "To <= T <= Tc"],
        ["Sa = 1.2 × Av × Fv × I / T", "Tc < T <= TL"],
      ])
  })

  it("returns an empty view when a study declares no resolvable evidence", () => {
    for (const result of [
      adaptMedellinSpectrum({
        zoneId: "not-a-zone",
        hazardId: "design",
        importanceFactor: 1,
      }),
      adaptDosquebradasSpectrum({
        zoneId: "not-a-zone",
        hazardId: "design",
        importanceFactor: 1,
      }),
    ]) {
      const evidence = resolveSpectrumEvidence(result)
      // An unavailable view may carry nothing at all, so declared sourceIds
      // must not reach it — assertEvidenceView throws on any that do.
      expect(evidence.status).toBe("unavailable")
      expect(evidence.documents).toHaveLength(0)
      expect(evidence.citations).toHaveLength(0)
      expect(evidence.unavailableClaims.length).toBeGreaterThan(0)
    }
  })
})
