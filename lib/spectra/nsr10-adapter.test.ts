import { describe, expect, it } from "vitest"

import {
  computeCalculationTrace,
  computeSpectrum,
  saAt,
} from "../nsr10"
import {
  SpectrumEngineRegistry,
  NSR10_SOURCE_ID,
  adaptNsr10Spectrum,
  createNsr10AdapterScenario,
  nsr10SpectrumEngine,
  parseNsr10TraceEnvelope,
  resolveNsr10CitationId,
  resolveNsr10DependencyId,
  resolveNsr10FormulaId,
  resolveNsr10SourceId,
} from "."

import type {
  NormalizedSpectrumResult,
  SpectrumEngine,
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

function expectAdapterOk(
  result: ReturnType<typeof adaptNsr10Spectrum>,
): asserts result is Extract<ReturnType<typeof adaptNsr10Spectrum>, { status: "ok" }> {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error("Expected adapted spectrum")
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
      expectAdapterOk(adapted)
      expect(adapted.points.map(({ tSeconds, saG, branchId }) => ({
        t: tSeconds,
        sa: saG,
        branch: branchId,
      }))).toEqual(parent.points)
      expect(adapted.trace.data).toEqual(parentTrace)
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
        applicability: { status: "site-specific-study-required" },
        hazard: { id: hazardLevel },
      })
      const parentOrdinate = saAt(1, params)
      const adaptedOrdinate = adapted.saAt(1)
      expect(adaptedOrdinate).toMatchObject({
        status: "site-specific-study-required",
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

  it("preserves the exact parent RangeError contract for every invalid numeric input", () => {
    const nonFiniteCases = [
      ["aa", Number.NaN],
      ["aa", Number.POSITIVE_INFINITY],
      ["aa", Number.NEGATIVE_INFINITY],
      ["av", Number.NaN],
      ["av", Number.POSITIVE_INFINITY],
      ["av", Number.NEGATIVE_INFINITY],
      ["ae", Number.NaN],
      ["ae", Number.POSITIVE_INFINITY],
      ["ae", Number.NEGATIVE_INFINITY],
      ["ad", Number.NaN],
      ["ad", Number.POSITIVE_INFINITY],
      ["ad", Number.NEGATIVE_INFINITY],
    ] as const
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
      ...nonFiniteCases.map(([key, value]) => {
        const hazardLevel =
          key === "ae"
            ? "limited-safety"
            : key === "ad"
              ? "damage-threshold"
              : "design"
        const params = { ...base, hazardLevel, [key]: value } as SpectrumParams
        return {
          parent: () => computeSpectrum(params),
          adapted: () => adaptNsr10Spectrum(params),
        }
      }),
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

  it("snapshots successful parent inputs before closing over saAt", () => {
    const mutable: SpectrumParams = { ...base }
    const adapted = adaptNsr10Spectrum(mutable)
    expectAdapterOk(adapted)
    const before = adapted.saAt(0)
    const sampledAtZero = adapted.points.find(({ tSeconds }) => tSeconds === 0)

    mutable.aa = 0.5
    mutable.av = 0.5
    mutable.soilProfile = "A"

    expect(adapted.saAt(0)).toEqual(before)
    expect(before.status).toBe("ok")
    if (before.status === "ok") expect(before.point).toEqual(sampledAtZero)
  })

  it("snapshots soil-F parent inputs before closing over saAt", () => {
    const mutable: SpectrumParams = { ...base, soilProfile: "F" }
    const adapted = adaptNsr10Spectrum(mutable)
    expect(adapted.status).toBe("site-specific-study-required")
    const before = adapted.saAt(1)

    mutable.soilProfile = "D"
    mutable.aa = 0.5

    expect(adapted.saAt(1)).toEqual(before)
    expect(before.status).toBe("site-specific-study-required")
  })

  it("holds exact delegation across a deterministic 250-scenario fuzz matrix", () => {
    const hazards = ["design", "limited-safety", "damage-threshold"] as const
    const modes = ["general", "modal"] as const
    const soils = ["A", "B", "C", "D", "E"] as const
    const groups = ["I", "II", "III", "IV"] as const
    const values = [0.01, 0.05, 0.15, 0.2, 0.25, 0.35, 0.5, 0.6]
    let checked = 0

    outer: for (const hazardLevel of hazards) {
      for (const mode of modes) {
        for (const soilProfile of soils) {
          for (const importanceGroup of groups) {
            for (let index = 0; index < values.length; index += 1) {
              const params: SpectrumParams = {
                aa: values[index],
                av: values[(index + 3) % values.length],
                ae: values[(index + 5) % values.length],
                ad: values[(index + 7) % values.length],
                hazardLevel,
                mode,
                soilProfile,
                importanceGroup,
              }
              const parent = computeSpectrum(params)
              expectParentOk(parent)
              const adapted = adaptNsr10Spectrum(params)
              expectAdapterOk(adapted)
              expect(
                adapted.points.map(({ tSeconds, saG, branchId }) => ({
                  t: tSeconds,
                  sa: saG,
                  branch: branchId,
                })),
              ).toEqual(parent.points)
              const parentTrace = computeCalculationTrace(params)
              expectTrace(parentTrace)
              expect(adapted.trace.data).toEqual(parentTrace)
              for (const point of parent.points) {
                const direct = adapted.saAt(point.t)
                expect(direct.status).toBe("ok")
                if (direct.status === "ok") {
                  expect(direct.point.saG).toBe(point.sa)
                  expect(direct.point.branchId).toBe(point.branch)
                }
              }
              checked += 1
              if (checked === 250) break outer
            }
          }
        }
      }
    }
    expect(checked).toBe(250)
  }, 10_000)
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
    expectAdapterOk(throughEngine)
    expectAdapterOk(direct)
    expect(throughEngine.points).toEqual(direct.points)
    expect(throughEngine.trace).toEqual(direct.trace)
    expect(throughEngine.normalizedInputs).toEqual(direct.normalizedInputs)
  })

  it("emits only compatibility-resolvable source, citation, formula, and dependency IDs", () => {
    const adapted = adaptNsr10Spectrum(base, {
      municipality: {
        code: "76001",
        municipio: "Cali",
        departamento: "Valle del Cauca",
      },
    })
    expectAdapterOk(adapted)
    const trace = parseNsr10TraceEnvelope(adapted.trace)

    expect(adapted.sourceIds).toEqual([NSR10_SOURCE_ID])
    for (const id of adapted.sourceIds) expect(resolveNsr10SourceId(id)).toBeDefined()
    for (const id of adapted.citationIds) {
      expect(resolveNsr10CitationId(id)).toBeDefined()
    }
    for (const id of adapted.formulaIds) {
      expect(resolveNsr10FormulaId(trace, id)).toBeDefined()
    }
    for (const metric of adapted.metrics) {
      for (const id of metric.dependencyIds) {
        expect(resolveNsr10DependencyId(trace, id)).toBeDefined()
      }
    }
    expect(adapted.evidenceAvailability.status).toBe("partial")
  })

  it("refuses to attach municipality evidence to mismatched context or coefficients", () => {
    const validContext = {
      municipality: {
        code: "76001",
        municipio: "Cali",
        departamento: "Valle del Cauca",
      },
    } as const
    expect(() => adaptNsr10Spectrum(base, validContext)).not.toThrow()
    expect(() =>
      adaptNsr10Spectrum(base, {
        municipality: { ...validContext.municipality, municipio: "Not Cali" },
      }),
    ).toThrow(/does not match approved/)
    expect(() =>
      adaptNsr10Spectrum({ ...base, aa: 0.3 }, validContext),
    ).toThrow(/Aa does not match/)
    expect(() =>
      adaptNsr10Spectrum(base, {
        municipality: {
          code: "00000",
          municipio: "Unknown",
          departamento: "Unknown",
        },
      }),
    ).toThrow(/No approved/)
  })

  it("registers engines without inferring capabilities from engine IDs", () => {
    const registry = new SpectrumEngineRegistry()
    registry.register(nsr10SpectrumEngine)
    const scenario = createNsr10AdapterScenario(base)

    expect(registry.get(nsr10SpectrumEngine.metadata.id)).toBe(nsr10SpectrumEngine)
    expect(registry.findForScenario(scenario)).toBe(nsr10SpectrumEngine)
    expect(registry.compute(nsr10SpectrumEngine.metadata.id, scenario).status).toBe(
      "ok",
    )
    expect(registry.list()).toEqual([nsr10SpectrumEngine])
    expect(() => registry.register(nsr10SpectrumEngine)).toThrow(
      /already registered/,
    )
  })

  it("rejects contradictory registered metadata and computed result identity", () => {
    const scenario = createNsr10AdapterScenario(base)
    const invalidMetadataEngine = {
      ...nsr10SpectrumEngine,
      metadata: { ...nsr10SpectrumEngine.metadata, studyId: "ccp14" },
    }
    expect(() => new SpectrumEngineRegistry().register(invalidMetadataEngine)).toThrow()

    const dishonestEngine = {
      ...nsr10SpectrumEngine,
      metadata: { ...nsr10SpectrumEngine.metadata, id: "dishonest-engine" },
    }
    const registry = new SpectrumEngineRegistry()
    registry.register(dishonestEngine)
    expect(() => registry.compute("dishonest-engine", scenario)).toThrow(
      /identity does not match/,
    )
  })

  it("binds accepted scenarios to the registered type, study, and version", () => {
    const result = adaptNsr10Spectrum(base)
    const permissiveEngine: SpectrumEngine = {
      metadata: nsr10SpectrumEngine.metadata,
      accepts(scenario): scenario is never {
        void scenario
        return true
      },
      compute() {
        return result
      },
    }
    const registry = new SpectrumEngineRegistry()
    registry.register(permissiveEngine)

    expect(() =>
      registry.compute(nsr10SpectrumEngine.metadata.id, {
        type: "ccp14",
        studyId: "ccp14",
        studyVersion: "2014",
        inputs: {},
      }),
    ).toThrow(/does not match registered engine metadata/)
    expect(() =>
      registry.compute(nsr10SpectrumEngine.metadata.id, {
        ...createNsr10AdapterScenario(base),
        studyVersion: "drifted-version",
      }),
    ).toThrow(/does not match registered engine metadata/)
  })

  it("rejects capability decision drift from registered metadata", () => {
    const canonical = adaptNsr10Spectrum(base)
    const driftingEngine: SpectrumEngine = {
      metadata: nsr10SpectrumEngine.metadata,
      accepts: nsr10SpectrumEngine.accepts,
      compute() {
        return {
          ...canonical,
          capabilities: {
            ...canonical.capabilities,
            buildingBaseShear: {
              supported: false,
              reason: "Dishonest runtime drift",
            },
          },
        }
      },
    }
    const registry = new SpectrumEngineRegistry()
    registry.register(driftingEngine)
    expect(() =>
      registry.compute(
        nsr10SpectrumEngine.metadata.id,
        createNsr10AdapterScenario(base),
      ),
    ).toThrow(/capability buildingBaseShear does not match/)
  })

  it("rejects runtime results without the required saAt evaluator", () => {
    const canonical = adaptNsr10Spectrum(base)
    const dataOnly = { ...canonical }
    Reflect.deleteProperty(dataOnly, "saAt")
    const incompleteEngine: SpectrumEngine = {
      metadata: nsr10SpectrumEngine.metadata,
      accepts: nsr10SpectrumEngine.accepts,
      compute() {
        return dataOnly as unknown as NormalizedSpectrumResult
      },
    }
    const registry = new SpectrumEngineRegistry()
    registry.register(incompleteEngine)
    expect(() =>
      registry.compute(
        nsr10SpectrumEngine.metadata.id,
        createNsr10AdapterScenario(base),
      ),
    ).toThrow(/must provide an saAt evaluator/)
  })

  it("uses the parsed registration snapshot after caller metadata mutation", () => {
    const mutableMetadata = structuredClone(nsr10SpectrumEngine.metadata)
    const engine: SpectrumEngine = {
      ...nsr10SpectrumEngine,
      metadata: mutableMetadata,
    }
    const registry = new SpectrumEngineRegistry()
    registry.register(engine)
    mutableMetadata.id = "mutated-after-registration"
    mutableMetadata.studyVersion = "mutated-after-registration"

    expect(
      registry.compute(
        nsr10SpectrumEngine.metadata.id,
        createNsr10AdapterScenario(base),
      ).status,
    ).toBe("ok")
  })
})
