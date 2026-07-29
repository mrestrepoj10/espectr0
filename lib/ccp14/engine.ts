import { z } from "zod"

import siteFactors from "./data/site-factors.json"

export const ccp14SoilClassSchema = z.enum(["A", "B", "C", "D", "E", "F"])
export const ccp14T0InterpretationSchema = z.enum([
  "figure-0.2-ts",
  "definition-0.2-seconds",
])

export const ccp14ComputationInputSchema = z
  .object({
    pgaG: z.number().finite().positive(),
    ssG: z.number().finite().positive(),
    s1G: z.number().finite().positive(),
    soilClass: ccp14SoilClassSchema,
    t0Interpretation: ccp14T0InterpretationSchema,
    distanceToActiveFaultKm: z.number().finite().nonnegative().nullable(),
    longDurationEarthquakesExpected: z.boolean(),
    enhancedHazardRequiredByImportance: z.boolean(),
  })
  .strict()

export type Ccp14SoilClass = z.infer<typeof ccp14SoilClassSchema>
export type Ccp14T0Interpretation = z.infer<typeof ccp14T0InterpretationSchema>
export type Ccp14ComputationInput = z.infer<typeof ccp14ComputationInputSchema>
export type Ccp14FactorId = "Fpga" | "Fa" | "Fv"
export type Ccp14BranchId = "initial-linear" | "plateau" | "inverse-period"

export type Ccp14FactorLookup = {
  factorId: Ccp14FactorId
  argument: number
  value: number
  lowerBreakpoint: number
  upperBreakpoint: number
  lowerValue: number
  upperValue: number
  mode: "low-clamp" | "exact" | "interpolation" | "high-clamp"
  citationIds: string[]
}

export type Ccp14EnginePoint = {
  tSeconds: number
  csm: number
  branchId: Ccp14BranchId
}

export type Ccp14EngineSuccess = {
  status: "ok"
  input: Ccp14ComputationInput
  factors: Record<Ccp14FactorId, Ccp14FactorLookup>
  as: number
  sds: number
  sd1: number
  ts: number
  t0: number
  performanceZone: 1 | 2 | 3 | 4
  at(tSeconds: number): Ccp14EnginePoint
}

export type Ccp14EngineFailure = {
  status: "invalid-input" | "unsupported" | "site-specific-study-required"
  reasonCode: string
  message: string
  citationIds: string[]
}

export type Ccp14EngineResult = Ccp14EngineSuccess | Ccp14EngineFailure

const factorCitationSlug: Record<Ccp14FactorId, string> = {
  Fpga: "fpga",
  Fa: "fa",
  Fv: "fv",
}

function cellCitation(factorId: Ccp14FactorId, soilClass: Ccp14SoilClass, index: number) {
  return `${factorCitationSlug[factorId]}-cell-${soilClass.toLowerCase()}-${index + 1}`
}

export function lookupCcp14SiteFactor(
  factorId: Ccp14FactorId,
  soilClass: Exclude<Ccp14SoilClass, "F">,
  argument: number,
): Ccp14FactorLookup {
  if (!Number.isFinite(argument) || argument < 0) {
    throw new RangeError("The site-factor argument must be finite and nonnegative")
  }
  const table = siteFactors.tables[factorId]
  const breakpoints = table.breakpoints
  const row = table.rows[soilClass]
  const low = 0
  const high = breakpoints.length - 1

  if (argument <= breakpoints[low]) {
    return {
      factorId,
      argument,
      value: row[low],
      lowerBreakpoint: breakpoints[low],
      upperBreakpoint: breakpoints[low],
      lowerValue: row[low],
      upperValue: row[low],
      mode: argument === breakpoints[low] ? "exact" : "low-clamp",
      citationIds: [cellCitation(factorId, soilClass, low)],
    }
  }
  if (argument >= breakpoints[high]) {
    return {
      factorId,
      argument,
      value: row[high],
      lowerBreakpoint: breakpoints[high],
      upperBreakpoint: breakpoints[high],
      lowerValue: row[high],
      upperValue: row[high],
      mode: argument === breakpoints[high] ? "exact" : "high-clamp",
      citationIds: [cellCitation(factorId, soilClass, high)],
    }
  }

  const upperIndex = breakpoints.findIndex((breakpoint) => argument <= breakpoint)
  const lowerIndex = upperIndex - 1
  if (argument === breakpoints[upperIndex]) {
    return {
      factorId,
      argument,
      value: row[upperIndex],
      lowerBreakpoint: breakpoints[upperIndex],
      upperBreakpoint: breakpoints[upperIndex],
      lowerValue: row[upperIndex],
      upperValue: row[upperIndex],
      mode: "exact",
      citationIds: [cellCitation(factorId, soilClass, upperIndex)],
    }
  }
  const lowerBreakpoint = breakpoints[lowerIndex]
  const upperBreakpoint = breakpoints[upperIndex]
  const lowerValue = row[lowerIndex]
  const upperValue = row[upperIndex]
  const value =
    lowerValue +
    ((upperValue - lowerValue) * (argument - lowerBreakpoint)) /
      (upperBreakpoint - lowerBreakpoint)
  return {
    factorId,
    argument,
    value,
    lowerBreakpoint,
    upperBreakpoint,
    lowerValue,
    upperValue,
    mode: "interpolation",
    citationIds: [
      cellCitation(factorId, soilClass, lowerIndex),
      cellCitation(factorId, soilClass, upperIndex),
      "claim-site-factor-tables",
    ],
  }
}

