import { describe, expect, it } from "vitest"

import oracleJson from "./oracle/oracle.json"
import {
  adaptManizalesSpectrum,
  createManizalesScenario,
  manizalesSpectrumEngine,
} from "./adapter"
import { formatSpectrumJson } from "../spectra"
import { resolveSpectrumEvidence } from "../spectra/evidence"
import { type ManizalesZoneId } from "./schema"

type OracleRecord = {
  optionId: ManizalesZoneId
  boundaryCases: {
    period: string
    status: "ok"
    branch: string | null
    saG: string | null
  }[]
}

const records = oracleJson.records as OracleRecord[]

const design = (zoneId: ManizalesZoneId, importanceFactor = 1) =>
  adaptManizalesSpectrum({ zoneId, hazardId: "design", importanceFactor })

describe("Manizales normalized adapter", () => {
  it("returns successful normalized results for all three manual zones", () => {
    for (const record of records) {
      const result = design(record.optionId)
      expect(result.status).toBe("ok")
      if (result.status !== "ok") continue
      expect(result.scenarioEvidenceKey).toMatchObject({
        optionId: record.optionId,
        hazardId: "design",
      })
      expect(result.points[0].tSeconds).toBe(0)
      expect(result.points.at(-1)?.tSeconds).toBe(4)
      expect(result.evidenceAvailability.status).toBe("partial")
      expect(result.hazard.returnPeriodYears).toBeNull()
      expect(result.hazard.dampingRatio).toBe(0.05)
      expect(result.warnings.map(({ code }) => code)).toEqual(
        expect.arrayContaining([
          "professional-zone-validation-required",
          "special-analysis-at-or-above-2s",
          "topographic-amplification-not-applied",
          "importance-factor-applied",
          "municipal-return-period-unknown",
        ]),
      )
      expect(result.sourceIds).toEqual(
        expect.arrayContaining([
          "manizales-uniandes-2002-figuras",
          "manizales-uniandes-2002",
          "nsr10-title-a-2017",
        ]),
      )
    }
  })

  it("reproduces the independent oracle through every branch of every zone", () => {
    for (const record of records) {
      const result = design(record.optionId)
      if (result.status !== "ok") throw new Error("unreachable")
      for (const oracleCase of record.boundaryCases) {
        const ordinate = result.saAt(Number(oracleCase.period))
        expect(ordinate.status, `${record.optionId} T=${oracleCase.period}`).toBe("ok")
        if (ordinate.status !== "ok") continue
        expect(ordinate.point.branchId).toBe(oracleCase.branch)
        expect(ordinate.point.saG).toBeCloseTo(Number(oracleCase.saG), 12)
      }
    }
  })

  it("declares all four printed branches and cites each of them", () => {
    const result = design("zone-a")
    if (result.status !== "ok") throw new Error("unreachable")
    expect(result.branches.map(({ id }) => id)).toEqual([
      "manizales-entrance",
      "manizales-plateau",
      "manizales-inverse",
      "manizales-floor",
    ])
    for (const branch of result.branches) {
      expect(branch.citationIds).toHaveLength(1)
      expect(result.citationIds).toContain(branch.citationIds[0])
    }
  })

  it("only warns about the Zone C justification when Zone C is selected", () => {
    const zoneC = design("zone-c")
    const zoneA = design("zone-a")
    if (zoneC.status !== "ok" || zoneA.status !== "ok") throw new Error("unreachable")
    expect(zoneC.warnings.map(({ code }) => code)).toContain(
      "zone-c-requires-explicit-justification",
    )
    expect(zoneA.warnings.map(({ code }) => code)).not.toContain(
      "zone-c-requires-explicit-justification",
    )
  })

  it("cites every one of the seven tabulated cells as a direct source value", () => {
    const result = design("zone-b")
    if (result.status !== "ok") throw new Error("unreachable")
    const direct = result.trace?.data.steps.filter(
      (step) => (step as { classification?: string }).classification === "direct-source",
    )
    expect(direct).toHaveLength(7)
    for (const field of ["to", "tc", "tl", "am", "an", "fa", "fv"]) {
      expect(result.citationIds).toContain(`cell-zone-b-${field}`)
    }
  })

  it("leaves the published curve untouched at I = 1 and scales it otherwise", () => {
    const plateauAt = (importanceFactor: number) => {
      const result = design("zone-a", importanceFactor)
      if (result.status !== "ok") throw new Error("unreachable")
      return result.metrics.find(({ id }) => id === "saMax")?.value ?? 0
    }
    expect(plateauAt(1)).toBeCloseTo(1.1, 12)
    expect(plateauAt(1.5)).toBeCloseTo(1.65, 12)
  })

  it("rejects an unknown zone with a typed invalid result that carries no lineage", () => {
    const result = adaptManizalesSpectrum({
      zoneId: "zone-z",
      hazardId: "design",
      importanceFactor: 1,
    })
    expect(result.status).toBe("invalid-input")
    expect(result.evidenceAvailability.status).toBe("unavailable")
    expect(result.trace).toBeNull()
  })

  it("resolves an evidence view that serves the two committed source pages", () => {
    const result = design("zone-a")
    if (result.status !== "ok") throw new Error("unreachable")
    const view = resolveSpectrumEvidence(result, result.scenarioEvidenceKey)
    expect(view.status).toBe("partial")
    expect(view.selection.zone).toBe("Zona A")
    const figures = view.documents.find(
      ({ sourceId }) => sourceId === "manizales-uniandes-2002-figuras",
    )
    expect(figures?.localPath).toBe("/manizales/uniandes-2002-figuras-8.1-8.5.pdf")
    expect(figures?.localPageMap).toEqual({ "197": 1, "201": 2 })
    // A branch whose expression does not reach the drawer is a lineage row the
    // reader cannot check, which is exactly the regression this guards.
    for (const branch of view.branchLineage) {
      expect(branch.formula, branch.branchId).toBeTruthy()
      expect(branch.condition, branch.branchId).toBeTruthy()
    }
  })

  it("accepts its own scenario and serializes", () => {
    const scenario = createManizalesScenario({
      zoneId: "zone-c",
      hazardId: "design",
      importanceFactor: 1.1,
    })
    expect(manizalesSpectrumEngine.accepts(scenario)).toBe(true)
    const result = manizalesSpectrumEngine.compute(scenario)
    expect(result.status).toBe("ok")
    expect(() => formatSpectrumJson(result)).not.toThrow()
  })
})
