import { describe, expect, it } from "vitest"

import canonical from "./data/canonical.json"
import {
  caliComponentLabel,
  caliLegendZoneBand,
  caliMapEvidence,
  caliZoneOfComponent,
} from "./map-evidence"

describe("Cali map evidence", () => {
  it("measures a legend row for every geographic zone", () => {
    const zones = canonical.geographicOptions
    expect(Object.keys(caliMapEvidence.legendZoneBands).sort()).toEqual(
      [...zones].sort(),
    )
    for (const zone of zones) {
      const band = caliLegendZoneBand(zone)
      expect(band.width, zone).toBeGreaterThan(0)
      expect(band.height, zone).toBeGreaterThan(0)
      expect(band.left + band.width, zone).toBeLessThanOrEqual(1)
      expect(band.top + band.height, zone).toBeLessThanOrEqual(1)
    }
  })

  it("resolves both concurrent components of a zone to the same row", () => {
    expect(caliZoneOfComponent("zone-4c-tc")).toBe("zone-4c")
    expect(caliZoneOfComponent("zone-4c-tl")).toBe("zone-4c")
    expect(caliLegendZoneBand("zone-4c-tc")).toEqual(
      caliLegendZoneBand("zone-4c-tl"),
    )
  })

  it("keeps the sheet fingerprint a reviewer can re-fetch", () => {
    const { source } = caliMapEvidence
    expect(source.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(source.byteLength).toBe(3100744)
    // No publisher URL is established; the mirror is what makes it checkable.
    expect(source.officialUrl).toBeNull()
    expect(source.mirrorUrl).toContain("cali.pdf")
  })
})

describe("Cali concurrent-zone labels", () => {
  it("names the geographic zone picked before its component", () => {
    // The drawer opens on the zone alone, so a bare geographic id must not
    // reach the badge as a raw slug.
    expect(caliComponentLabel("zone-4c")).toBe("Zona 4C")
    expect(caliComponentLabel("zone-4b")).toBe("Zona 4B")
    expect(caliComponentLabel("zone-5")).toBe("Zona 5")
    expect(caliComponentLabel("zone-4c-tl")).toBe("Zona 4C — componente TL")
    // A zone without concurrent curves already had a label.
    expect(caliComponentLabel("zone-1")).toBe("Zona 1")
  })
})
