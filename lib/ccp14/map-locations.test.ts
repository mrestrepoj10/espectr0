import { describe, expect, it } from "vitest"

import {
  ccp14DirectMapValues,
  ccp14LegendValue,
  ccp14MapFigure,
  ccp14MapFigures,
  ccp14MapLocations,
  ccp14MapRegionCountConflict,
} from "./map-locations"

describe("CCP-14 hazard map locations", () => {
  it("carries the three figures with the pages they are printed on", () => {
    expect(
      ccp14MapFigures.map(({ coefficient, physicalPage, printedPage }) => [
        coefficient,
        physicalPage,
        printedPage,
      ]),
    ).toEqual([
      ["PGA", 51, "3-47"],
      ["Ss", 52, "3-48"],
      ["S1", 53, "3-49"],
    ])
  })

  it("transcribes each legend exactly as the figure prints it", () => {
    const pga = ccp14MapFigure("PGA")
    expect(pga.regions).toHaveLength(11)
    expect(pga.regions[0]).toEqual([1, 0.05])
    expect(pga.regions.at(-1)).toEqual([11, 0.55])

    const ss = ccp14MapFigure("Ss")
    expect(ss.regions).toHaveLength(13)
    expect(ss.regions.at(-1)).toEqual([13, 1.3])

    const s1 = ccp14MapFigure("S1")
    expect(s1.regions).toHaveLength(14)
    expect(s1.regions.at(-1)).toEqual([14, 0.7])

    expect(ccp14LegendValue("PGA", 4)).toBe(0.2)
    expect(() => ccp14LegendValue("Ss", 14)).toThrow(RangeError)
  })

  it("records that Apéndice C3 disagrees with the printed legends", () => {
    expect(ccp14MapRegionCountConflict.status).toBe("unresolved")
    expect(ccp14MapRegionCountConflict.appendixText).toContain("14 zonas")
    expect(ccp14MapRegionCountConflict.figureLegends).toContain("13 Ss regions")
  })

  it("lists the 32 places the figures label, with unique ids", () => {
    expect(ccp14MapLocations).toHaveLength(32)
    expect(new Set(ccp14MapLocations.map(({ id }) => id)).size).toBe(32)
    expect(ccp14MapLocations.map(({ label }) => label)).toEqual(
      expect.arrayContaining([
        "Bogotá",
        "Cúcuta",
        "Leticia",
        "San Andrés y Providencia",
      ]),
    )
  })

  it("assigns coefficients only where the figure marks the location itself", () => {
    const assigned = ccp14MapLocations.filter(({ directRegion }) => directRegion)
    expect(assigned.map(({ id }) => id)).toEqual(["san-andres-y-providencia"])
    // A single region covers the whole inset on all three figures, so the
    // legends give the coefficients without tracing any contour.
    expect(ccp14DirectMapValues("san-andres-y-providencia")).toEqual({
      pgaG: 0.05,
      ssG: 0.1,
      s1G: 0.05,
    })
    // Every other labeled place sits between contours on at least one figure.
    expect(ccp14DirectMapValues("bogota")).toBeNull()
    expect(ccp14DirectMapValues("cucuta")).toBeNull()
  })
})
