import { describe, expect, it } from "vitest"

import { resolveSpectrumEvidence } from "../spectra/evidence"
import { adaptBogotaSpectrum } from "./adapter"
import { bogotaLegendRowBand, bogotaZoneLabel } from "./map-evidence"
import { bogotaCanonical } from "./schema"

const cerros = {
  zoneId: "cerros",
  hazardId: "design",
  importanceFactor: 1,
  fillThicknessMeters: null,
  rigidBasePeriodSeconds: null,
}

describe("Bogotá evidence resolver", () => {
  it("declares the FOPAE report and both decrees with their locked hashes", () => {
    const evidence = resolveSpectrumEvidence(adaptBogotaSpectrum(cerros))

    expect(evidence.status).toBe("available")
    expect(evidence.study.label).toContain("Bogotá")
    expect(evidence.selection.location).toBe("Bogotá D.C.")
    expect(evidence.selection.zone).toBe("CERROS")

    const report = evidence.documents.find(
      ({ sourceId }) => sourceId === "fopae-2010-final-report-v1",
    )
    expect(report?.issuingAuthority).toContain("FOPAE")
    expect(report?.adoptionInstrument).toContain("Decreto Distrital 523 de 2010")
    expect(report?.sha256).toMatch(/^[a-f0-9]{64}$/)
    // The official files are external-only, so pages are cited, never shipped.
    expect(evidence.documents.every(({ localPath }) => localPath === null)).toBe(
      true,
    )
  })

  it("resolves every result citation to an attested page of the report", () => {
    const result = adaptBogotaSpectrum(cerros)
    const evidence = resolveSpectrumEvidence(result)

    expect(result.status).toBe("ok")
    expect(evidence.citations.map(({ id }) => id)).toEqual(result.citationIds)
    for (const citation of evidence.citations) {
      expect(citation.physicalPage).toBeGreaterThan(0)
      expect(citation.transcription.length).toBeGreaterThan(0)
    }
  })

  it("binds the tabulated coefficients to the cells of Tabla 7.5", () => {
    const evidence = resolveSpectrumEvidence(adaptBogotaSpectrum(cerros))

    const byId = new Map(evidence.directValues.map((value) => [value.id, value]))
    const fa = byId.get("value-design-cerros-fa")
    const fv = byId.get("value-design-cerros-fv")
    expect(fa?.value).toBe(1.35)
    expect(fv?.value).toBe(1.3)
    expect(fa?.provenance).toBe("direct-source")

    const cell = evidence.citations.find(({ id }) => id === fa?.citationId)
    expect(cell?.physicalPage).toBe(155)
    expect(cell?.printedPage).toBe("139")
    // The drawer draws this rectangle over the page, so it has to be attested.
    expect(cell?.rect).not.toBeNull()
  })

  it("carries the branch and metric lineage the memoria prints", () => {
    const evidence = resolveSpectrumEvidence(adaptBogotaSpectrum(cerros))

    expect(evidence.branchLineage.length).toBeGreaterThan(0)
    for (const branch of evidence.branchLineage) {
      expect(branch.formula).not.toBeNull()
      expect(branch.condition).not.toBeNull()
      expect(branch.pointCount).toBeGreaterThan(0)
    }
    const plateau = evidence.metricLineage.find(({ id }) => id === "sa-plateau")
    expect(plateau?.formula).toContain("Sa =")
    expect(plateau?.reference).toContain("Tabla 7.5")
  })

  it("measures one legend row per published zone, in printed order", () => {
    const bands = bogotaCanonical.options.map(({ id }) => ({
      id,
      band: bogotaLegendRowBand(id),
    }))
    expect(bands).toHaveLength(16)
    // The label is the table's transcription, unaccented as printed there.
    expect(bogotaZoneLabel("deposito-ladera")).toBe("DEPOSITO LADERA")

    // Rows must not overlap, or the highlight lands between two swatches.
    let previousBottom = 0
    for (const { id, band } of bands) {
      expect(band.height, id).toBeGreaterThan(0)
      expect(band.top, id).toBeGreaterThan(previousBottom)
      previousBottom = band.top + band.height
      expect(previousBottom, id).toBeLessThan(1)
    }
  })

  it("resolves every published zone and hazard combination", () => {
    for (const zoneId of ["cerros", "lacustre-500", "deposito-ladera"]) {
      for (const hazardId of ["design", "limited-safety", "damage-threshold"]) {
        const result = adaptBogotaSpectrum({ ...cerros, zoneId, hazardId })
        if (result.status !== "ok") continue
        const evidence = resolveSpectrumEvidence(result)
        expect(evidence.status).toBe("available")
        expect(evidence.directValues.length).toBeGreaterThan(0)
      }
    }
  })
})
