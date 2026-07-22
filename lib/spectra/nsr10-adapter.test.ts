import { describe, expect, it } from "vitest"

import {
  computeCalculationTrace,
  computeSpectrum,
  saAt,
} from "../nsr10"
import {
  SpectrumEngineRegistry,
  adaptNsr10Spectrum,
  createNsr10AdapterScenario,
  nsr10SpectrumEngine,
} from "."

import type {
  CalculationTrace,
  SiteSpecificStudyRequired,
  SpectrumOk,
  SpectrumParams,
} from "../nsr10"

const base = {
  aa: 0.25,
  av: 0.25,
  ae: 0.15,
  ad: 0.09,
  soilProfile: "D",
  importanceGroup: "II",
} as const satisfies SpectrumParams

const cases = [
  {
    id: "design-exact-general",
    interpolationMode: "exact",
    params: { ...base, aa: 0.2, av: 0.2, hazardLevel: "design" },
  },
  {
    id: "design-interpolated-general",
    interpolationMode: "fraction",
    params: { ...base, hazardLevel: "design" },
  },
  {
    id: "design-clamped-lower",
    interpolationMode: "clamped",
    params: { ...base, aa: 0.01, av: 0.01, hazardLevel: "design" },
  },
  {
    id: "design-clamped-upper-modal",
    interpolationMode: "clamped",
    params: {
      ...base,
      aa: 0.6,
      av: 0.6,
      hazardLevel: "design",
      mode: "modal",
    },
  },
  {
    id: "limited-safety",
    interpolationMode: "fraction",
    params: { ...base, hazardLevel: "limited-safety" },
  },
  {
    id: "damage-threshold",
    interpolationMode: "clamped",
    params: { ...base, hazardLevel: "damage-threshold" },
  },
] as const satisfies readonly {
  id: string
  interpolationMode: "exact" | "fraction" | "clamped"
  params: SpectrumParams
}[]

function expectParentOk(result: ReturnType<typeof computeSpectrum>): asserts result is SpectrumOk {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error("Expected parent spectrum")
}

function expectTrace(
  result: ReturnType<typeof computeCalculationTrace>,
): asserts result is CalculationTrace {
  if ("status" in result) throw new Error("Expected parent calculation trace")
}

function traceModes(trace: CalculationTrace) {
  return [trace.siteCoefficients.fa?.mode, trace.siteCoefficients.fv.mode].filter(
    (mode): mode is "exact" | "fraction" | "clamped" => mode !== undefined,
  )
}

