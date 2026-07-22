import { describe, expect, it } from "vitest"

import {
  SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  SPECTRUM_CONTRACT_SCHEMA_VERSION,
  SPECTRUM_EXPORT_SCHEMA_VERSION,
  ccp14ScenarioSchema,
  createSpectrumExport,
  municipalStudyScenarioSchema,
  normalizedSpectrumResultDataSchema,
  nsr10Capabilities,
  spectrumCapabilitiesSchema,
  spectrumCapabilityKeys,
  spectrumScenarioSchema,
} from "."

describe("engine-neutral spectrum contract", () => {
  it("runtime-validates every discriminated scenario family", () => {
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

  it("enforces matching status and applicability states", () => {
    const minimal = {
      schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
      status: "ok",
      engine: { id: "test", version: "1" },
      study: { id: "test", version: "1" },
      scenarioType: "municipal-study",
      normalizedInputs: {},
      points: [],
      metrics: [],
      formulaIds: [],
      branches: [],
      hazard: {
        id: "test",
        label: "Test",
        returnPeriodYears: 475,
        dampingRatio: 0.05,
      },
      warnings: [],
      applicability: {
        status: "unsupported",
        reasonCode: "test",
        message: "Not supported",
        citationIds: [],
      },
      sourceIds: ["test-source"],
      citationIds: ["test-citation"],
      traceSchemaVersion: 1,
      trace: null,
      capabilities: nsr10Capabilities,
    }

    expect(normalizedSpectrumResultDataSchema.safeParse(minimal).success).toBe(false)
  })

  it("emits a versioned JSON-safe projection without the evaluator function", async () => {
    const { adaptNsr10Spectrum } = await import(".")
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
