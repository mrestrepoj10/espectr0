import { describe, expect, it } from "vitest"

import {
  calculationModes,
  isSourceBlockedMode,
  sourceBlockedModes,
} from "./municipal-mode-catalog"

describe("municipal calculator mode catalog", () => {
  it("lists every requested mode exactly once", () => {
    expect(calculationModes.map(({ id }) => id)).toEqual([
      "nsr10-national",
      "ccp14",
      "bogota-microzonation",
      "medellin-microzonation",
      "cali-microzonation",
      "manizales-microzonation",
      "armenia-microzonation",
      "pereira-microzonation",
      "santa-rosa-microzonation",
      "dosquebradas-microzonation",
    ])
  })

  it("requires an official source and explicit blockers for every closed mode", () => {
    for (const mode of Object.values(sourceBlockedModes)) {
      expect(new URL(mode.sourceUrl).protocol).toBe("https:")
      expect(mode.sourceTitle.length).toBeGreaterThan(10)
      expect(mode.blockers.length).toBeGreaterThan(0)
      expect(isSourceBlockedMode(mode.id)).toBe(true)
    }
    expect(isSourceBlockedMode("nsr10-national")).toBe(false)
    expect(isSourceBlockedMode("bogota-microzonation")).toBe(false)
  })
})
