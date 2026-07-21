import siteCoefficientsData from "./data/site-coefficients.json"

import type { SupportedSoilProfile } from "./schema"

type CoefficientTable = {
  breakpoints: number[]
  profiles: Record<SupportedSoilProfile, number[]>
}

function interpolate(value: number, profile: SupportedSoilProfile, table: CoefficientTable) {
  if (!Number.isFinite(value)) {
    throw new RangeError("The hazard coefficient must be a finite number")
  }

  const { breakpoints, profiles } = table
  const values = profiles[profile]

  if (value <= breakpoints[0]) return values[0]
  if (value >= breakpoints.at(-1)!) return values.at(-1)!

  const upperIndex = breakpoints.findIndex((breakpoint) => value <= breakpoint)
  const lowerIndex = upperIndex - 1
  const lowerBreakpoint = breakpoints[lowerIndex]
  const upperBreakpoint = breakpoints[upperIndex]
  const fraction = (value - lowerBreakpoint) / (upperBreakpoint - lowerBreakpoint)

  return values[lowerIndex] + fraction * (values[upperIndex] - values[lowerIndex])
}

/** Returns the dimensionless short-period site coefficient Fa (table A.2.4-3). */
export function fa(aa: number, profile: SupportedSoilProfile) {
  return interpolate(aa, profile, siteCoefficientsData.fa as CoefficientTable)
}

/** Returns the dimensionless one-second site coefficient Fv (table A.2.4-4). */
export function fv(av: number, profile: SupportedSoilProfile) {
  return interpolate(av, profile, siteCoefficientsData.fv as CoefficientTable)
}
