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

      expectWithinTolerance(result.coefficients.fa, scenario.expected.fa)
      expectWithinTolerance(result.coefficients.fv, scenario.expected.fv)
      expectWithinTolerance(result.coefficients.i, scenario.importance_coefficient)
      expectWithinTolerance(result.coefficients.t0, scenario.expected.t0)
      expectWithinTolerance(result.coefficients.tc, scenario.expected.tc)
      expectWithinTolerance(result.coefficients.tl, scenario.expected.tl)
      expectWithinTolerance(result.coefficients.saMax, scenario.expected.sa_max)

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

    for (const t of [0, spectrum.coefficients.t0 / 2, spectrum.coefficients.t0]) {
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

    const atZero = saAt(0, { ...base, mode: "modal" })
    expect(atZero.status).toBe("ok")
    if (atZero.status !== "ok") return
    expectWithinTolerance(atZero.sa, 0.4 * spectrum.coefficients.saMax)
    expect(atZero.branch).toBe("rising-A.2.6-7")

    const atT0 = saAt(spectrum.coefficients.t0, { ...base, mode: "modal" })
    expect(atT0).toMatchObject({
      status: "ok",
      sa: spectrum.coefficients.saMax,
      branch: "plateau-A.2.6-3",
    })
    expect(spectrum.points.some(({ t }) => t === spectrum.coefficients.t0)).toBe(true)
  })

  it("is continuous at TC and TL, including immediately on both sides", () => {
    const spectrum = computeSpectrum(base)
    expect(spectrum.status).toBe("ok")
    if (spectrum.status !== "ok") return

    const { tc, tl, saMax } = spectrum.coefficients
    const inverseAtTc =
      (1.2 * spectrum.coefficients.av * spectrum.coefficients.fv * spectrum.coefficients.i) /
      tc
    const inverseAtTl =
      (1.2 * spectrum.coefficients.av * spectrum.coefficients.fv * spectrum.coefficients.i) /
      tl
    const inverseSquareAtTl =
      (1.2 *
        spectrum.coefficients.av *
        spectrum.coefficients.fv *
        tl *
        spectrum.coefficients.i) /
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
  })
})
