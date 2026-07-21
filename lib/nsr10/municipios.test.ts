import { describe, expect, it } from "vitest"

import {
  lookupMunicipio,
  municipios,
  normalizeSearchText,
  searchMunicipios,
} from "./municipios"

describe("NSR-10 municipality helpers", () => {
  it("normalizes case and Spanish diacritics", () => {
    expect(normalizeSearchText("  MEDELLÍN ")).toBe("medellin")
  })

  it("finds Medellín without an accent", () => {
    expect(searchMunicipios("medellin")[0]).toMatchObject({
      departamento: "Antioquia",
      municipio: "Medellín",
      aa: 0.15,
      av: 0.2,
    })
  })

  it("searches departments and limits stable dataset-order results", () => {
    const matches = searchMunicipios("antioquia", 3)
    expect(matches).toHaveLength(3)
    expect(matches.every(({ departamento }) => departamento === "Antioquia")).toBe(true)
    expect(matches[0].municipio).toBe("Santafé de Antioquia")
  })

  it("returns all same-name matches unless a department disambiguates them", () => {
    const duplicatedName = municipios.find(
      (candidate, index) =>
        municipios.findIndex(
          (entry) =>
            normalizeSearchText(entry.municipio) ===
            normalizeSearchText(candidate.municipio),
        ) !== index,
    )

    expect(duplicatedName).toBeDefined()
    const allMatches = lookupMunicipio(duplicatedName!.municipio)
    expect(allMatches.length).toBeGreaterThan(1)
    expect(
      lookupMunicipio(duplicatedName!.municipio, duplicatedName!.departamento),
    ).toContainEqual(duplicatedName)
  })
})
