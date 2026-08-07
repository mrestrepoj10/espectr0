import { describe, expect, it } from "vitest"

import { adaptCcp14Spectrum } from "./adapter"

const input = {
  pgaG: 0.3,
  ssG: 0.75,
  s1G: 0.3,
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
      "ccp14-manual-hazard-inputs",
      "ccp14-t0-official-conflict",
      "ccp14-site-specific-triggers",
    ])
    expect(result.warnings[1].citationIds).toEqual([
      "conflict-t0-figure",
      "conflict-t0-definition",
    ])
    expect(result.trace.data.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "ccp14-input-pga",
        classification: "user-input",
        value: 0.3,
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

  it("declares only the branches the sampled curve actually carries", () => {
    // Ss this small pushes Ts to 337 s, so the whole 0-5 s sample is the
    // ascending branch and the other two published branches have no ordinate.
    const result = adaptCcp14Spectrum({ ...input, ssG: 0.001 })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.metrics.find(({ id }) => id === "ts")?.value).toBeCloseTo(337.5, 6)
    expect(result.branches.map(({ id }) => id)).toEqual(["initial-linear"])
    for (const branch of result.branches) {
      expect(
        result.points.filter(({ branchId }) => branchId === branch.id).length,
      ).toBeGreaterThan(0)
    }
    // The formulas of the unsampled branches stay documented in the trace.
    expect(result.trace.data.steps.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["ccp14-csm-plateau", "ccp14-csm-inverse"]),
    )
  })

  it("does not attribute the defaulted T0 reading to the engineer", () => {
    const defaulted = adaptCcp14Spectrum({
      pgaG: 0.3,
      ssG: 0.75,
      s1G: 0.3,
      soilClass: "D",
    })
    expect(defaulted.status).toBe("ok")
    if (defaulted.status !== "ok") return
    expect(
      defaulted.trace.data.steps.find(
        ({ id }) => id === "ccp14-input-t0-interpretation",
      ),
    ).toMatchObject({
      classification: "engine-default",
      label: "Lectura de T₀ aplicada por defecto",
      value: "figure-0.2-ts",
    })

    const declared = adaptCcp14Spectrum(input)
    expect(declared.status).toBe("ok")
    if (declared.status !== "ok") return
    expect(
      declared.trace.data.steps.find(
        ({ id }) => id === "ccp14-input-t0-interpretation",
      ),
    ).toMatchObject({
      classification: "user-input",
      label: "Lectura de T₀ declarada",
    })
  })

  it("keeps every warning inside the documents the result declares", () => {
    const result = adaptCcp14Spectrum(input)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    // The product locks no AASHTO source, so no warning may lean on one.
    for (const warning of result.warnings) {
      expect(warning.message).not.toContain("AASHTO")
      expect(warning.citationIds.length).toBeGreaterThan(0)
      for (const citationId of warning.citationIds) {
        expect(result.citationIds).toContain(citationId)
      }
    }
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

  it("preserves a localized unsupported outcome for an impossible branch ordering", () => {
    const result = adaptCcp14Spectrum({
      ...input,
      s1G: 0.01,
      t0Interpretation: "definition-0.2-seconds",
    })
    expect(result).toMatchObject({
      status: "unsupported",
      applicability: { reasonCode: "ccp14-t0-order-conflict" },
      hazard: { id: "ccp14-2014-7pct-75y" },
    })
    expect(result.saAt(0.1)).toMatchObject({ status: "unsupported" })
  })
})
