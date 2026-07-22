import { describe, expect, it } from "vitest"

import {
  convertWeight,
  createUniformStories,
  parseStoryRows,
  storyForceCsv,
  weightToKn,
} from "./base-shear-ui"

describe("base shear UI helpers", () => {
  it("normalizes all supported units to kN using the engine gravity", () => {
    expect(weightToKn(98, "kn")).toBe(98)
    expect(weightToKn(10, "tonf")).toBeCloseTo(98)
    expect(weightToKn(10_000, "kg")).toBeCloseTo(98)
  })

  it("round-trips weight conversions", () => {
    expect(convertWeight(convertWeight(1_250, "kn", "kg"), "kg", "kn")).toBeCloseTo(
      1_250,
    )
  })

  it("creates uniform weights and cumulative story heights", () => {
    expect(createUniformStories(3, 900, 9)).toEqual([
      { wx: 300, hx: 3 },
      { wx: 300, hx: 6 },
      { wx: 300, hx: 9 },
    ])
  })

  it("parses comma, semicolon, tab, or whitespace separated rows", () => {
    expect(parseStoryRows("wi,hi\n300,3\n300;6\n300\t9\n300 12")).toEqual({
      ok: true,
      stories: [
        { wx: 300, hx: 3 },
        { wx: 300, hx: 6 },
        { wx: 300, hx: 9 },
        { wx: 300, hx: 12 },
      ],
    })
  })

  it("rejects malformed and non-increasing story rows", () => {
    expect(parseStoryRows("300,3,extra")).toMatchObject({ ok: false })
    expect(parseStoryRows("300,3\n300,3")).toEqual({
      ok: false,
      error: "Las alturas deben aumentar estrictamente desde la base.",
    })
  })

  it("serializes force rows with an explicit CSV contract", () => {
    expect(
      storyForceCsv([
        { index: 0, wx: 500, hx: 3, cvx: 1, fx: 100, storyShear: 100 },
      ]),
    ).toBe(
      "Nivel,wi (kN),hi (m),Cvx,Fx (kN),V nivel (kN)\n1,500,3,1,100,100",
    )
  })
})
