import { describe, expect, it } from "vitest"

import oracleJson from "./oracle/oracle.json"
import {
  deriveDosquebradasAv,
  evaluateDosquebradasOrdinate,
} from "./engine"
import { dosquebradasRows, type DosquebradasZoneId } from "./schema"

type OracleCase = {
  period: string
  status: "ok" | "unsupported"
  branch: string | null
  saG: string | null
}

type OracleRecord = {
  optionId: DosquebradasZoneId
  fields: Record<string, number>
  derivedAv: string
  boundaryCases: OracleCase[]
}

const records = oracleJson.records as OracleRecord[]

describe("Dosquebradas pure spectrum engine", () => {
  it("uses every one of the five exact POT 2024 Table 27 rows", () => {
    expect(records).toHaveLength(5)
    expect(dosquebradasRows).toHaveLength(5)
    for (const record of records) {
      expect(dosquebradasRows.find(({ optionId }) => optionId === record.optionId)?.fields)
        .toEqual(record.fields)
      expect(deriveDosquebradasAv(record.optionId)).toBeCloseTo(
        Number(record.derivedAv),
        14,
      )
    }
  })

  it("matches the independent Decimal oracle just-left/exact/right of every boundary", () => {
    for (const record of records) {
      for (const oracleCase of record.boundaryCases) {
        const result = evaluateDosquebradasOrdinate({
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

  it("keeps Tc on the plateau and TL on the inverse branch", () => {
    for (const row of dosquebradasRows) {
      const atTc = evaluateDosquebradasOrdinate({
        zoneId: row.optionId,
        tSeconds: row.fields.tc,
        importanceFactor: 1,
      })
      const atTl = evaluateDosquebradasOrdinate({
        zoneId: row.optionId,
        tSeconds: row.fields.tl,
        importanceFactor: 1,
      })
      expect(atTc).toMatchObject({
        status: "ok",
        point: { branchId: "dosquebradas-plateau" },
      })
      expect(atTl).toMatchObject({
        status: "ok",
        point: { branchId: "dosquebradas-inverse" },
      })
    }
  })

  it("localizes the unattested T < To interval instead of inventing it", () => {
    const result = evaluateDosquebradasOrdinate({
      zoneId: "zona-1",
      tSeconds: 0.049,
      importanceFactor: 1,
    })
    expect(result).toMatchObject({ status: "unsupported" })
    expect(result.status === "unsupported" && result.message).toContain("T < To")
  })

  it("rejects invalid periods and importance factors", () => {
    for (const tSeconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        evaluateDosquebradasOrdinate({
          zoneId: "zona-1",
          tSeconds,
          importanceFactor: 1,
        }).status,
      ).toBe("invalid-input")
    }
    expect(
      evaluateDosquebradasOrdinate({
        zoneId: "zona-1",
        tSeconds: 1,
        importanceFactor: 0,
      }).status,
    ).toBe("invalid-input")
  })
})
