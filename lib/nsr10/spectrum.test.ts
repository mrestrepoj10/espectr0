import { describe, expect, it } from "vitest"

import oracleData from "./data/oracle.json"
import { oracleSchema } from "./schema"
import { computeSpectrum, saAt } from "./spectrum"

import type { SpectrumParams } from "./spectrum"

const ABSOLUTE_TOLERANCE = 1e-12
const oracle = oracleSchema.parse(oracleData)

function expectWithinTolerance(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(ABSOLUTE_TOLERANCE)
}

describe(`NSR-10 golden oracle (${oracle.cases.length} scenarios)`, () => {
  for (const scenario of oracle.cases) {
    it(`${scenario.id}: matches every derived value and sampled acceleration`, () => {
      const params: SpectrumParams = {
        aa: scenario.aa,
        av: scenario.av,
        soilProfile: scenario.soil_profile,
        importanceGroup: scenario.importance_group,
      }
      const result = computeSpectrum(params)

      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error("Supported oracle soil returned A.2.10")
      const coefficients = result.coefficients
      expect(coefficients.hazardLevel).toBe("design")
      if (coefficients.hazardLevel !== "design") {
        throw new Error("The design oracle returned another hazard level")
      }

      expectWithinTolerance(coefficients.fa, scenario.expected.fa)
      expectWithinTolerance(coefficients.fv, scenario.expected.fv)
      expectWithinTolerance(coefficients.i, scenario.importance_coefficient)
      expectWithinTolerance(coefficients.t0, scenario.expected.t0)
      expectWithinTolerance(coefficients.tc, scenario.expected.tc)
      expectWithinTolerance(coefficients.tl, scenario.expected.tl)
      expectWithinTolerance(coefficients.saMax, scenario.expected.sa_max)

      for (const expectedPoint of scenario.expected_sa_points) {
        const point = saAt(expectedPoint.period, params)
        expect(point.status).toBe("ok")
        if (point.status !== "ok") throw new Error("Supported oracle soil returned A.2.10")

        expectWithinTolerance(point.sa, expectedPoint.sa)
        expect(point.branch).toBe(expectedPoint.branch)
      }
    })
  }
})

