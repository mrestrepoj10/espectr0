import { describe, expect, it } from "vitest"

import { fa, fv } from "./site-coefficients"

describe("NSR-10 site coefficients", () => {
  it("linearly interpolates within each soil-profile row", () => {
    expect(fa(0.25, "C")).toBeCloseTo(1.15, 15)
    expect(fa(0.25, "D")).toBeCloseTo(1.3, 15)
    expect(fa(0.35, "E")).toBeCloseTo(1.05, 15)
    expect(fv(0.25, "C")).toBeCloseTo(1.55, 15)
    expect(fv(0.25, "D")).toBeCloseTo(1.9, 15)
    expect(fv(0.35, "E")).toBeCloseTo(2.6, 15)
  })

  it("clamps inputs at both endpoint columns", () => {
    expect(fa(0.01, "E")).toBe(2.5)
    expect(fa(0.9, "E")).toBe(0.9)
    expect(fv(0.01, "D")).toBe(2.4)
    expect(fv(0.9, "D")).toBe(1.5)
  })

  it("rejects non-finite hazard coefficients", () => {
    expect(() => fa(Number.NaN, "A")).toThrow(RangeError)
    expect(() => fv(Number.POSITIVE_INFINITY, "A")).toThrow(RangeError)
  })
})
