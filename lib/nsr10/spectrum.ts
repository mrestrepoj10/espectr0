import importanceCoefficientsData from "./data/importance-coefficients.json"
import siteCoefficientsData from "./data/site-coefficients.json"
import { fa, fv } from "./site-coefficients"

import type { ImportanceGroup, SoilProfile, SupportedSoilProfile } from "./schema"

export type HazardLevel = "design" | "limited-safety" | "damage-threshold"
export type SpectrumMode = "general" | "modal"

export const hazardLevelDetails = {
  design: {
    label: "Diseño",
    returnPeriodYears: 475,
    dampingRatio: 0.05,
    section: "A.2.6",
  },
  "limited-safety": {
    label: "Seguridad limitada",
    returnPeriodYears: 225,
    dampingRatio: 0.05,
    section: "A.10.3",
  },
  "damage-threshold": {
    label: "Umbral de daño",
    returnPeriodYears: 31,
    dampingRatio: 0.02,
    section: "A.12.3",
  },
} as const satisfies Record<
  HazardLevel,
  {
    label: string
    returnPeriodYears: number
    dampingRatio: number
    section: string
  }
>

export type SpectrumParams = {
  /** Effective peak acceleration Aa, expressed as a fraction of g. */
  aa: number
  /** One-second effective peak acceleration Av, expressed as a fraction of g. */
  av: number
  /** Reduced effective peak acceleration Ae for limited safety. */
  ae?: number
  /** Effective peak acceleration Ad for the damage threshold. */
  ad?: number
  hazardLevel?: HazardLevel
  soilProfile: SoilProfile
  importanceGroup: ImportanceGroup
  mode?: SpectrumMode
}

export type DesignSpectrumBranch =
  | "rising-A.2.6-7"
  | "plateau-A.2.6-3"
  | "inverse-T-A.2.6-1"
  | "inverse-T2-A.2.6-5"

export type DamageThresholdSpectrumBranch =
  | "rising-A.12.3-2"
  | "plateau-A.12.3-4"
  | "inverse-T-A.12.3-1"
  | "inverse-T2-A.12.3-6"

export type SpectrumBranch = DesignSpectrumBranch | DamageThresholdSpectrumBranch

export type SpectrumPoint = {
  /** Period in seconds. */
  t: number
  /** Spectral acceleration as a fraction of g. */
  sa: number
  branch: SpectrumBranch
}

type DesignLikeSpectrumCoefficients = {
  fa: number
  fv: number
  i: number
  /** Initial control period in seconds; not a general-mode branch boundary. */
  t0: number
  /** Short-period plateau limit in seconds. */
  tc: number
  /** Long-period transition in seconds. */
  tl: number
  /** Maximum spectral acceleration as a fraction of g. */
  saMax: number
  /** Peak ground acceleration, as a fraction of g. */
  pga: number
}

export type DesignSpectrumCoefficients = DesignLikeSpectrumCoefficients & {
  hazardLevel: "design"
  aa: number
  av: number
}

export type LimitedSafetySpectrumCoefficients = DesignLikeSpectrumCoefficients & {
  hazardLevel: "limited-safety"
  ae: number
}

export type DamageThresholdSpectrumCoefficients = {
  hazardLevel: "damage-threshold"
  ad: number
  fv: number
  /** Site coefficient S = 1.25 Fv, per A.12.3.1. */
  s: number
  tc: number
  tl: number
  saMax: number
  pga: number
}

export type SpectrumCoefficients =
  | DesignSpectrumCoefficients
  | LimitedSafetySpectrumCoefficients
  | DamageThresholdSpectrumCoefficients

export type SiteSpecificStudyRequired = {
  status: "site-specific-study-required"
  section: "A.2.10"
  notice: string
  soilProfile: "F"
  hazardLevel: HazardLevel
}

export type SpectrumOk = {
  status: "ok"
  hazardLevel: HazardLevel
  returnPeriodYears: number
  dampingRatio: number
  mode: SpectrumMode
  coefficients: SpectrumCoefficients
  points: SpectrumPoint[]
  branches: readonly SpectrumBranch[]
}

export type SpectrumResult = SpectrumOk | SiteSpecificStudyRequired

export type SpectralAccelerationOk = {
  status: "ok"
  /** Period in seconds. */
  t: number
  /** Spectral acceleration as a fraction of g. */
  sa: number
  branch: SpectrumBranch
}

export type SpectralAccelerationResult =
  | SpectralAccelerationOk
  | SiteSpecificStudyRequired

