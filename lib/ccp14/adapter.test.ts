import { describe, expect, it } from "vitest"

import { adaptCcp14Spectrum } from "./adapter"

const input = {
  cityId: "cali",
  soilClass: "D",
  t0Interpretation: "figure-0.2-ts",
  distanceToActiveFaultKm: 10,
  longDurationEarthquakesExpected: false,
  enhancedHazardRequiredByImportance: false,
}

describe("CCP-14 normalized adapter", () => {
  it("emits a normalized, source-traceable bridge spectrum", () => {
    const result = adaptCcp14Spectrum(input)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result).toMatchObject({
      scenarioType: "ccp14",
      study: { id: "ccp14", version: "CCP-14/Resolution-108-2015-v1" },
      hazard: { id: "ccp14-2014-7pct-75y", returnPeriodYears: 1000, dampingRatio: 0.05 },
      applicability: { status: "applicable" },
    })
    expect(result.sourceIds).toEqual([
      "mintransporte-resolution-108-2015-invias-copy",
      "invias-ccp14-section-3",
    ])
    expect(result.warnings.map(({ code }) => code)).toEqual([
      "ccp14-t0-official-conflict",
    ])
    expect(result.warnings[0].citationIds).toEqual([
      "conflict-t0-figure",
      "conflict-t0-definition",
    ])
    expect(result.trace.data.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ccp14-input-pga",
        classification: "derived",
        value: 0.3,
        dependencies: ["ccp14-input-city"],
      }),
      expect.objectContaining({
        id: "ccp14-factor-fpga",
        classification: "derived",
        dependencies: ["ccp14-input-pga", "ccp14-input-soil-class"],
      }),
      expect.objectContaining({
        id: "ccp14-t0",
        dependencies: ["ccp14-input-t0-interpretation", "ccp14-ts"],
      }),
    ]))
    expect(result.branches.map(({ id }) => id)).toEqual([
      "initial-linear",
      "plateau",
      "inverse-period",
    ])
    expect(result.metrics.map(({ id }) => id)).toEqual([
      "as", "sds", "sd1", "ts", "t0", "performanceZone",
    ])
  })

  it("keeps saAt exactly aligned with sampled points", () => {
    const result = adaptCcp14Spectrum(input)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    for (const point of result.points) {
      expect(result.saAt(point.tSeconds)).toEqual({ status: "ok", point })
    }
    expect(result.saAt(-0.01)).toMatchObject({
      status: "invalid-input",
      applicability: { reasonCode: "ccp14-invalid-period" },
    })
  })

  it("separates bridge metadata from NSR building workflows", () => {
    const result = adaptCcp14Spectrum(input)
    expect(result.capabilities.bridgeRFactorWorkflow).toEqual({ supported: true })
    expect(result.capabilities.buildingBaseShear).toMatchObject({ supported: false })
    expect(result.capabilities.fheWorkflow).toMatchObject({ supported: false })
  })

  it("returns class F as a typed site-specific result", () => {
    const result = adaptCcp14Spectrum({ ...input, soilClass: "F" })
    expect(result).toMatchObject({
      status: "site-specific-study-required",
      applicability: { reasonCode: "ccp14-soil-class-f" },
      evidenceAvailability: { status: "available" },
    })
    expect(result.saAt(1)).toMatchObject({ status: "site-specific-study-required" })
  })

  it("fails invalid input without inventing a hazard or evidence key", () => {
    const result = adaptCcp14Spectrum({ ...input, t0Interpretation: "automatic" })
    expect(result).toMatchObject({
      status: "invalid-input",
      hazard: null,
      scenarioEvidenceKey: { optionId: null, hazardId: null },
      evidenceAvailability: { status: "unavailable" },
    })
  })

})
