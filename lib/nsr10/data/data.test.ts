import { describe, expect, it } from "vitest"

import importanceCoefficientsData from "./importance-coefficients.json"
import municipiosData from "./municipios.json"
import oracleData from "./oracle.json"
import siteCoefficientsData from "./site-coefficients.json"
import {
  importanceCoefficientsSchema,
  municipiosSchema,
  oracleSchema,
  siteCoefficientsSchema,
} from "../schema"

const SUPPORTED_PROFILES = ["A", "B", "C", "D", "E"]

describe("NSR-10 checked-in datasets", () => {
  it("conform to their public schemas", () => {
    expect(() => municipiosSchema.parse(municipiosData)).not.toThrow()
    expect(() => siteCoefficientsSchema.parse(siteCoefficientsData)).not.toThrow()
    expect(() => importanceCoefficientsSchema.parse(importanceCoefficientsData)).not.toThrow()
    expect(() => oracleSchema.parse(oracleData)).not.toThrow()
  })

  it("contains exactly 1,123 unique DANE codes and location pairs", () => {
    const municipios = municipiosSchema.parse(municipiosData)
    const codes = new Set(municipios.map(({ code }) => code))
    const pairs = new Set(
      municipios.map(({ departamento, municipio }) => `${departamento}\u0000${municipio}`),
    )

    expect(municipios).toHaveLength(1_123)
    expect(codes.size).toBe(1_123)
    expect(pairs.size).toBe(1_123)
  })

  it("keeps Aa and Av in the legal range and on 0.05 increments", () => {
    const municipios = municipiosSchema.parse(municipiosData)

    for (const { aa, av } of municipios) {
      for (const coefficient of [aa, av]) {
        expect(coefficient).toBeGreaterThanOrEqual(0.05)
        expect(coefficient).toBeLessThanOrEqual(0.5)
        expect(Math.abs(coefficient * 20 - Math.round(coefficient * 20))).toBeLessThan(1e-12)
      }
    }
  })

  it("has ascending breakpoints and one Fa/Fv value per breakpoint", () => {
    const tables = siteCoefficientsSchema.parse(siteCoefficientsData)

    for (const table of [tables.fa, tables.fv]) {
      for (let index = 1; index < table.breakpoints.length; index += 1) {
        expect(table.breakpoints[index]).toBeGreaterThan(table.breakpoints[index - 1])
      }

      expect(Object.keys(table.profiles).sort()).toEqual(SUPPORTED_PROFILES)
      for (const profile of SUPPORTED_PROFILES) {
        expect(table.profiles[profile as keyof typeof table.profiles]).toHaveLength(
          table.breakpoints.length,
        )
      }
    }
  })

  it("supports profiles A-E and reserves profile F for an A.2.10 study", () => {
    const tables = siteCoefficientsSchema.parse(siteCoefficientsData)

    expect(Object.keys(tables.fa.profiles).sort()).toEqual(SUPPORTED_PROFILES)
    expect(Object.keys(tables.fv.profiles).sort()).toEqual(SUPPORTED_PROFILES)
    expect(tables.profile_f).toMatchObject({
      supported: false,
      section: "A.2.10",
    })
    expect(tables.profile_f.notice).toMatch(/site-specific/i)
  })
})
