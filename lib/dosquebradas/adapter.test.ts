import { describe, expect, it } from "vitest"

import oracleJson from "./oracle/oracle.json"
import {
  adaptDosquebradasSpectrum,
  createDosquebradasScenario,
  dosquebradasSpectrumEngine,
} from "./adapter"
import { type DosquebradasZoneId } from "./schema"

type OracleRecord = {
  optionId: DosquebradasZoneId
  boundaryCases: {
    period: string
    status: "ok" | "unsupported"
    branch: string | null
    saG: string | null
  }[]
}

const records = oracleJson.records as OracleRecord[]

describe("Dosquebradas normalized adapter", () => {
  it("returns successful normalized results for all five manual zones", () => {
    for (const record of records) {
      const result = adaptDosquebradasSpectrum({
        zoneId: record.optionId,
        hazardId: "design",
        importanceFactor: 1,
      })
      expect(result.status).toBe("ok")
      if (result.status !== "ok") continue
      expect(result.scenarioEvidenceKey).toMatchObject({
        optionId: record.optionId,
        hazardId: "design",
      })
      expect(result.points[0].tSeconds).toBe(
        result.metrics.find(({ id }) => id === "to")?.value,
      )
      expect(result.evidenceAvailability.status).toBe("partial")
      expect(result.warnings.map(({ code }) => code)).toContain(
        "professional-zone-validation-required",
      )
      expect(result.sourceIds).toEqual(
        expect.arrayContaining([
          "pot-2024-diagnostico-amenazas",
          "nsr10-title-a-2017",
        ]),
      )
    }
  })

  it("keeps saAt in parity with every independent boundary witness", () => {
    for (const record of records) {
      const result = adaptDosquebradasSpectrum({
        zoneId: record.optionId,
        hazardId: "design",
        importanceFactor: 1,
      })
      expect(result.status).toBe("ok")
      for (const oracleCase of record.boundaryCases) {
        const ordinate = result.saAt(Number(oracleCase.period))
        expect(ordinate.status).toBe(oracleCase.status)
        if (ordinate.status !== "ok") continue
        expect(ordinate.point.branchId).toBe(oracleCase.branch)
        expect(ordinate.point.saG).toBeCloseTo(Number(oracleCase.saG), 12)
      }
    }
  })

  it("returns a typed localized warning below To", () => {
    const result = adaptDosquebradasSpectrum({
      zoneId: "zona-5",
      hazardId: "design",
      importanceFactor: 1,
    })
    const ordinate = result.saAt(0.099)
    expect(ordinate).toMatchObject({
      status: "unsupported",
      applicability: {
        reasonCode: "dosquebradas-entrance-branch-unavailable",
        citationIds: ["table-27"],
      },
    })
  })

  it.each([
    [{ zoneId: "zona-6", hazardId: "design", importanceFactor: 1 }],
    [{ zoneId: "zona-1", hazardId: "safety", importanceFactor: 1 }],
    [{ zoneId: "zona-1", hazardId: "design", importanceFactor: 0 }],
    [{ zoneId: "zona-1", hazardId: "design" }],
  ])("rejects invalid input %#", (input) => {
    expect(adaptDosquebradasSpectrum(input).status).toBe("invalid-input")
  })

  it("exposes the isolated scenario engine without shared registry integration", () => {
    const scenario = createDosquebradasScenario({
      zoneId: "zona-3",
      hazardId: "design",
      importanceFactor: 1.25,
    })
    expect(dosquebradasSpectrumEngine.accepts(scenario)).toBe(true)
    expect(dosquebradasSpectrumEngine.compute(scenario)).toMatchObject({
      status: "ok",
      engine: { id: "dosquebradas-spectrum" },
    })
  })

  it("binds every direct trace value to its exact Table 27 cell", () => {
    const result = adaptDosquebradasSpectrum({
      zoneId: "zona-4",
      hazardId: "design",
      importanceFactor: 1,
    })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    const directSteps = result.trace.data.steps.filter(
      (step) => step.classification === "direct-source",
    )
    expect(directSteps).toHaveLength(6)
    for (const step of directSteps) {
      const field = step.id.split("-").at(-1)
      expect(step.citationIds).toEqual([`cell-zona-4-${field}`])
      expect(step.dependencies).toEqual([])
    }
  })
})
