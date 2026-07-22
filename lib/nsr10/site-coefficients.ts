import siteCoefficientsData from "./data/site-coefficients.json"

import type { SupportedSoilProfile } from "./schema"

type CoefficientTable = {
  breakpoints: number[]
  profiles: Record<SupportedSoilProfile, number[]>
}

export type SiteCoefficientInterpolationTrace = {
  coefficient: "fa" | "fv"
  tableId: "A.2.4-3" | "A.2.4-4"
  parameter: "Aa" | "Av"
  inputParameter: "Aa" | "Av" | "Ae" | "Ad"
  soilProfile: SupportedSoilProfile
  input: number
  mode: "fraction" | "exact" | "clamped"
  clampedTo: "lower" | "upper" | null
  lower: { breakpoint: number; value: number }
  upper: { breakpoint: number; value: number }
  fraction: number
  result: number
}

function interpolate(
  value: number,
  profile: SupportedSoilProfile,
  table: CoefficientTable,
  metadata: Pick<
    SiteCoefficientInterpolationTrace,
    "coefficient" | "tableId" | "parameter" | "inputParameter"
  >,
): SiteCoefficientInterpolationTrace {
  if (!Number.isFinite(value)) {
    throw new RangeError("The hazard coefficient must be a finite number")
  }

  const { breakpoints, profiles } = table
  const values = profiles[profile]

  const atIndex = (
    index: number,
    mode: SiteCoefficientInterpolationTrace["mode"],
    clampedTo: SiteCoefficientInterpolationTrace["clampedTo"],
  ): SiteCoefficientInterpolationTrace => ({
    ...metadata,
    soilProfile: profile,
    input: value,
    mode,
    clampedTo,
    lower: { breakpoint: breakpoints[index], value: values[index] },
    upper: { breakpoint: breakpoints[index], value: values[index] },
    fraction: 0,
    result: values[index],
  })

  if (value < breakpoints[0]) return atIndex(0, "clamped", "lower")
  if (value === breakpoints[0]) return atIndex(0, "exact", null)

  const lastIndex = breakpoints.length - 1
  if (value > breakpoints[lastIndex]) return atIndex(lastIndex, "clamped", "upper")
  if (value === breakpoints[lastIndex]) return atIndex(lastIndex, "exact", null)

  const upperIndex = breakpoints.findIndex((breakpoint) => value <= breakpoint)
  const lowerIndex = upperIndex - 1
  const lowerBreakpoint = breakpoints[lowerIndex]
  const upperBreakpoint = breakpoints[upperIndex]

  if (value === upperBreakpoint) return atIndex(upperIndex, "exact", null)

  const fraction = (value - lowerBreakpoint) / (upperBreakpoint - lowerBreakpoint)
  const result = values[lowerIndex] + fraction * (values[upperIndex] - values[lowerIndex])

  return {
    ...metadata,
    soilProfile: profile,
    input: value,
    mode: "fraction",
    clampedTo: null,
    lower: { breakpoint: lowerBreakpoint, value: values[lowerIndex] },
    upper: { breakpoint: upperBreakpoint, value: values[upperIndex] },
    fraction,
    result,
  }
}

export function traceFa(
  aa: number,
  profile: SupportedSoilProfile,
  inputParameter: "Aa" | "Ae" = "Aa",
) {
  return interpolate(aa, profile, siteCoefficientsData.fa as CoefficientTable, {
    coefficient: "fa",
    tableId: "A.2.4-3",
    parameter: "Aa",
    inputParameter,
  })
}

export function traceFv(
  av: number,
  profile: SupportedSoilProfile,
  inputParameter: "Av" | "Ae" | "Ad" = "Av",
) {
  return interpolate(av, profile, siteCoefficientsData.fv as CoefficientTable, {
    coefficient: "fv",
    tableId: "A.2.4-4",
    parameter: "Av",
    inputParameter,
  })
}

/** Returns the dimensionless short-period site coefficient Fa (table A.2.4-3). */
export function fa(aa: number, profile: SupportedSoilProfile) {
  return traceFa(aa, profile).result
}

/** Returns the dimensionless one-second site coefficient Fv (table A.2.4-4). */
export function fv(av: number, profile: SupportedSoilProfile) {
  return traceFv(av, profile).result
}
