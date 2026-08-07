import { describe, expect, it } from "vitest"

import { resolveSpectrumEvidence } from "../spectra/evidence"
import { adaptCcp14Spectrum } from "./adapter"

const generalProcedureInput = {
  pgaG: 0.3,
  ssG: 0.75,
  s1G: 0.3,
  soilClass: "D" as const,
}

describe("CCP-14 evidence resolver", () => {
  it("declares both official documents with their locked hashes", () => {
    const result = adaptCcp14Spectrum(generalProcedureInput)
    const evidence = resolveSpectrumEvidence(result)

    expect(evidence.status).toBe("available")
    expect(evidence.study.label).toContain("CCP-14")
    expect(evidence.documents.map(({ sourceId }) => sourceId)).toEqual([
      "mintransporte-resolution-108-2015-invias-copy",
      "invias-ccp14-section-3",
    ])
    const [resolution, section3] = evidence.documents
    expect(resolution.adoptionInstrument).toBe("Resolución 0000108 de 2015")
    expect(resolution.sha256).toBe(
      "e17c4aa764716c5533cb82499984f87e4eda032888c91544fab10b804d5a753a",
    )
    expect(section3.issuingAuthority).toBe("Instituto Nacional de Vías (INVÍAS)")
    expect(section3.sha256).toBe(
      "55f53d68dfc568a930b726b0c7dba510ea608128490353bf604f827a27ffc8ca",
    )
    expect(section3.sourceUrl).toContain("idFile=29584")
    // The official bytes are external-only, so the memoria cites pages it never redistributes.
    expect(evidence.documents.every(({ localPath }) => localPath === null)).toBe(true)
  })

  it("records the declared map location and cites the three figures", () => {
    const evidence = resolveSpectrumEvidence(
      adaptCcp14Spectrum({ ...generalProcedureInput, mapLocationId: "neiva" }),
    )

    expect(evidence.selection.location).toBe("Neiva")
    expect(evidence.selection.zone).toBe("Perfil de sitio D")
    expect(
      evidence.citations
        .filter(({ id }) => id.startsWith("claim-map-figure-"))
        .map(({ id, physicalPage, printedPage }) => [id, physicalPage, printedPage]),
    ).toEqual([
      ["claim-map-figure-pga", 51, "3-47"],
      ["claim-map-figure-ss", 52, "3-48"],
      ["claim-map-figure-s1", 53, "3-49"],
    ])
    expect(
      evidence.citations.find(({ id }) => id === "claim-map-location-labels")
        ?.transcription,
    ).toContain("Rotular un lugar no le asigna un coeficiente")
  })

  it("leaves the location null when none was declared", () => {
    const evidence = resolveSpectrumEvidence(
      adaptCcp14Spectrum(generalProcedureInput),
    )

    expect(evidence.selection.location).toBeNull()
  })

  it("resolves every result citation to an attested page of the publication", () => {
    const result = adaptCcp14Spectrum(generalProcedureInput)
    const evidence = resolveSpectrumEvidence(result)

    expect(result.status).toBe("ok")
    expect(evidence.citations.map(({ id }) => id)).toEqual(result.citationIds)
    for (const citation of evidence.citations) {
      expect(citation.physicalPage).toBeGreaterThan(0)
      expect(citation.transcription.length).toBeGreaterThan(0)
    }
    const mapInputs = evidence.citations.find(({ id }) => id === "claim-map-inputs")
    expect(mapInputs).toMatchObject({
      printedPage: "3-46",
      physicalPage: 50,
      reference: "CCP-14 3.10.2.1 — Procedimiento General",
    })
    const t0Figure = evidence.citations.find(({ id }) => id === "conflict-t0-figure")
    const t0Definition = evidence.citations.find(
      ({ id }) => id === "conflict-t0-definition",
    )
    expect(t0Figure?.physicalPage).toBe(60)
    expect(t0Definition?.physicalPage).toBe(60)
    expect(t0Figure?.rect).not.toBeNull()
  })

  it("backs the coefficients the figure states at the location itself", () => {
    const evidence = resolveSpectrumEvidence(
      adaptCcp14Spectrum({
        pgaG: 0.05,
        ssG: 0.1,
        s1G: 0.05,
        soilClass: "B",
        mapLocationId: "san-andres-y-providencia",
      }),
    )

    expect(
      evidence.directValues
        .filter(({ unit }) => unit === "g")
        .map(({ label, value, citationId }) => ({ label, value, citationId })),
    ).toEqual([
      { label: "PGA", value: 0.05, citationId: "map-inset-san-andres-pga" },
      { label: "Ss", value: 0.1, citationId: "map-inset-san-andres-ss" },
      { label: "S1", value: 0.05, citationId: "map-inset-san-andres-s1" },
    ])
    const citation = evidence.citations.find(
      ({ id }) => id === "map-inset-san-andres-pga",
    )
    expect(citation).toMatchObject({ physicalPage: 51, printedPage: "3-47" })
    // The drawer draws this rectangle over the page, so it has to be attested.
    expect(citation?.rect).not.toBeNull()
    expect(citation?.transcription).toContain("región 1")
  })

  it("drops the backing when the engineer overrides a stated coefficient", () => {
    const evidence = resolveSpectrumEvidence(
      adaptCcp14Spectrum({
        pgaG: 0.08,
        ssG: 0.1,
        s1G: 0.05,
        soilClass: "B",
        mapLocationId: "san-andres-y-providencia",
      }),
    )

    // Ss and S1 still match the legend; the edited PGA no longer does.
    expect(
      evidence.directValues.filter(({ unit }) => unit === "g").map(({ label }) => label),
    ).toEqual(["Ss", "S1"])
    expect(evidence.citations.map(({ id }) => id)).not.toContain(
      "map-inset-san-andres-pga",
    )
  })

  it("quotes the printed legend for a coefficient read as a whole region", () => {
    const evidence = resolveSpectrumEvidence(
      adaptCcp14Spectrum({
        ...generalProcedureInput,
        pgaG: 0.3,
        pgaRegion: 6,
        ssG: 0.7,
        ssRegion: 7,
      }),
    )

    expect(
      evidence.directValues
        .filter(({ unit }) => unit === "g")
        .map(({ label, value, citationId }) => ({ label, value, citationId })),
    ).toEqual([
      { label: "PGA · región 6", value: 0.3, citationId: "map-legend-pga" },
      { label: "Ss · región 7", value: 0.7, citationId: "map-legend-ss" },
    ])
    const legend = evidence.citations.find(({ id }) => id === "map-legend-pga")
    expect(legend).toMatchObject({ physicalPage: 51, printedPage: "3-47" })
    expect(legend?.rect).not.toBeNull()
    expect(legend?.transcription).toContain("no indica en qué región")
  })

  it("refuses to quote the legend for a region that does not state that value", () => {
    const evidence = resolveSpectrumEvidence(
      adaptCcp14Spectrum({ ...generalProcedureInput, pgaG: 0.27, pgaRegion: 6 }),
    )

    // 0.27 is interpolated between contours, so region 6 does not state it.
    expect(evidence.directValues.some(({ unit }) => unit === "g")).toBe(false)
    expect(evidence.citations.map(({ id }) => id)).not.toContain("map-legend-pga")
  })

  it("claims no map backing for a location the figures only label", () => {
    const evidence = resolveSpectrumEvidence(
      adaptCcp14Spectrum({ ...generalProcedureInput, mapLocationId: "neiva" }),
    )

    expect(evidence.directValues.every(({ unit }) => unit === "dimensionless")).toBe(true)
  })

  it("binds exactly tabulated site factors as direct source values", () => {
    const evidence = resolveSpectrumEvidence(adaptCcp14Spectrum(generalProcedureInput))

    expect(
      evidence.directValues.map(({ label, value, citationId }) => ({
        label,
        value,
        citationId,
      })),
    ).toEqual([
      { label: "Fpga", value: 1.2, citationId: "fpga-cell-d-3" },
      { label: "Fa", value: 1.2, citationId: "fa-cell-d-3" },
      { label: "Fv", value: 1.8, citationId: "fv-cell-d-3" },
    ])
  })

  it("keeps interpolated site factors out of direct source evidence", () => {
    const evidence = resolveSpectrumEvidence(
      adaptCcp14Spectrum({ ...generalProcedureInput, pgaG: 0.35 }),
    )

    expect(evidence.directValues.map(({ label }) => label)).toEqual(["Fa", "Fv"])
  })

  it("carries the branch and metric lineage the memoria prints", () => {
    const evidence = resolveSpectrumEvidence(adaptCcp14Spectrum(generalProcedureInput))

    expect(evidence.metricLineage.map(({ id }) => id)).toEqual([
      "as",
      "sds",
      "sd1",
      "ts",
      "t0",
      "performanceZone",
    ])
    expect(
      evidence.metricLineage.find(({ id }) => id === "sds"),
    ).toMatchObject({
      formula: "SDS = Fa × Ss",
      reference: "CCP-14 Ec. 3.10.4.2-3",
    })
    expect(
      evidence.branchLineage.map(({ branchId, condition }) => [branchId, condition]),
    ).toEqual([
      ["initial-linear", "T <= T0"],
      ["plateau", "T0 <= T <= Ts"],
      ["inverse-period", "T > Ts"],
    ])
  })

  it("resolves lineage when a published branch falls outside the sample", () => {
    const result = adaptCcp14Spectrum({ ...generalProcedureInput, ssG: 0.001 })
    expect(result.status).toBe("ok")

    const evidence = resolveSpectrumEvidence(result)
    expect(evidence.branchLineage.map(({ branchId }) => branchId)).toEqual([
      "initial-linear",
    ])
    expect(evidence.branchLineage[0].pointCount).toBe(501)
  })

  it("exposes no lineage when the scenario routes to a site-specific study", () => {
    const evidence = resolveSpectrumEvidence(
      adaptCcp14Spectrum({ ...generalProcedureInput, soilClass: "F" }),
    )

    expect(evidence.status).toBe("unavailable")
    expect(evidence.documents).toEqual([])
    expect(evidence.citations).toEqual([])
    expect(evidence.unavailableClaims.map(({ id }) => id)).toContain(
      "scenario-applicability",
    )
  })
})
