import { describe, expect, it } from "vitest"

import oracleExpected from "./oracle/expected-results.json"
import factorData from "./data/site-factors.json"
import {
  ccp14PerformanceZone,
  computeCcp14Spectrum,
  lookupCcp14SiteFactor,
} from "./engine"

const ordinaryInput = {
  pgaG: 0.3,
  ssG: 0.75,
  s1G: 0.3,
  soilClass: "D" as const,
  t0Interpretation: "figure-0.2-ts" as const,
  distanceToActiveFaultKm: null,
  longDurationEarthquakesExpected: false,
  enhancedHazardRequiredByImportance: false,
}

describe("CCP-14 pure spectrum engine", () => {
  it("matches the independent Decimal oracle for the ordinary case", () => {
    const result = computeCcp14Spectrum(ordinaryInput)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.as.toFixed(3)).toBe(oracleExpected.parameters.As)
    expect(result.sds.toFixed(3)).toBe(oracleExpected.parameters.SDS)
    expect(result.sd1.toFixed(3)).toBe(oracleExpected.parameters.SD1)
    expect(result.ts).toBeCloseTo(Number(oracleExpected.parameters.Ts), 14)
    expect(result.performanceZone).toBe(oracleExpected.performanceZone)
    const values = [0, 0.1, 0.12, 0.2, 0.6, 1].map((period) => result.at(period).csm)
    oracleExpected.spectrumCompetingReadings["figure-T0-equals-0.2Ts"].values
      .map(Number)
      .forEach((expected, index) => expect(values[index]).toBeCloseTo(expected, 14))
  })

  it("uses each explicitly selected official T0 reading without resolving the conflict", () => {
    const figure = computeCcp14Spectrum(ordinaryInput)
    const definition = computeCcp14Spectrum({
      ...ordinaryInput,
      t0Interpretation: "definition-0.2-seconds",
    })
    expect(figure.status).toBe("ok")
    expect(definition.status).toBe("ok")
    if (figure.status !== "ok" || definition.status !== "ok") return
    expect(figure.t0).toBeCloseTo(0.12, 14)
    expect(definition.t0).toBe(0.2)
    expect(figure.at(0.1).csm).toBeCloseTo(0.81, 14)
    expect(definition.at(0.1).csm).toBeCloseTo(0.63, 14)
  })

  it("selects every branch on both sides of its boundaries", () => {
    const result = computeCcp14Spectrum(ordinaryInput)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    const epsilon = 1e-10
    expect(result.at(result.t0 - epsilon).branchId).toBe("initial-linear")
    expect(result.at(result.t0).branchId).toBe("initial-linear")
    expect(result.at(result.t0 + epsilon).branchId).toBe("plateau")
    expect(result.at(result.ts - epsilon).branchId).toBe("plateau")
    expect(result.at(result.ts).branchId).toBe("plateau")
    expect(result.at(result.ts + epsilon).branchId).toBe("inverse-period")
    expect(result.at(result.t0).csm).toBeCloseTo(result.sds, 14)
    expect(result.at(result.ts).csm).toBeCloseTo(result.sds, 14)
  })

  it("looks up exact breakpoints, interpolates linearly, and clamps table endpoints", () => {
    expect(lookupCcp14SiteFactor("Fpga", "D", 0.05)).toMatchObject({ value: 1.6, mode: "low-clamp" })
    expect(lookupCcp14SiteFactor("Fpga", "D", 0.1)).toMatchObject({ value: 1.6, mode: "exact" })
    expect(lookupCcp14SiteFactor("Fpga", "D", 0.35).value).toBeCloseTo(1.15, 14)
    expect(lookupCcp14SiteFactor("Fpga", "D", 0.35).mode).toBe("interpolation")
    expect(lookupCcp14SiteFactor("Fa", "E", 0.625).value).toBeCloseTo(1.45, 14)
    expect(lookupCcp14SiteFactor("Fv", "E", 0.25).value).toBeCloseTo(3, 14)
    expect(lookupCcp14SiteFactor("Fv", "C", 0.75)).toMatchObject({ value: 1.3, mode: "high-clamp" })
    expect(() => lookupCcp14SiteFactor("Fa", "C", -0.1)).toThrow(RangeError)
  })

  it("matches every official A-E coefficient at every published breakpoint", () => {
    for (const factorId of ["Fpga", "Fa", "Fv"] as const) {
      const table = factorData.tables[factorId]
      for (const soilClass of ["A", "B", "C", "D", "E"] as const) {
        table.breakpoints.forEach((breakpoint, index) => {
          const lookup = lookupCcp14SiteFactor(factorId, soilClass, breakpoint)
          expect(lookup.value).toBe(table.rows[soilClass][index])
          expect(lookup.mode).toBe("exact")
        })
      }
    }
  })

  it.each([
    [0.15, 1],
    [0.1500001, 2],
    [0.3, 2],
    [0.3000001, 3],
    [0.5, 3],
    [0.5000001, 4],
  ] as const)("assigns SD1=%s to performance zone %s", (sd1, zone) => {
    expect(ccp14PerformanceZone(sd1)).toBe(zone)
  })

  it("returns typed invalid and site-specific outcomes", () => {
    expect(computeCcp14Spectrum({ ...ordinaryInput, pgaG: -0.1 })).toMatchObject({
      status: "invalid-input",
      reasonCode: "ccp14-invalid-input",
    })
    expect(computeCcp14Spectrum({ ...ordinaryInput, soilClass: "F" })).toMatchObject({
      status: "site-specific-study-required",
      reasonCode: "ccp14-soil-class-f",
    })
    expect(computeCcp14Spectrum({ ...ordinaryInput, distanceToActiveFaultKm: 9.999 })).toMatchObject({
      status: "site-specific-study-required",
      reasonCode: "ccp14-active-fault-distance",
    })
    expect(computeCcp14Spectrum({ ...ordinaryInput, distanceToActiveFaultKm: 10 }).status).toBe("ok")
    expect(computeCcp14Spectrum({ ...ordinaryInput, longDurationEarthquakesExpected: true })).toMatchObject({
      status: "site-specific-study-required",
      reasonCode: "ccp14-long-duration-earthquakes",
    })
    expect(computeCcp14Spectrum({ ...ordinaryInput, enhancedHazardRequiredByImportance: true })).toMatchObject({
      status: "site-specific-study-required",
      reasonCode: "ccp14-enhanced-hazard-by-importance",
    })
  })

  it("fails closed when the 0.2 s reading would put T0 after Ts", () => {
    expect(computeCcp14Spectrum({
      ...ordinaryInput,
      s1G: 0.01,
      t0Interpretation: "definition-0.2-seconds",
    })).toMatchObject({
      status: "unsupported",
      reasonCode: "ccp14-t0-order-conflict",
      citationIds: ["conflict-t0-figure", "conflict-t0-definition", "claim-spectrum-branches"],
    })
  })

  it("rejects invalid periods", () => {
    const result = computeCcp14Spectrum(ordinaryInput)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(() => result.at(-0.01)).toThrow(RangeError)
    expect(() => result.at(Number.NaN)).toThrow(RangeError)
  })
})
