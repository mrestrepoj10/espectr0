import { describe, expect, it } from "vitest"

import {
  SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  SPECTRUM_CONTRACT_SCHEMA_VERSION,
  SPECTRUM_EXPORT_SCHEMA_VERSION,
  adaptNsr10Spectrum,
  ccp14ScenarioSchema,
  createSpectrumExport,
  municipalStudyScenarioSchema,
  normalizedSpectrumOrdinateSchema,
  normalizedSpectrumResultDataSchema,
  nsr10Capabilities,
  spectrumCapabilitiesSchema,
  spectrumCapabilityKeys,
  spectrumResultData,
  spectrumScenarioSchema,
} from "."

import type { NormalizedSpectrumResultData } from "."

type SuccessfulData = Extract<NormalizedSpectrumResultData, { status: "ok" }>

function successfulData(): SuccessfulData {
  const result = adaptNsr10Spectrum({
    aa: 0.25,
    av: 0.25,
    ae: 0.15,
    ad: 0.09,
    soilProfile: "D",
    importanceGroup: "II",
  })
  if (result.status !== "ok") throw new Error("Expected successful test fixture")
  const data = spectrumResultData(result)
  if (data.status !== "ok") throw new Error("Expected successful data fixture")
  return structuredClone(data) as SuccessfulData
}

function expectContradiction(
  mutate: (data: ReturnType<typeof successfulData>) => void,
) {
  const data = successfulData()
  mutate(data)
  expect(normalizedSpectrumResultDataSchema.safeParse(data).success).toBe(false)
}