describe("NSR-10 spectrum properties", () => {
  const base: SpectrumParams = {
    aa: 0.25,
    av: 0.25,
    soilProfile: "D",
    importanceGroup: "I",
  }

  it("uses the plateau from zero through TC in default/general mode", () => {
    const spectrum = computeSpectrum(base)
    expect(spectrum.status).toBe("ok")
    if (spectrum.status !== "ok") return
    const coefficients = spectrum.coefficients
    if (coefficients.hazardLevel !== "design") return

    for (const t of [0, coefficients.t0 / 2, coefficients.t0]) {
      const point = saAt(t, base)
      expect(point).toMatchObject({
        status: "ok",
        sa: spectrum.coefficients.saMax,
        branch: "plateau-A.2.6-3",
      })
    }

    expect(saAt(0, { ...base, mode: "general" })).toEqual(saAt(0, base))
  })

  it("opts into the conditional A.2.6-7 rising branch only in modal mode", () => {
    const spectrum = computeSpectrum({ ...base, mode: "modal" })
    expect(spectrum.status).toBe("ok")
    if (spectrum.status !== "ok") return
    const coefficients = spectrum.coefficients
    if (coefficients.hazardLevel !== "design") return

    const atZero = saAt(0, { ...base, mode: "modal" })
    expect(atZero.status).toBe("ok")
    if (atZero.status !== "ok") return
    expectWithinTolerance(atZero.sa, 0.4 * coefficients.saMax)
    expect(atZero.branch).toBe("rising-A.2.6-7")

    const atT0 = saAt(coefficients.t0, { ...base, mode: "modal" })
    expect(atT0).toMatchObject({
      status: "ok",
      sa: spectrum.coefficients.saMax,
      branch: "plateau-A.2.6-3",
    })
    expect(spectrum.points.some(({ t }) => t === coefficients.t0)).toBe(true)
  })

  it("is continuous at TC and TL, including immediately on both sides", () => {
    const spectrum = computeSpectrum(base)
    expect(spectrum.status).toBe("ok")
    if (spectrum.status !== "ok") return
    const coefficients = spectrum.coefficients
    if (coefficients.hazardLevel !== "design") return

    const { tc, tl, saMax } = coefficients
    const inverseAtTc =
      (1.2 * coefficients.av * coefficients.fv * coefficients.i) / tc
    const inverseAtTl =
      (1.2 * coefficients.av * coefficients.fv * coefficients.i) / tl
    const inverseSquareAtTl =
      (1.2 *
        coefficients.av *
        coefficients.fv *
        tl *
        coefficients.i) /
      tl ** 2

    expectWithinTolerance(inverseAtTc, saMax)
    expectWithinTolerance(inverseAtTl, inverseSquareAtTl)

    const relativeEpsilon = 1e-10
    for (const boundary of [tc, tl]) {
      const left = saAt(boundary * (1 - relativeEpsilon), base)
      const exact = saAt(boundary, base)
      const right = saAt(boundary * (1 + relativeEpsilon), base)
      if (left.status !== "ok" || exact.status !== "ok" || right.status !== "ok") return

      expect(Math.abs(left.sa - exact.sa)).toBeLessThan(2e-10)
      expect(Math.abs(right.sa - exact.sa)).toBeLessThan(2e-10)
    }
  })

  it("is monotonically non-increasing after TC", () => {
    const spectrum = computeSpectrum(base)
    expect(spectrum.status).toBe("ok")
    if (spectrum.status !== "ok") return

    const afterTc = spectrum.points.filter(({ t }) => t >= spectrum.coefficients.tc)
    for (let index = 1; index < afterTc.length; index += 1) {
      expect(afterTc[index].sa).toBeLessThanOrEqual(afterTc[index - 1].sa)
    }
  })

  it("includes exact TC and TL once and identifies saMax with the plateau", () => {
    const spectrum = computeSpectrum(base)
    expect(spectrum.status).toBe("ok")
    if (spectrum.status !== "ok") return

    for (const boundary of [spectrum.coefficients.tc, spectrum.coefficients.tl]) {
      expect(spectrum.points.filter(({ t }) => t === boundary)).toHaveLength(1)
    }
    expect(new Set(spectrum.points.map(({ t }) => t)).size).toBe(spectrum.points.length)
    expect(Math.max(...spectrum.points.map(({ sa }) => sa))).toBe(
      spectrum.coefficients.saMax,
    )
    expect(spectrum.points.at(-1)!.t).toBeGreaterThan(spectrum.coefficients.tl)
    expect(spectrum.points.at(-1)!.branch).toBe("inverse-T2-A.2.6-5")
  })

  it("scales linearly and in order for importance groups I through IV", () => {
    const factors = { I: 1, II: 1.1, III: 1.25, IV: 1.5 } as const
    const values = (Object.keys(factors) as Array<keyof typeof factors>).map(
      (importanceGroup) => {
        const result = computeSpectrum({ ...base, importanceGroup })
        if (result.status !== "ok") throw new Error("Unexpected A.2.10 result")
        return { importanceGroup, saMax: result.coefficients.saMax }
      },
    )

    for (let index = 1; index < values.length; index += 1) {
      expect(values[index].saMax).toBeGreaterThan(values[index - 1].saMax)
    }
    for (const { importanceGroup, saMax } of values) {
      expectWithinTolerance(saMax / values[0].saMax, factors[importanceGroup])
    }
  })

  it("returns the typed A.2.10 result for soil F", () => {
    const result = computeSpectrum({ ...base, soilProfile: "F" })
    expect(result).toMatchObject({
      status: "site-specific-study-required",
      section: "A.2.10",
      soilProfile: "F",
    })
    expect(saAt(1, { ...base, soilProfile: "F" })).toEqual(result)
  })

  it("rejects invalid periods and hazard coefficients", () => {
    expect(() => saAt(-0.01, base)).toThrow(RangeError)
    expect(() => computeSpectrum({ ...base, aa: 0 })).toThrow(RangeError)
    expect(() =>
      computeSpectrum({ ...base, hazardLevel: "limited-safety" }),
    ).toThrow(/Ae/)
    expect(() =>
      computeSpectrum({ ...base, hazardLevel: "damage-threshold" }),
    ).toThrow(/Ad/)
  })
})

