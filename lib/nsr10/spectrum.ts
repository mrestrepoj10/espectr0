import importanceCoefficientsData from "./data/importance-coefficients.json"
import siteCoefficientsData from "./data/site-coefficients.json"
import { fa, fv } from "./site-coefficients"

import type { ImportanceGroup, SoilProfile, SupportedSoilProfile } from "./schema"

export type SpectrumMode = "general" | "modal"

export type SpectrumParams = {
  /** Effective peak acceleration Aa, expressed as a fraction of g. */
  aa: number
  /** One-second effective peak acceleration Av, expressed as a fraction of g. */
  av: number
  soilProfile: SoilProfile
  importanceGroup: ImportanceGroup
  mode?: SpectrumMode
}

export type SpectrumBranch =
  | "rising-A.2.6-7"
  | "plateau-A.2.6-3"
  | "inverse-T-A.2.6-1"
  | "inverse-T2-A.2.6-5"

export type SpectrumPoint = {
  /** Period in seconds. */
  t: number
  /** Spectral acceleration as a fraction of g. */
  sa: number
  branch: SpectrumBranch
}

export type SpectrumCoefficients = {
  aa: number
  av: number
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
  /** Peak ground acceleration Aa·Fa·I, as a fraction of g. */
  pga: number
}

export type SiteSpecificStudyRequired = {
  status: "site-specific-study-required"
  section: "A.2.10"
  notice: string
  soilProfile: "F"
}

export type SpectrumOk = {
  status: "ok"
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

const GENERAL_BRANCHES = [
  "plateau-A.2.6-3",
  "inverse-T-A.2.6-1",
  "inverse-T2-A.2.6-5",
] as const

const MODAL_BRANCHES = ["rising-A.2.6-7", ...GENERAL_BRANCHES] as const

function siteSpecificStudyRequired(): SiteSpecificStudyRequired {
  return {
    status: "site-specific-study-required",
    section: "A.2.10",
    notice: siteCoefficientsData.profile_f.notice,
    soilProfile: "F",
  }
}

function assertHazardCoefficient(value: number, name: "Aa" | "Av") {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero`)
  }
}

function coefficientsFor(params: SpectrumParams): SpectrumCoefficients | SiteSpecificStudyRequired {
  if (params.soilProfile === "F") return siteSpecificStudyRequired()

  assertHazardCoefficient(params.aa, "Aa")
  assertHazardCoefficient(params.av, "Av")

  const profile: SupportedSoilProfile = params.soilProfile
  const faValue = fa(params.aa, profile)
  const fvValue = fv(params.av, profile)
  const importance = importanceCoefficientsData.groups[params.importanceGroup]
  const denominator = params.aa * faValue

  return {
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

function accelerationAt(
  t: number,
  coefficients: SpectrumCoefficients,
  mode: SpectrumMode,
): SpectralAccelerationOk {
  const { av, fv: fvValue, i, t0, tc, tl, saMax } = coefficients
  const isAtOrBelow = (value: number, boundary: number) =>
    value <= boundary ||
    Math.abs(value - boundary) <=
      Number.EPSILON * 8 * Math.max(1, Math.abs(value), Math.abs(boundary))

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
      sa: (1.2 * av * fvValue * i) / t,
      branch: "inverse-T-A.2.6-1",
    }
  }

  return {
    status: "ok",
    t,
    sa: (1.2 * av * fvValue * tl * i) / t ** 2,
    branch: "inverse-T2-A.2.6-5",
  }
}

/**
 * Evaluates the NSR-10 elastic design spectrum at period `t` seconds.
 * Returned acceleration is a fraction of g. General mode (the default) uses
 * the A.2.6-3 plateau from zero through TC. Modal mode opts into conditional
 * equation A.2.6-7 below T0 for dynamic analysis/higher modes.
 */
export function saAt(t: number, params: SpectrumParams): SpectralAccelerationResult {
  if (!Number.isFinite(t) || t < 0) {
    throw new RangeError("T must be a finite period greater than or equal to zero")
  }

  const coefficients = coefficientsFor(params)
  if ("status" in coefficients) return coefficients

  return accelerationAt(t, coefficients, params.mode ?? "general")
}

function sampledPeriods(coefficients: SpectrumCoefficients, mode: SpectrumMode) {
  const plotEnd = 4
  const sampleCount = Math.ceil(plotEnd / 0.025)
  const periods = new Set<number>()

  for (let index = 0; index <= sampleCount; index += 1) {
    periods.add((plotEnd * index) / sampleCount)
  }

  periods.add(coefficients.tc)
  periods.add(coefficients.tl)
  if (mode === "modal") periods.add(coefficients.t0)

  return [...periods].sort((left, right) => left - right)
}

/**
 * Computes an NSR-10 elastic design spectrum. Periods are seconds and every
 * acceleration value is expressed as a fraction of gravitational acceleration g.
 */
export function computeSpectrum(params: SpectrumParams): SpectrumResult {
  const coefficients = coefficientsFor(params)
  if ("status" in coefficients) return coefficients

  const mode = params.mode ?? "general"
  const points = sampledPeriods(coefficients, mode).map((t) => {
    const point = accelerationAt(t, coefficients, mode)
    return { t: point.t, sa: point.sa, branch: point.branch }
  })

  return {
    status: "ok",
    mode,
    coefficients,
    points,
    branches: mode === "modal" ? MODAL_BRANCHES : GENERAL_BRANCHES,
  }
}