describe("NSR-10 adapter numerical equivalence", () => {
  for (const testCase of cases) {
    it(`projects parent points, metrics, trace, and saAt exactly: ${testCase.id}`, () => {
      const parent = computeSpectrum(testCase.params)
      expectParentOk(parent)
      const parentTrace = computeCalculationTrace(testCase.params)
      expectTrace(parentTrace)
      const adapted = adaptNsr10Spectrum(testCase.params)

      expect(traceModes(parentTrace)).toContain(testCase.interpolationMode)
      expect(adapted.status).toBe("ok")
      expect(adapted.points.map(({ tSeconds, saG, branchId }) => ({
        t: tSeconds,
        sa: saG,
        branch: branchId,
      }))).toEqual(parent.points)
      expect(adapted.trace).toEqual(parentTrace)
      expect(adapted.hazard).toMatchObject({
        id: parent.hazardLevel,
        returnPeriodYears: parent.returnPeriodYears,
        dampingRatio: parent.dampingRatio,
      })
      expect(adapted.branches.map(({ id }) => id)).toEqual(parent.branches)

      const projectedMetrics = Object.fromEntries(
        adapted.metrics.map(({ id, value }) => [id, value]),
      )
      for (const [id, value] of Object.entries(parent.coefficients)) {
        if (typeof value === "number" && id in projectedMetrics) {
          expect(projectedMetrics[id], id).toBe(value)
        }
      }

      const boundaries = [parent.coefficients.tc, parent.coefficients.tl]
      if (parent.coefficients.hazardLevel === "damage-threshold") {
        boundaries.push(0.25)
      } else {
        boundaries.push(parent.coefficients.t0)
      }
      const directPeriods = new Set([
        0,
        0.137,
        ...boundaries.flatMap((boundary) => [
          boundary * (1 - 1e-10),
          boundary,
          boundary * (1 + 1e-10),
        ]),
        ...parent.points.map(({ t }) => t),
      ])

      for (const t of directPeriods) {
        const parentOrdinate = saAt(t, testCase.params)
        const adaptedOrdinate = adapted.saAt(t)
        expect(parentOrdinate.status).toBe("ok")
        expect(adaptedOrdinate.status).toBe("ok")
        if (parentOrdinate.status !== "ok" || adaptedOrdinate.status !== "ok") {
          continue
        }
        expect(adaptedOrdinate.point).toMatchObject({
          tSeconds: parentOrdinate.t,
          saG: parentOrdinate.sa,
          branchId: parentOrdinate.branch,
        })
      }
    })
  }

  it("preserves the typed soil-F outcome for all three hazards", () => {
    for (const hazardLevel of [
      "design",
      "limited-safety",
      "damage-threshold",
    ] as const) {
      const params = { ...base, hazardLevel, soilProfile: "F" } as const
      const parent = computeSpectrum(params)
      const adapted = adaptNsr10Spectrum(params)

      expect(parent.status).toBe("site-specific-study-required")
      expect(adapted).toMatchObject({
        status: "site-specific-study-required",
        points: [],
        applicability: { status: "site-specific-study-required" },
        hazard: { id: hazardLevel },
      })
      const parentOrdinate = saAt(1, params)
      const adaptedOrdinate = adapted.saAt(1)
      expect(adaptedOrdinate).toMatchObject({
        status: "unavailable",
        applicability: { status: "site-specific-study-required" },
      })
      expect((parent as SiteSpecificStudyRequired).notice).toBe(
        adapted.warnings[0].message,
      )
      expect((parentOrdinate as SiteSpecificStudyRequired).notice).toBe(
        adapted.warnings[0].message,
      )
    }
  })

  it("preserves parent RangeError behavior for invalid inputs and periods", () => {
    const operations = [
      {
        parent: () => computeSpectrum({ ...base, aa: 0 }),
        adapted: () => adaptNsr10Spectrum({ ...base, aa: 0 }),
      },
      {
        parent: () => computeSpectrum({ ...base, hazardLevel: "limited-safety", ae: undefined }),
        adapted: () =>
          adaptNsr10Spectrum({ ...base, hazardLevel: "limited-safety", ae: undefined }),
      },
      {
        parent: () => saAt(-0.01, base),
        adapted: () => adaptNsr10Spectrum(base).saAt(-0.01),
      },
    ]

    for (const operation of operations) {
      let parentError: unknown
      let adaptedError: unknown
      try {
        operation.parent()
      } catch (error) {
        parentError = error
      }
      try {
        operation.adapted()
      } catch (error) {
        adaptedError = error
      }

      expect(parentError).toBeInstanceOf(RangeError)
      expect(adaptedError).toBeInstanceOf(RangeError)
      expect((adaptedError as Error).message).toBe((parentError as Error).message)
    }
  })
})

describe("NSR-10 adapter engine surface", () => {
  it("round-trips a normalized scenario through the generic engine", () => {
    const scenario = createNsr10AdapterScenario(base, {
      municipality: {
        code: "76001",
        municipio: "Cali",
        departamento: "Valle del Cauca",
      },
    })
    expect(nsr10SpectrumEngine.accepts(scenario)).toBe(true)

    const direct = adaptNsr10Spectrum(base, {
      municipality: {
        code: "76001",
        municipio: "Cali",
        departamento: "Valle del Cauca",
      },
    })
    const throughEngine = nsr10SpectrumEngine.compute(scenario)
    expect(throughEngine.points).toEqual(direct.points)
    expect(throughEngine.trace).toEqual(direct.trace)
    expect(throughEngine.normalizedInputs).toEqual(direct.normalizedInputs)
  })

  it("registers engines without inferring capabilities from engine IDs", () => {
    const registry = new SpectrumEngineRegistry()
    registry.register(nsr10SpectrumEngine)
    const scenario = createNsr10AdapterScenario(base)

    expect(registry.get(nsr10SpectrumEngine.metadata.id)).toBe(nsr10SpectrumEngine)
    expect(registry.findForScenario(scenario)).toBe(nsr10SpectrumEngine)
    expect(registry.list()).toEqual([nsr10SpectrumEngine])
    expect(() => registry.register(nsr10SpectrumEngine)).toThrow(
      /already registered/,
    )
  })
})
