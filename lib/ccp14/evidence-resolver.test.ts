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