describe("NSR-10 additional hazard levels", () => {
  const cali = {
    aa: 0.25,
    av: 0.25,
    ae: 0.15,
    ad: 0.09,
    soilProfile: "D",
    importanceGroup: "I",
  } as const satisfies SpectrumParams

  it("uses Ae for both A.2.6 axes in the limited-safety spectrum", () => {
    const params = { ...cali, hazardLevel: "limited-safety" } as const
    const spectrum = computeSpectrum(params)
    expect(spectrum.status).toBe("ok")
    if (spectrum.status !== "ok") return
    const coefficients = spectrum.coefficients
    expect(coefficients.hazardLevel).toBe("limited-safety")
    if (coefficients.hazardLevel !== "limited-safety") return

    expect(spectrum).toMatchObject({
      hazardLevel: "limited-safety",
      returnPeriodYears: 225,
      dampingRatio: 0.05,
    })
    expectWithinTolerance(coefficients.fa, 1.5)
    expectWithinTolerance(coefficients.fv, 2.2)
    expectWithinTolerance(coefficients.t0, (0.1 * 2.2) / 1.5)
    expectWithinTolerance(coefficients.tc, (0.48 * 2.2) / 1.5)
    expectWithinTolerance(coefficients.tl, 2.4 * 2.2)
    expectWithinTolerance(coefficients.saMax, 2.5 * 0.15 * 1.5)
    expectWithinTolerance(coefficients.pga, 0.15 * 1.5)

    const atOneSecond = saAt(1, params)
    expect(atOneSecond.status).toBe("ok")
    if (atOneSecond.status !== "ok") return
    expectWithinTolerance(atOneSecond.sa, 1.2 * 0.15 * 2.2)
    expect(atOneSecond.branch).toBe("inverse-T-A.2.6-1")

    expect(spectrum.points.at(-1)!.t).toBeGreaterThan(coefficients.tl)
    expect(spectrum.points.at(-1)!.branch).toBe("inverse-T2-A.2.6-5")
  })

  it("uses the distinct A.12.3 shape and two-percent damping for damage threshold", () => {
    const params = { ...cali, hazardLevel: "damage-threshold" } as const
    const spectrum = computeSpectrum(params)
    expect(spectrum.status).toBe("ok")
    if (spectrum.status !== "ok") return
    const coefficients = spectrum.coefficients
    expect(coefficients.hazardLevel).toBe("damage-threshold")
    if (coefficients.hazardLevel !== "damage-threshold") return

    expect(spectrum).toMatchObject({
      hazardLevel: "damage-threshold",
      returnPeriodYears: 31,
      dampingRatio: 0.02,
    })
    expectWithinTolerance(coefficients.fv, 2.4)
    expectWithinTolerance(coefficients.s, 3)
    expectWithinTolerance(coefficients.tc, 1.5)
    expectWithinTolerance(coefficients.tl, 7.2)
    expectWithinTolerance(coefficients.saMax, 0.27)
    expectWithinTolerance(coefficients.pga, 0.09)

    for (const [t, sa, branch] of [
      [0, 0.09, "rising-A.12.3-2"],
      [0.25, 0.27, "plateau-A.12.3-4"],
      [1, 0.27, "plateau-A.12.3-4"],
      [2, 0.2025, "inverse-T-A.12.3-1"],
      [8, (1.5 * 0.09 * 3 * 7.2) / 8 ** 2, "inverse-T2-A.12.3-6"],
    ] as const) {
      const point = saAt(t, params)
      expect(point.status).toBe("ok")
      if (point.status !== "ok") continue
      expectWithinTolerance(point.sa, sa)
      expect(point.branch).toBe(branch)
    }

    for (const boundary of [0.25, coefficients.tc, coefficients.tl]) {
      expect(spectrum.points.filter(({ t }) => t === boundary)).toHaveLength(1)
    }
    expect(spectrum.points.at(-1)!.t).toBeGreaterThan(coefficients.tl)
    expect(spectrum.points.at(-1)!.branch).toBe("inverse-T2-A.12.3-6")
  })

  it("does not apply the importance coefficient to A.12.3", () => {
    const groupI = computeSpectrum({
      ...cali,
      hazardLevel: "damage-threshold",
      importanceGroup: "I",
    })
    const groupIV = computeSpectrum({
      ...cali,
      hazardLevel: "damage-threshold",
      importanceGroup: "IV",
    })
    expect(groupI).toEqual(groupIV)
  })
})
