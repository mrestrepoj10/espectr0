import { describe, expect, it } from "vitest"

import { evaluateCaliOrdinate } from "./engine"
import oracleJson from "./oracle/oracle.json"

type OracleRecord = {
  optionId: string
  hazardId: string
  status: string
  samples: Array<{
    periodSeconds: string
    branch: string
    spectralAccelerationG: string
  }>
}

const completeRecords = (oracleJson.records as OracleRecord[]).filter(
  ({ hazardId, status }) =>
    (hazardId === "design" || hazardId === "safety-limited") &&
    status === "complete-three-branch-oracle",
)

function expectedBranch(sourceBranch: string) {
  if (sourceBranch.startsWith("plateau")) return "plateau"
  if (sourceBranch.startsWith("inverse-square")) return "inverse-square"
  return "inverse"
}

describe("Cali source-complete spectrum engine", () => {
  it("matches every independent Decimal witness for design and limited safety", () => {
    expect(completeRecords).toHaveLength(26)
    for (const record of completeRecords) {
      for (const sample of record.samples) {
        const result = evaluateCaliOrdinate({
          optionId: record.optionId,
          hazardId: record.hazardId as "design" | "safety-limited",
          tSeconds: Number(sample.periodSeconds),
        })
        expect(result.status).toBe("ok")
        if (result.status !== "ok") continue
        expect(result.point.branchId).toBe(expectedBranch(sample.branch))
        const expected = Number(sample.spectralAccelerationG)
        expect(Math.abs(result.point.saG - expected)).toBeLessThanOrEqual(
          Math.max(1e-12, Math.abs(expected) * 1e-12),
        )
      }
    }
  })

  it("keeps the damage curve explicitly unavailable", () => {
    expect(
      evaluateCaliOrdinate({
        optionId: "zone-1",
        hazardId: "damage-threshold",
        tSeconds: 1,
      }),
    ).toMatchObject({
      status: "unsupported",
      reasonCode: "cali-damage-inputs-missing",
    })
  })

  it.each([
    { optionId: "unknown", hazardId: "design" as const, tSeconds: 1 },
    { optionId: "zone-1", hazardId: "design" as const, tSeconds: -1 },
    { optionId: "zone-1", hazardId: "design" as const, tSeconds: Number.NaN },
    {
      optionId: "zone-1",
      hazardId: "design" as const,
      tSeconds: 1,
      importanceFactor: 0,
    },
  ])("fails closed for invalid input %#", (input) => {
    expect(evaluateCaliOrdinate(input).status).toBe("invalid-input")
  })
})