const GENERAL_DESIGN_BRANCHES = [
  "plateau-A.2.6-3",
  "inverse-T-A.2.6-1",
  "inverse-T2-A.2.6-5",
] as const

const MODAL_DESIGN_BRANCHES = ["rising-A.2.6-7", ...GENERAL_DESIGN_BRANCHES] as const

const DAMAGE_THRESHOLD_BRANCHES = [
  "rising-A.12.3-2",
  "plateau-A.12.3-4",
  "inverse-T-A.12.3-1",
  "inverse-T2-A.12.3-6",
] as const

function siteSpecificStudyRequired(hazardLevel: HazardLevel): SiteSpecificStudyRequired {
  return {
    status: "site-specific-study-required",
    section: "A.2.10",
    notice: siteCoefficientsData.profile_f.notice,
    soilProfile: "F",
    hazardLevel,
  }
}

function assertHazardCoefficient(
  value: number | undefined,
  name: "Aa" | "Av" | "Ae" | "Ad",
): asserts value is number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero`)
  }
}

function designCoefficients(
  params: SpectrumParams,
  profile: SupportedSoilProfile,
): DesignSpectrumCoefficients {
  assertHazardCoefficient(params.aa, "Aa")
  assertHazardCoefficient(params.av, "Av")

  const faValue = fa(params.aa, profile)
  const fvValue = fv(params.av, profile)
  const importance = importanceCoefficientsData.groups[params.importanceGroup]
  const denominator = params.aa * faValue

  return {
    hazardLevel: "design",
    aa: params.aa,
    av: params.av,
    fa: faValue,
    fv: fvValue,
    i: importance,
    t0: (0.1 * params.av * fvValue) / denominator,
    tc: (0.48 * params.av * fvValue) / denominator,
    tl: 2.4 * fvValue,
    saMax: 2.5 * params.aa * faValue * importance,
    pga: params.aa * faValue * importance,
  }
}

function limitedSafetyCoefficients(
  params: SpectrumParams,
  profile: SupportedSoilProfile,
): LimitedSafetySpectrumCoefficients {
  assertHazardCoefficient(params.ae, "Ae")

  const faValue = fa(params.ae, profile)
  const fvValue = fv(params.ae, profile)
  const importance = importanceCoefficientsData.groups[params.importanceGroup]

  return {
    hazardLevel: "limited-safety",
    ae: params.ae,
    fa: faValue,
    fv: fvValue,
    i: importance,
    t0: (0.1 * fvValue) / faValue,
    tc: (0.48 * fvValue) / faValue,
    tl: 2.4 * fvValue,
    saMax: 2.5 * params.ae * faValue * importance,
    pga: params.ae * faValue * importance,
  }
}

function damageThresholdCoefficients(
  params: SpectrumParams,
  profile: SupportedSoilProfile,
): DamageThresholdSpectrumCoefficients {
  assertHazardCoefficient(params.ad, "Ad")

  const fvValue = fv(params.ad, profile)
  const siteCoefficient = 1.25 * fvValue

  return {
    hazardLevel: "damage-threshold",
    ad: params.ad,
    fv: fvValue,
    s: siteCoefficient,
    tc: 0.5 * siteCoefficient,
    tl: 2.4 * siteCoefficient,
    saMax: 3 * params.ad,
    pga: params.ad,
  }
}

function coefficientsFor(params: SpectrumParams): SpectrumCoefficients | SiteSpecificStudyRequired {
  const hazardLevel = params.hazardLevel ?? "design"
  if (params.soilProfile === "F") return siteSpecificStudyRequired(hazardLevel)

  const profile: SupportedSoilProfile = params.soilProfile
  if (hazardLevel === "limited-safety") {
    return limitedSafetyCoefficients(params, profile)
  }
  if (hazardLevel === "damage-threshold") {
    return damageThresholdCoefficients(params, profile)
  }
  return designCoefficients(params, profile)
}

function isAtOrBelow(value: number, boundary: number) {
  return (
    value <= boundary ||
    Math.abs(value - boundary) <=
      Number.EPSILON * 8 * Math.max(1, Math.abs(value), Math.abs(boundary))
  )
}

function designAccelerationAt(
  t: number,
  coefficients: DesignSpectrumCoefficients | LimitedSafetySpectrumCoefficients,
  mode: SpectrumMode,
): SpectralAccelerationOk {
  const { fv: fvValue, i, t0, tc, tl, saMax } = coefficients
  const longPeriodCoefficient =
    coefficients.hazardLevel === "design" ? coefficients.av : coefficients.ae

  if (mode === "modal" && !isAtOrBelow(t0, t)) {
    return {
      status: "ok",
      t,
      sa: saMax * (0.4 + (0.6 * t) / t0),
      branch: "rising-A.2.6-7",
    }
  }

  if (isAtOrBelow(t, tc)) {
    return { status: "ok", t, sa: saMax, branch: "plateau-A.2.6-3" }
  }

  if (isAtOrBelow(t, tl)) {
    return {
      status: "ok",
      t,
      sa: (1.2 * longPeriodCoefficient * fvValue * i) / t,
      branch: "inverse-T-A.2.6-1",
    }
  }

  return {
    status: "ok",
    t,
    sa: (1.2 * longPeriodCoefficient * fvValue * tl * i) / t ** 2,
    branch: "inverse-T2-A.2.6-5",
  }
}

function damageThresholdAccelerationAt(
  t: number,
  coefficients: DamageThresholdSpectrumCoefficients,
): SpectralAccelerationOk {
  const { ad, s, tc, tl, saMax } = coefficients

  if (!isAtOrBelow(0.25, t)) {
    return {
      status: "ok",
      t,
      sa: ad * (1 + 8 * t),
      branch: "rising-A.12.3-2",
    }
  }

  if (isAtOrBelow(t, tc)) {
    return { status: "ok", t, sa: saMax, branch: "plateau-A.12.3-4" }
  }

  if (isAtOrBelow(t, tl)) {
    return {
      status: "ok",
      t,
      sa: (1.5 * ad * s) / t,
      branch: "inverse-T-A.12.3-1",
    }
  }

  return {
    status: "ok",
    t,
    sa: (1.5 * ad * s * tl) / t ** 2,
    branch: "inverse-T2-A.12.3-6",
  }
}

function accelerationAt(
  t: number,
  coefficients: SpectrumCoefficients,
  mode: SpectrumMode,
): SpectralAccelerationOk {
  return coefficients.hazardLevel === "damage-threshold"
    ? damageThresholdAccelerationAt(t, coefficients)
    : designAccelerationAt(t, coefficients, mode)
}

/** Evaluates the selected NSR-10 elastic spectrum at period `t` seconds. */
export function saAt(t: number, params: SpectrumParams): SpectralAccelerationResult {
  if (!Number.isFinite(t) || t < 0) {
    throw new RangeError("T must be a finite period greater than or equal to zero")
  }

  const coefficients = coefficientsFor(params)
  if ("status" in coefficients) return coefficients

  return accelerationAt(t, coefficients, params.mode ?? "general")
}

function sampledPeriods(coefficients: SpectrumCoefficients, mode: SpectrumMode) {
  const plotEnd = Math.ceil(Math.max(4, coefficients.tl * 1.25) * 2) / 2
  const sampleCount = Math.ceil(plotEnd / 0.025)
  const periods = new Set<number>()

  for (let index = 0; index <= sampleCount; index += 1) {
    periods.add((plotEnd * index) / sampleCount)
  }

  periods.add(coefficients.tc)
  periods.add(coefficients.tl)
  if (coefficients.hazardLevel === "damage-threshold") periods.add(0.25)
  else if (mode === "modal") periods.add(coefficients.t0)

  return [...periods].sort((left, right) => left - right)
}

/**
 * Computes the selected NSR-10 elastic spectrum. Periods are seconds and every
 * acceleration value is expressed as a fraction of gravitational acceleration g.
 */
export function computeSpectrum(params: SpectrumParams): SpectrumResult {
  const coefficients = coefficientsFor(params)
  if ("status" in coefficients) return coefficients

  const hazardLevel = coefficients.hazardLevel
  const details = hazardLevelDetails[hazardLevel]
  const mode = params.mode ?? "general"
  const points = sampledPeriods(coefficients, mode).map((t) => {
    const point = accelerationAt(t, coefficients, mode)
    return { t: point.t, sa: point.sa, branch: point.branch }
  })
  const branches =
    hazardLevel === "damage-threshold"
      ? DAMAGE_THRESHOLD_BRANCHES
      : mode === "modal"
        ? MODAL_DESIGN_BRANCHES
        : GENERAL_DESIGN_BRANCHES

  return {
    status: "ok",
    hazardLevel,
    returnPeriodYears: details.returnPeriodYears,
    dampingRatio: details.dampingRatio,
    mode,
    coefficients,
    points,
    branches,
  }
}
