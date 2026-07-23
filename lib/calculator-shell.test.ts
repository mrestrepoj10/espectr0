import { describe, expect, it } from "vitest"

import { capabilityUiState, parsePeriodInput } from "./calculator-shell"

describe("calculator shell state helpers", () => {
  it("maps explicit engine capability decisions without inferring from engine IDs", () => {
    expect(capabilityUiState({ supported: true })).toEqual({
      enabled: true,
      reason: null,
    })
    expect(
      capabilityUiState({
        supported: false,
        reason: "This study does not support contextual PDF exports.",
      }),
    ).toEqual({
      enabled: false,
      reason: "This study does not support contextual PDF exports.",
    })
  })

  it("accepts zero and positive finite periods and rejects invalid values", () => {
    expect(parsePeriodInput("0")).toEqual({
      status: "valid",
      periodSeconds: 0,
    })
    expect(parsePeriodInput("1.25")).toEqual({
      status: "valid",
      periodSeconds: 1.25,
    })
    expect(parsePeriodInput("").status).toBe("invalid")
    expect(parsePeriodInput("-0.1").status).toBe("invalid")
    expect(parsePeriodInput("not-a-period").status).toBe("invalid")
  })
})
