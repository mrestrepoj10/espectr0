import { describe, expect, it } from "vitest"

import oracleJson from "./oracle/oracle.json"
import {
  MEDELLIN_MAX_PERIOD_SECONDS,
  evaluateMedellinOrdinate,
} from "./engine"
import type { MedellinHazardId, MedellinZoneId } from "./schema"

type OracleRecord = {
  optionId: MedellinZoneId
  hazardId: MedellinHazardId
  engineWitnesses: {
    importanceFactor: string
    smax: string
    cases: {
      period: string
      status: "ok" | "unsupported"
      branch: string | null
      saG: string | null
    }[]
  }[]
}

const records = oracleJson.records as OracleRecord[]

describe("Medellín spectrum engine", () => {
  it("matches every independent Decimal witness for 14 zones and both hazards", () => {
    expect(records).toHaveLength(28)
    for (const record of records) {
      for (const witness of record.engineWitnesses) {
        for (const expected of witness.cases) {
          const result = evaluateMedellinOrdinate({
            zoneId: record.optionId,
            hazardId: record.hazardId,
            importanceFactor: Number(witness.importanceFactor),
            tSeconds: Number(expected.period),
          })
          expect(result.status).toBe(expected.status)
          if (result.status !== "ok") continue
          expect(result.point.branchId).toBe(expected.branch)
          expect(result.point.saG).toBeCloseTo(Number(expected.saG), 12)
        }
      }
    }
  })

  it("keeps both published boundaries on their stated branches", () => {
    const atT0 = evaluateMedellinOrdinate({
      zoneId: "zone-03",
      hazardId: "design",
      importanceFactor: 1,
      tSeconds: 0.2,
    })
    const atTc = evaluateMedellinOrdinate({
      zoneId: "zone-03",
      hazardId: "design",
      importanceFactor: 1,
      tSeconds: 0.7,
    })
    expect(atT0).toMatchObject({
      status: "ok",
      point: { branchId: "medellin-plateau", saG: 0.798 },
    })
    expect(atTc).toMatchObject({
      status: "ok",
      point: { branchId: "medellin-plateau", saG: 0.798 },
    })
  })

  it("applies the user importance factor through the published Smax equation", () => {
    const result = evaluateMedellinOrdinate({
      zoneId: "zone-03",
      hazardId: "design",
      importanceFactor: 1.25,
      tSeconds: 0.2,
    })
    expect(result).toMatchObject({
      status: "ok",
      point: { saG: 0.9975 },
    })
  })

  it("fails locally outside the source-backed period interval", () => {
    const base = {
      zoneId: "zone-01" as const,
      hazardId: "damage-control" as const,
      importanceFactor: 1,
    }
    expect(evaluateMedellinOrdinate({ ...base, tSeconds: 0.099 })).toMatchObject({
      status: "unsupported",
      interval: "below-t0",
    })
    expect(
      evaluateMedellinOrdinate({
        ...base,
        tSeconds: MEDELLIN_MAX_PERIOD_SECONDS + 0.001,
      }),
    ).toMatchObject({ status: "unsupported", interval: "above-4s" })
  })

  it("rejects non-finite, negative, and invalid importance inputs", () => {
    expect(
      evaluateMedellinOrdinate({
        zoneId: "zone-01",
        hazardId: "design",
        importanceFactor: 1,
        tSeconds: -0.1,
      }),
    ).toMatchObject({ status: "invalid-input" })
    expect(
      evaluateMedellinOrdinate({
        zoneId: "zone-01",
        hazardId: "design",
        importanceFactor: 0,
        tSeconds: 1,
      }),
    ).toMatchObject({ status: "invalid-input" })
  })
})
