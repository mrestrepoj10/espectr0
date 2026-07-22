import { describe, expect, it } from "vitest"

import {
  calculationTraceSchema,
  computeCalculationTrace,
  traceSaAt,
} from "./calculation-trace"
import { lookupMunicipio } from "./municipios"
import { computeSpectrum } from "./spectrum"

import type { CalculationTrace } from "./calculation-trace"
import type { SpectrumParams } from "./spectrum"

const cali = lookupMunicipio("Cali", "Valle del Cauca")[0]
if (!cali) throw new Error("Cali is missing from the municipality dataset")

const caliParams = {
  aa: cali.aa,
  av: cali.av,
  ae: cali.ae,
  ad: cali.ad,
  soilProfile: "D",
  importanceGroup: "I",
  hazardLevel: "design",
  mode: "general",
} as const satisfies SpectrumParams

function expectTrace(
  result: ReturnType<typeof computeCalculationTrace>,
): asserts result is CalculationTrace {
  expect("status" in result).toBe(false)
  if ("status" in result) throw new Error("Expected a calculation trace")
}

describe("CalculationTrace stable contract", () => {
  it("round-trips through its strict Zod schema", () => {
    const trace = computeCalculationTrace(caliParams, { municipality: cali })
    expectTrace(trace)

    const serialized = JSON.stringify(trace)
    expect(calculationTraceSchema.parse(JSON.parse(serialized))).toEqual(trace)
    expect(Object.keys(trace)).toEqual([
      "schemaVersion",
      "context",
      "inputs",
      "siteCoefficients",
      "steps",
      "branches",
      "representativePoints",
    ])
  })

  it("keeps a golden snapshot for a known municipality", () => {
    const trace = computeCalculationTrace(caliParams, { municipality: cali })
    expectTrace(trace)

    expect({
      ...trace,
      branches: trace.branches.map(({ points, ...branch }) => ({
        ...branch,
        pointCount: points.length,
        firstPoint: points[0],
        lastPoint: points.at(-1),
      })),
    }).toMatchSnapshot()
  })

  it("retains every sampled engine point without changing computeSpectrum", () => {
    const before = computeSpectrum(caliParams)
    const trace = computeCalculationTrace(caliParams, { municipality: cali })
    const after = computeSpectrum(caliParams)
    expectTrace(trace)

    expect(after).toEqual(before)
    expect(before.status).toBe("ok")
    if (before.status !== "ok") return
    expect(trace.branches.flatMap(({ points }) => points)).toEqual(before.points)
  })

  it("serializes valid spectra even when coefficient ratios leave a branch unsampled", () => {
    const trace = computeCalculationTrace({
      ...caliParams,
      aa: 0.05,
      av: 0.5,
      soilProfile: "A",
    })
    expectTrace(trace)

    expect(trace.branches.some(({ points }) => points.length === 0)).toBe(true)
    expect(calculationTraceSchema.safeParse(trace).success).toBe(true)
  })
})

describe("CalculationTrace interpolation evidence", () => {
  it("records fractional interpolation with both table breakpoints", () => {
    const trace = computeCalculationTrace(caliParams)
    expectTrace(trace)

    expect(trace.siteCoefficients.fa).toMatchObject({
      tableId: "A.2.4-3",
      input: 0.25,
      mode: "fraction",
      lower: { breakpoint: 0.2, value: 1.4 },
      upper: { breakpoint: 0.3, value: 1.2 },
      fraction: 0.5,
    })
    expect(trace.siteCoefficients.fa?.result).toBeCloseTo(1.3, 15)
    expect(trace.siteCoefficients.fv).toMatchObject({
      tableId: "A.2.4-4",
      input: 0.25,
      mode: "fraction",
      lower: { breakpoint: 0.2, value: 2 },
      upper: { breakpoint: 0.3, value: 1.8 },
      fraction: 0.5,
    })
    expect(trace.siteCoefficients.fv.result).toBeCloseTo(1.9, 15)
  })

  it("distinguishes exact and clamped table lookups", () => {
    const exact = computeCalculationTrace({ ...caliParams, aa: 0.2, av: 0.2 })
    const clamped = computeCalculationTrace({ ...caliParams, aa: 0.05, av: 0.05 })
    expectTrace(exact)
    expectTrace(clamped)

    expect(exact.siteCoefficients.fa).toMatchObject({
      mode: "exact",
      clampedTo: null,
      lower: { breakpoint: 0.2 },
      upper: { breakpoint: 0.2 },
      fraction: 0,
    })
    expect(clamped.siteCoefficients.fa).toMatchObject({
      mode: "clamped",
      clampedTo: "lower",
      lower: { breakpoint: 0.1 },
      upper: { breakpoint: 0.1 },
      fraction: 0,
    })
  })

  it("omits Fa only where the damage-threshold spectrum does not use it", () => {
    const trace = computeCalculationTrace({
      ...caliParams,
      hazardLevel: "damage-threshold",
    })
    expectTrace(trace)

    expect(trace.siteCoefficients.fa).toBeNull()
    expect(trace.siteCoefficients.fv).toMatchObject({
      coefficient: "fv",
      inputParameter: "Ad",
      input: cali.ad,
      mode: "clamped",
      clampedTo: "lower",
    })
  })

  it("identifies Ae as the input to both limited-safety table lookups", () => {
    const trace = computeCalculationTrace({
      ...caliParams,
      hazardLevel: "limited-safety",
    })
    expectTrace(trace)

    expect(trace.siteCoefficients.fa?.inputParameter).toBe("Ae")
    expect(trace.siteCoefficients.fv.inputParameter).toBe("Ae")
  })
})

describe("traceSaAt", () => {
  it("proves the inclusive design boundaries and the branch beyond TL", () => {
    const spectrum = computeSpectrum(caliParams)
    if (spectrum.status !== "ok") throw new Error("Expected a spectrum")

    const atTc = traceSaAt(spectrum.coefficients.tc, caliParams)
    const atTl = traceSaAt(spectrum.coefficients.tl, caliParams)
    const afterTl = traceSaAt(spectrum.coefficients.tl + 0.01, caliParams)
    expect(atTc).toMatchObject({ status: "ok", point: { branch: "plateau-A.2.6-3" } })
    expect(atTl).toMatchObject({ status: "ok", point: { branch: "inverse-T-A.2.6-1" } })
    expect(afterTl).toMatchObject({
      status: "ok",
      point: { branch: "inverse-T2-A.2.6-5" },
    })
  })

  it("covers modal and damage-threshold branch boundaries", () => {
    const modalParams = { ...caliParams, mode: "modal" } as const
    const modal = computeSpectrum(modalParams)
    if (modal.status !== "ok" || modal.coefficients.hazardLevel === "damage-threshold") {
      throw new Error("Expected a design-like modal spectrum")
    }

    expect(traceSaAt(0, modalParams)).toMatchObject({
      status: "ok",
      point: { branch: "rising-A.2.6-7" },
    })
    expect(traceSaAt(modal.coefficients.t0, modalParams)).toMatchObject({
      status: "ok",
      point: { branch: "plateau-A.2.6-3" },
    })
    expect(
      traceSaAt(0.25, { ...caliParams, hazardLevel: "damage-threshold" }),
    ).toMatchObject({
      status: "ok",
      point: { branch: "plateau-A.12.3-4" },
    })
  })

  it("propagates the typed soil-F result", () => {
    const params = { ...caliParams, soilProfile: "F" } as const
    expect(computeCalculationTrace(params)).toEqual(computeSpectrum(params))
    expect(traceSaAt(1, params)).toEqual(computeSpectrum(params))
  })
})