export function ccp14PerformanceZone(sd1: number): 1 | 2 | 3 | 4 {
  if (sd1 <= 0.15) return 1
  if (sd1 <= 0.3) return 2
  if (sd1 <= 0.5) return 3
  return 4
}

function siteSpecificReason(input: Ccp14ComputationInput): Ccp14EngineFailure | null {
  if (input.soilClass === "F") {
    return {
      status: "site-specific-study-required",
      reasonCode: "ccp14-soil-class-f",
      message: "CCP-14 requires a site-specific study and wave-amplification analysis for soil class F.",
      citationIds: ["claim-soils", "soil-f-and-factor-notes"],
    }
  }
  if (input.distanceToActiveFaultKm === null) {
    return {
      status: "unsupported",
      reasonCode: "ccp14-active-fault-distance-unknown",
      message: "The distance to the nearest active fault must be confirmed before the CCP-14 general procedure can be declared applicable; sites less than 10 km away require the site-specific procedure.",
      citationIds: ["claim-site-specific-triggers"],
    }
  }
  if (input.distanceToActiveFaultKm < 10) {
    return {
      status: "site-specific-study-required",
      reasonCode: "ccp14-active-fault-distance",
      message: "CCP-14 requires the site-specific procedure when the site is less than 10 km from an active fault.",
      citationIds: ["claim-site-specific-triggers"],
    }
  }
  if (input.longDurationEarthquakesExpected) {
    return {
      status: "site-specific-study-required",
      reasonCode: "ccp14-long-duration-earthquakes",
      message: "CCP-14 requires the site-specific procedure where long-duration earthquakes are expected.",
      citationIds: ["claim-site-specific-triggers"],
    }
  }
  if (input.enhancedHazardRequiredByImportance) {
    return {
      status: "site-specific-study-required",
      reasonCode: "ccp14-enhanced-hazard-by-importance",
      message: "CCP-14 routes a bridge requiring lower exceedance probability or a longer return period to the site-specific procedure.",
      citationIds: ["claim-site-specific-triggers"],
    }
  }
  return null
}

export function computeCcp14Spectrum(input: unknown): Ccp14EngineResult {
  const parsed = ccp14ComputationInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      status: "invalid-input",
      reasonCode: "ccp14-invalid-input",
      message: z.prettifyError(parsed.error),
      citationIds: [],
    }
  }
  const siteSpecific = siteSpecificReason(parsed.data)
  if (siteSpecific) return siteSpecific
  const soilClass = parsed.data.soilClass as Exclude<Ccp14SoilClass, "F">
  const factors = {
    Fpga: lookupCcp14SiteFactor("Fpga", soilClass, parsed.data.pgaG),
    Fa: lookupCcp14SiteFactor("Fa", soilClass, parsed.data.ssG),
    Fv: lookupCcp14SiteFactor("Fv", soilClass, parsed.data.s1G),
  }
  const as = factors.Fpga.value * parsed.data.pgaG
  const sds = factors.Fa.value * parsed.data.ssG
  const sd1 = factors.Fv.value * parsed.data.s1G
  const ts = sd1 / sds
  const t0 = parsed.data.t0Interpretation === "figure-0.2-ts" ? 0.2 * ts : 0.2
  if (t0 > ts) {
    return {
      status: "unsupported",
      reasonCode: "ccp14-t0-order-conflict",
      message: "The selected published T0 = 0.2 s reading produces T0 > Ts for these inputs, so the published initial, plateau, and long-period branch intervals overlap and do not define one unambiguous spectrum.",
      citationIds: ["conflict-t0-figure", "conflict-t0-definition", "claim-spectrum-branches"],
    }
  }

  const at = (tSeconds: number): Ccp14EnginePoint => {
    if (!Number.isFinite(tSeconds) || tSeconds < 0) {
      throw new RangeError("The period must be finite and nonnegative")
    }
    if (tSeconds <= t0) {
      return {
        tSeconds,
        csm: as + ((sds - as) * tSeconds) / t0,
        branchId: "initial-linear",
      }
    }
    if (tSeconds <= ts) return { tSeconds, csm: sds, branchId: "plateau" }
    return { tSeconds, csm: sd1 / tSeconds, branchId: "inverse-period" }
  }

  return {
    status: "ok",
    input: parsed.data,
    factors,
    as,
    sds,
    sd1,
    ts,
    t0,
    performanceZone: ccp14PerformanceZone(sd1),
    at,
  }
}
