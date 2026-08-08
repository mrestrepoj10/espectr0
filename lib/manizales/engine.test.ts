import { describe, expect, it } from "vitest"

import oracleJson from "./oracle/oracle.json"
import { evaluateManizalesOrdinate } from "./engine"
import { manizalesRows, type ManizalesZoneId } from "./schema"

type OracleCase = {
  period: string
  status: "ok"
  branch: string | null
  saG: string | null
}

type OracleRecord = {
  optionId: ManizalesZoneId
  fields: Record<string, number>
  continuity: Record<string, string>
  boundaryCases: OracleCase[]
}

const records = oracleJson.records as OracleRecord[]

describe("Manizales pure spectrum engine", () => {
  it("uses every one of the three exact Figura 8.5 columns", () => {
    expect(records).toHaveLength(3)
    expect(manizalesRows).toHaveLength(3)
    for (const record of records) {
      expect(
        manizalesRows.find(({ optionId }) => optionId === record.optionId)?.fields,
      ).toEqual(record.fields)
    }
  })

  it("matches the independent Decimal oracle just-left/exact/right of every boundary", () => {
    for (const record of records) {
      for (const oracleCase of record.boundaryCases) {
        const result = evaluateManizalesOrdinate({
          zoneId: record.optionId,
          tSeconds: Number(oracleCase.period),
          importanceFactor: 1,
        })
        expect(result.status, `${record.optionId} T=${oracleCase.period}`).toBe(
          oracleCase.status,
        )
        if (result.status !== "ok") continue
        expect(result.point.branchId).toBe(oracleCase.branch)
        expect(result.point.saG).toBeCloseTo(Number(oracleCase.saG), 12)
      }
    }
  })

  it("keeps To on the entrance branch, Tc on the plateau and TL on the inverse branch", () => {
    for (const row of manizalesRows) {
      const at = (tSeconds: number) =>
        evaluateManizalesOrdinate({
          zoneId: row.optionId,
          tSeconds,
          importanceFactor: 1,
        })
      expect(at(row.fields.to).status === "ok" && at(row.fields.to).status).toBe("ok")
      const atTo = at(row.fields.to)
      const atTc = at(row.fields.tc)
      const atTl = at(row.fields.tl)
      const pastTl = at(row.fields.tl + 0.01)
      if (atTo.status !== "ok" || atTc.status !== "ok") throw new Error("unreachable")
      if (atTl.status !== "ok" || pastTl.status !== "ok") throw new Error("unreachable")
      expect(atTo.point.branchId).toBe("manizales-entrance")
      expect(atTc.point.branchId).toBe("manizales-plateau")
      expect(atTl.point.branchId).toBe("manizales-inverse")
      expect(pastTl.point.branchId).toBe("manizales-floor")
    }
  })

  it("carries the study's own rounding at the Zone A branch limits instead of smoothing it", () => {
    const zoneA = records.find(({ optionId }) => optionId === "zone-a")
    const zoneB = records.find(({ optionId }) => optionId === "zone-b")
    if (!zoneA || !zoneB) throw new Error("missing oracle record")
    // Zones B and C join exactly; Zone A's printed Tc and TL are rounded to the
    // hundredth, so the published curve steps. Transcription governs.
    expect(Number(zoneB.continuity.plateau)).toBeCloseTo(
      Number(zoneB.continuity.inverseAtTc),
      12,
    )
    expect(Number(zoneA.continuity.plateau)).toBeCloseTo(1.1, 12)
    expect(Number(zoneA.continuity.inverseAtTc)).toBeCloseTo(1.1034, 4)
    expect(Number(zoneA.continuity.floor)).toBeCloseTo(0.22, 12)
  })

  it("has no unsupported interval, unlike the partially attested studies", () => {
    for (const period of [0, 0.001, 1, 3, 4, 10, 100]) {
      expect(
        evaluateManizalesOrdinate({
          zoneId: "zone-a",
          tSeconds: period,
          importanceFactor: 1,
        }).status,
      ).toBe("ok")
    }
  })

  it("rejects a negative period and a non-positive importance factor", () => {
    expect(
      evaluateManizalesOrdinate({ zoneId: "zone-a", tSeconds: -1, importanceFactor: 1 })
        .status,
    ).toBe("invalid-input")
    expect(
      evaluateManizalesOrdinate({ zoneId: "zone-a", tSeconds: 1, importanceFactor: 0 })
        .status,
    ).toBe("invalid-input")
  })

  it("scales the whole curve by the importance coefficient", () => {
    const one = evaluateManizalesOrdinate({
      zoneId: "zone-b",
      tSeconds: 0.3,
      importanceFactor: 1,
    })
    const heavy = evaluateManizalesOrdinate({
      zoneId: "zone-b",
      tSeconds: 0.3,
      importanceFactor: 1.5,
    })
    if (one.status !== "ok" || heavy.status !== "ok") throw new Error("unreachable")
    expect(heavy.point.saG).toBeCloseTo(one.point.saG * 1.5, 12)
  })
})
