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
	expect(isSourceBlockedMode("ccp14")).toBe(false)
	expect(isSourceBlockedMode("bogota-microzonation")).toBe(false)
	expect(isSourceBlockedMode("medellin-microzonation")).toBe(false)
	expect(isSourceBlockedMode("cali-microzonation")).toBe(false)
	expect(isSourceBlockedMode("dosquebradas-microzonation")).toBe(false)
	expect(isSourceBlockedMode("manizales-microzonation")).toBe(false)
  })

  it("keeps active municipal engines out of the source-blocked record", () => {
    expect(Object.keys(sourceBlockedModes)).not.toContain("bogota-microzonation")
    expect(Object.keys(sourceBlockedModes)).not.toContain("medellin-microzonation")
    expect(Object.keys(sourceBlockedModes)).not.toContain("cali-microzonation")
	expect(Object.keys(sourceBlockedModes)).not.toContain("ccp14")
	expect(Object.keys(sourceBlockedModes)).not.toContain("dosquebradas-microzonation")
	expect(Object.keys(sourceBlockedModes)).not.toContain("manizales-microzonation")
    expect(calculationModes.find(({ id }) => id === "bogota-microzonation")?.description)
      .toContain("Cálculo manual")
    expect(calculationModes.find(({ id }) => id === "cali-microzonation")?.description)
      .toContain("Cálculo manual")
    expect(calculationModes.find(({ id }) => id === "medellin-microzonation")?.description)
      .toContain("14 zonas")
    expect(calculationModes.find(({ id }) => id === "manizales-microzonation")?.description)
      .toContain("Figura 8.5")
  })
})
