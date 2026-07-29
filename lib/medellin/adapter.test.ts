import { describe, expect, it } from "vitest"

import oracleJson from "./oracle/oracle.json"
import {
  adaptMedellinSpectrum,
  createMedellinScenario,
  medellinSpectrumEngine,
} from "./adapter"
import { createSpectrumExport } from "../spectra"
import type { MedellinHazardId, MedellinZoneId } from "./schema"

type OracleRecord = {
  optionId: MedellinZoneId
  hazardId: MedellinHazardId
  engineWitnesses: {
    importanceFactor: string
    cases: {
      period: string
      status: "ok" | "unsupported"
      branch: string | null
      saG: string | null
    }[]
  }[]
}

const records = oracleJson.records as OracleRecord[]

describe("Medellín normalized adapter", () => {
  it("returns a successful result for every manual zone and source hazard", () => {
    for (const record of records) {
      const result = adaptMedellinSpectrum({
        zoneId: record.optionId,
        hazardId: record.hazardId,
        importanceFactor: 1,
      })
      expect(result.status).toBe("ok")
      if (result.status !== "ok") continue
      expect(result.scenarioEvidenceKey).toMatchObject({
        optionId: record.optionId,
        hazardId: record.hazardId,
      })
      expect(result.points[0].tSeconds).toBe(
        result.metrics.find(({ id }) => id === "plateau_start")?.value,
      )
      expect(result.points.at(-1)?.tSeconds).toBe(4)
      expect(result.hazard.dampingRatio).toBe(
        record.hazardId === "design" ? 0.05 : 0.02,
      )
      expect(result.hazard.returnPeriodYears).toBeNull()
      expect(result.evidenceAvailability.status).toBe("partial")
      expect(result.warnings.map(({ code }) => code)).toEqual(
        expect.arrayContaining([
          "professional-zone-validation-required",
          "rising-branch-equation-unavailable",
          "historical-return-period-unknown",
        ]),
      )
    }
  })

  it("keeps saAt aligned with the independent Decimal oracle", () => {
    for (const record of records) {
      for (const witness of record.engineWitnesses) {
        const result = adaptMedellinSpectrum({
          zoneId: record.optionId,
          hazardId: record.hazardId,
          importanceFactor: Number(witness.importanceFactor),
        })
        for (const expected of witness.cases) {
          const ordinate = result.saAt(Number(expected.period))
          expect(ordinate.status).toBe(expected.status)
          if (ordinate.status !== "ok") continue
          expect(ordinate.point.branchId).toBe(expected.branch)
          expect(ordinate.point.saG).toBeCloseTo(Number(expected.saG), 12)
        }
      }
    }
  })

  it("returns typed localized outcomes below T0 and above 4 seconds", () => {
    const result = adaptMedellinSpectrum({
      zoneId: "zone-12",
      hazardId: "design",
      importanceFactor: 1,
    })
    expect(result.saAt(0.149)).toMatchObject({
      status: "unsupported",
      applicability: {
        reasonCode: "medellin-rising-branch-equation-unavailable",
        citationIds: [
          "cell-design-zone-12-plateau_start",
          "figure-spectrum-branches",
        ],
      },
    })
    expect(result.saAt(4.001)).toMatchObject({
      status: "unsupported",
      applicability: {
        reasonCode: "medellin-period-domain-exceeded",
        citationIds: ["warning-period-domain"],
      },
    })
  })

  it("uses the stated Smax equation while preserving the rounded table value", () => {
    const result = adaptMedellinSpectrum({
      zoneId: "zone-01",
      hazardId: "design",
      importanceFactor: 1,
    })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.metrics.find(({ id }) => id === "smax")?.value).toBeCloseTo(
      0.702,
      12,
    )
    expect(
      result.metrics.find(({ id }) => id === "plateau_per_importance")?.value,
    ).toBe(0.7)
    expect(result.warnings.map(({ code }) => code)).toContain(
      "source-equation-controls-rounded-display",
    )
  })

  it("exports the unknown municipal return period as null", () => {
    const result = adaptMedellinSpectrum({
      zoneId: "zone-01",
      hazardId: "damage-control",
      importanceFactor: 1,
    })
    const exported = createSpectrumExport(result)
    expect(exported.result.status).toBe("ok")
    if (exported.result.status !== "ok") return
    expect(exported.result.hazard.returnPeriodYears).toBeNull()
  })

  it.each([
    [{ zoneId: "zone-15", hazardId: "design", importanceFactor: 1 }],
    [{ zoneId: "zone-01", hazardId: "service", importanceFactor: 1 }],
    [{ zoneId: "zone-01", hazardId: "design", importanceFactor: 0 }],
    [{ zoneId: "zone-01", hazardId: "design" }],
  ])("rejects invalid input %#", (input) => {
    expect(adaptMedellinSpectrum(input).status).toBe("invalid-input")
  })

  it("exposes an isolated normalized engine without shared UI integration", () => {
    const scenario = createMedellinScenario({
      zoneId: "zone-08",
      hazardId: "damage-control",
      importanceFactor: 1.25,
    })
    expect(medellinSpectrumEngine.accepts(scenario)).toBe(true)
    expect(medellinSpectrumEngine.compute(scenario)).toMatchObject({
      status: "ok",
      engine: { id: "medellin-spectrum" },
    })
  })

  it("binds every direct trace value to its exact source cell", () => {
    const result = adaptMedellinSpectrum({
      zoneId: "zone-04",
      hazardId: "damage-control",
      importanceFactor: 1,
    })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    const direct = result.trace.data.steps.filter(
      (step) => step.classification === "direct-source",
    )
    expect(direct).toHaveLength(6)
    for (const step of direct) {
      const field = step.id.replace("medellin-damage-control-zone-04-", "")
      expect(step.citationIds).toEqual([
        `cell-damage-control-zone-04-${field}`,
      ])
      expect(step.dependencies).toEqual([])
    }
  })

  it("keeps only export capabilities enabled", () => {
    const result = adaptMedellinSpectrum({
      zoneId: "zone-01",
      hazardId: "design",
      importanceFactor: 1,
    })
    expect(result.capabilities.csvExport).toEqual({ supported: true })
    expect(result.capabilities.jsonExport).toEqual({ supported: true })
    expect(result.capabilities.buildingBaseShear).toMatchObject({ supported: false })
    expect(result.capabilities.bridgeRFactorWorkflow).toMatchObject({
      supported: false,
    })
  })
})
