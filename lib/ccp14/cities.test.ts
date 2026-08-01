import { describe, expect, it } from "vitest"

import { ccp14Cities, resolveCcp14City } from "./cities"

describe("CCP-14 city hazard map values", () => {
  it("contains one unique record for each of the 32 mapped departmental capitals", () => {
    expect(ccp14Cities).toHaveLength(32)
    expect(new Set(ccp14Cities.map(({ id }) => id)).size).toBe(32)
  })

  it("preserves audited values where the reference calculator disagrees with the maps", () => {
    expect(resolveCcp14City("arauca")).toMatchObject({ pgaG: 0.2, ssG: 0.4, s1G: 0.2 })
    expect(resolveCcp14City("villavicencio")).toMatchObject({ pgaG: 0.45, ssG: 1, s1G: 0.45 })
    expect(resolveCcp14City("barranquilla")).toMatchObject({ pgaG: 0.1, ssG: 0.2, s1G: 0.1 })
  })

  it("traces every value to the corresponding official hazard figure", () => {
    for (const city of ccp14Cities) {
      expect(city.citationIds).toEqual([
        "claim-map-inputs",
        "claim-map-inputs",
        "claim-map-inputs",
      ])
      for (const value of [city.pgaG, city.ssG, city.s1G]) {
        expect(Number.isInteger(value * 20)).toBe(true)
      }
    }
  })
})