describe("engine-neutral spectrum contract", () => {
  it("runtime-validates every discriminated scenario family and reserved identity", () => {
    const scenarios = [
      {
        type: "nsr10-national",
        studyId: "nsr10-national",
        studyVersion: "NSR-10-2010",
        inputs: { soilProfile: "D" },
      },
      {
        type: "ccp14",
        studyId: "ccp14",
        studyVersion: "2014",
        inputs: { bridgeCategory: "example" },
      },
      {
        type: "municipal-study",
        studyId: "bogota-example",
        studyVersion: "pending-evidence",
        inputs: { zoneId: "example" },
      },
    ]

    for (const scenario of scenarios) {
      expect(spectrumScenarioSchema.parse(scenario)).toEqual(scenario)
    }
    expect(ccp14ScenarioSchema.safeParse(scenarios[2]).success).toBe(false)
    expect(municipalStudyScenarioSchema.safeParse(scenarios[1]).success).toBe(false)
    expect(
      municipalStudyScenarioSchema.safeParse({
        ...scenarios[2],
        studyId: "nsr10-national",
      }).success,
    ).toBe(false)
  })

  it("requires an explicit decision for every declared capability", () => {
    expect(Object.keys(nsr10Capabilities).sort()).toEqual(
      [...spectrumCapabilityKeys].sort(),
    )
    expect(spectrumCapabilitiesSchema.parse(nsr10Capabilities)).toEqual(
      nsr10Capabilities,
    )
    expect(nsr10Capabilities.bridgeRFactorWorkflow).toMatchObject({
      supported: false,
    })
    expect(nsr10Capabilities.buildingBaseShear).toEqual({ supported: true })
    expect(SPECTRUM_CAPABILITIES_SCHEMA_VERSION).toBe(1)

    const incomplete = Object.fromEntries(
      Object.entries(nsr10Capabilities).filter(([key]) => key !== "comparison"),
    )
    expect(spectrumCapabilitiesSchema.safeParse(incomplete).success).toBe(false)
  })

  it("models all typed non-success result and ordinate outcomes", () => {
    const siteSpecific = adaptNsr10Spectrum({
      aa: 0.25,
      av: 0.25,
      soilProfile: "F",
      importanceGroup: "I",
    })
    if (siteSpecific.status !== "site-specific-study-required") {
      throw new Error("Expected site-specific fixture")
    }
    const base = spectrumResultData(siteSpecific)

    for (const status of [
      "invalid-input",
      "unsupported",
      "not-applicable",
      "site-specific-study-required",
    ] as const) {
      const applicability = {
        status,
        reasonCode: `${status}-reason`,
        message: `${status} message`,
        citationIds: [],
      }
      expect(
        normalizedSpectrumResultDataSchema.safeParse({
          ...base,
          status,
          applicability,
        }).success,
      ).toBe(true)
      expect(
        normalizedSpectrumOrdinateSchema.safeParse({ status, applicability }).success,
      ).toBe(true)
    }

    expect(
      normalizedSpectrumOrdinateSchema.safeParse({
        status: "unavailable",
        applicability: { status: "applicable" },
      }).success,
    ).toBe(false)
  })

  it("rejects empty success and scenario/study identity contradictions", () => {
    expectContradiction((data) => {
      data.points = []
    })
    expectContradiction((data) => {
      data.branches = []
    })
    expectContradiction((data) => {
      data.formulaIds = []
    })
    expectContradiction((data) => {
      data.scenarioType = "ccp14"
    })
    expectContradiction((data) => {
      data.scenarioType = "municipal-study"
    })
    expectContradiction((data) => {
      data.scenarioType = "ccp14"
      data.study = { id: "ccp14", version: "2014" }
    })
  })

  it("rejects trace version and shape contradictions", () => {
    expectContradiction((data) => {
      data.traceSchemaVersion = 999
    })
    expectContradiction((data) => {
      data.trace.schemaVersion = 999
    })
    expectContradiction((data) => {
      data.trace.data.schemaVersion = 999
    })

    const result = adaptNsr10Spectrum({
      aa: 0.25,
      av: 0.25,
      soilProfile: "D",
      importanceGroup: "II",
    })
    if (result.status !== "ok") throw new Error("Expected successful fixture")
    const invalidTrace = structuredClone(spectrumResultData(result))
    if (!invalidTrace.trace) throw new Error("Expected trace fixture")
    Reflect.deleteProperty(invalidTrace.trace.data, "context")
    const altered = { ...result, trace: invalidTrace.trace }
    expect(() => createSpectrumExport(altered)).toThrow()
  })

  it("rejects impossible point, branch, formula, dependency, and citation lineage", () => {
    expectContradiction((data) => {
      data.points[0].branchId = "missing-branch"
    })
    expectContradiction((data) => {
      data.branches[0].id = "missing-trace-branch"
    })
    expectContradiction((data) => {
      data.points[0].formulaId = "missing-formula"
    })
    expectContradiction((data) => {
      data.branches[0].formulaId = "missing-formula"
    })
    expectContradiction((data) => {
      data.formulaIds[0] = "missing-formula"
    })
    expectContradiction((data) => {
      data.metrics.find(({ formulaId }) => formulaId !== null)!.dependencyIds = [
        "missing-dependency",
      ]
    })
    expectContradiction((data) => {
      data.points[0].citationIds = ["undeclared-citation"]
    })
    expectContradiction((data) => {
      data.sourceIds.push(data.sourceIds[0])
    })
    expectContradiction((data) => {
      data.formulaIds.push(data.formulaIds[0])
    })
    expectContradiction((data) => {
      const metric = data.metrics.find(({ id }) => id === "tc")!
      metric.dependencyIds = ["pga"]
    })
    expectContradiction((data) => {
      const metric = data.metrics.find(({ id }) => id === "tc")!
      metric.dependencyIds.reverse()
    })
    expectContradiction((data) => {
      const metric = data.metrics.find(({ formulaId }) => formulaId === null)!
      metric.dependencyIds = ["pga"]
    })
    expectContradiction((data) => {
      data.trace.data.steps.push(structuredClone(data.trace.data.steps[0]))
    })
    expectContradiction((data) => {
      data.trace.data.branches.push(structuredClone(data.trace.data.branches[0]))
    })
  })

  it("rejects ambiguous or formula-inconsistent lineage at export", () => {
    const mutations = [
      (data: SuccessfulData) => {
        const metric = data.metrics.find(({ id }) => id === "tc")!
        metric.dependencyIds = ["pga"]
      },
      (data: SuccessfulData) => {
        const metric = data.metrics.find(({ id }) => id === "tc")!
        metric.dependencyIds.reverse()
      },
      (data: SuccessfulData) => {
        data.trace.data.steps.push(structuredClone(data.trace.data.steps[0]))
      },
      (data: SuccessfulData) => {
        data.trace.data.branches.push(structuredClone(data.trace.data.branches[0]))
      },
    ]

    for (const mutate of mutations) {
      const result = adaptNsr10Spectrum({
        aa: 0.25,
        av: 0.25,
        soilProfile: "D",
        importanceGroup: "II",
      })
      if (result.status !== "ok") throw new Error("Expected successful fixture")
      const data = structuredClone(spectrumResultData(result)) as SuccessfulData
      mutate(data)
      expect(() => createSpectrumExport({ ...data, saAt: result.saAt })).toThrow()
    }
  })

  it("rejects evidence states without their minimum source and citation declarations", () => {
    expectContradiction((data) => {
      data.sourceIds = []
    })
    expectContradiction((data) => {
      data.evidenceAvailability = { status: "available" }
      data.citationIds = []
    })
  })

  it("emits a versioned JSON-safe projection without the evaluator function", () => {
    const result = adaptNsr10Spectrum({
      aa: 0.25,
      av: 0.25,
      soilProfile: "D",
      importanceGroup: "II",
    })
    const exported = createSpectrumExport(result)

    expect(exported.schemaVersion).toBe(SPECTRUM_EXPORT_SCHEMA_VERSION)
    expect(exported.result.schemaVersion).toBe(SPECTRUM_CONTRACT_SCHEMA_VERSION)
    expect("saAt" in exported.result).toBe(false)
    expect(JSON.parse(JSON.stringify(exported))).toEqual(exported)
  })
})
