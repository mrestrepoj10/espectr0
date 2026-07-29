import { describe, expect, it } from "vitest"

import { lookupCcp14ConnectionR, lookupCcp14SubstructureR } from "./r-factors"
import rFactors from "./data/r-factors.json"

describe("CCP-14 bridge R-factor metadata", () => {
  it("looks up fully evidenced substructure and connection rows", () => {
    expect(lookupCcp14SubstructureR(
      "essential",
      "steel-or-composite-frame-vertical-piles-only",
    )).toEqual({
      status: "ok",
      value: 3.5,
      citationIds: [
        "r-substructure-cell-portico-acero-compuesto-pilas-verticales-2",
        "claim-r-application",
      ],
    })
    expect(lookupCcp14ConnectionR("superstructure-to-abutment")).toMatchObject({
      status: "ok",
      value: 0.8,
    })
  })

  it("applies the inelastic time-history override and rejects unlisted elements", () => {
    expect(lookupCcp14SubstructureR("other", "single-columns", true)).toMatchObject({
      status: "ok",
      value: 1,
    })
    expect(lookupCcp14ConnectionR("cable-stayed-tower")).toMatchObject({
      status: "not-tabulated",
    })
    expect(lookupCcp14SubstructureR("unknown", "single-columns")).toMatchObject({
      status: "not-tabulated",
      reason: expect.stringContaining("operational category"),
    })
  })

  it("matches every published R table cell", () => {
    for (const [element, values] of Object.entries(rFactors.substructure.rows)) {
      (["critical", "essential", "other"] as const).forEach((category, index) => {
        expect(lookupCcp14SubstructureR(category, element)).toMatchObject({
          status: "ok",
          value: values[index],
        })
      })
    }
    for (const [element, [value]] of Object.entries(rFactors.connection.rows)) {
      expect(lookupCcp14ConnectionR(element)).toMatchObject({ status: "ok", value })
    }
  })
})
