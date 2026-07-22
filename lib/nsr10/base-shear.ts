import {
  approximatePeriodCoefficients,
  baseShearConstants,
  baseShearEvidenceIds,
} from "./base-shear-constants"
import {
  approximatePeriodParamsSchema,
  fheApplicabilityParamsSchema,
  forceDistributionParamsSchema,
  periodCeilingParamsSchema,
} from "./schema"

import type {
  ApproximatePeriodParams,
  FheApplicabilityParams,
  ForceDistributionParams,
  PeriodCeilingParams,
  StructuralRegularity,
} from "./schema"
import type {
  SiteSpecificStudyRequired,
  SpectralAccelerationResult,
} from "./spectrum"

export type ApproximatePeriodResult = {
  status: "ok"
  system: ApproximatePeriodParams["system"]
  hn: number
  ct: number
  alpha: number
  ta: number
  reference: "A.4.2-3 / Tabla A.4.2-1"
  evidenceId: typeof baseShearEvidenceIds.approximatePeriod
}

export type PeriodCeilingResult = {
  status: "ok"
  av: number
  fv: number
  ta: number
  cu: number
  maximumPeriod: number
  tAnalytical?: number
  t: number
  governedBy: "analytical-period" | "cu-times-ta" | "equal"
  reference: "A.4.2-2"
  evidenceId: typeof baseShearEvidenceIds.periodCeiling
}

type BaseShearMassInput = {
  massKg: number
  weightKn?: never
}

type BaseShearWeightInput = {
  massKg?: never
  weightKn: number
}

export type BaseShearParams = {
  saAtT: number | SpectralAccelerationResult
} & (BaseShearMassInput | BaseShearWeightInput)

export type BaseShearOk = {
  status: "ok"
  inputBasis: "mass-kg" | "weight-kn"
  saAtT: number
  gravityMps2: number
  massKg?: number
  weightKn: number
  vsKn: number
  vsOverWeight: number
  reference: "A.4.3-1"
  evidenceIds: readonly [
    typeof baseShearEvidenceIds.baseShear,
    typeof baseShearEvidenceIds.gravityAndMass,
  ]
}

export type BaseShearResult = BaseShearOk | SiteSpecificStudyRequired

export type DistributedStoryForce = ForceDistributionParams["stories"][number] & {
  index: number
  cvx: number
  fx: number
  storyShear: number
}

export type ForceDistributionResult = {
  status: "ok"
  t: number
  k: number
  vs: number
  denominator: number
  stories: DistributedStoryForce[]
  reference: "A.4.3-2 / A.4.3-3"
  evidenceId: typeof baseShearEvidenceIds.forceDistribution
}

export type FheApplicabilityRule =
  | "low-hazard"
  | "intermediate-group-i"
  | "regular-within-limits"
  | "irregular-within-limits"
  | "flexible-on-rigid"

export type FheApplicabilityWarningCode =
  | "regular-story-limit"
  | "regular-height-limit"
  | "soft-soil-long-period"
  | "soft-soil-period-check-unavailable"
  | "irregular-story-limit"
  | "irregular-height-limit"

export type FheApplicabilityWarning = {
  severity: "warning"
  code: FheApplicabilityWarningCode
  message: string
  reference: "A.3.4.2.1" | "A.3.4.2.2"
  evidenceId:
    | typeof baseShearEvidenceIds.applicability
    | typeof baseShearEvidenceIds.dynamicAnalysisRequired
}

export type DynamicBaseShearNote = {
  severity: "info"
  code: "dynamic-base-shear-minimum"
  message: string
  minimumRatio: number
  reference: "A.5.4.5"
  evidenceId: typeof baseShearEvidenceIds.dynamicMinimum
}

export type FheApplicabilityResult = {
  status: "ok"
  applicable: boolean
  qualifyingRule?: FheApplicabilityRule
  warnings: FheApplicabilityWarning[]
  notes: [DynamicBaseShearNote]
}

export function approximatePeriod(params: ApproximatePeriodParams): ApproximatePeriodResult {
  const parsed = approximatePeriodParamsSchema.parse(params)
  const coefficients = approximatePeriodCoefficients[parsed.system]

  return {
    status: "ok",
    system: parsed.system,
    hn: parsed.hn,
    ct: coefficients.ct,
    alpha: coefficients.alpha,
    ta: coefficients.ct * parsed.hn ** coefficients.alpha,
    reference: "A.4.2-3 / Tabla A.4.2-1",
    evidenceId: coefficients.evidenceId,
  }
}

export function periodCeiling(params: PeriodCeilingParams): PeriodCeilingResult {
  const parsed = periodCeilingParamsSchema.parse(params)
  const constants = baseShearConstants.periodCeiling
  const cu = Math.max(
    constants.minimum,
    constants.intercept - constants.avFvFactor * parsed.av * parsed.fv,
  )
  const maximumPeriod = cu * parsed.ta
  const t = Math.min(parsed.tAnalytical ?? Number.POSITIVE_INFINITY, maximumPeriod)
  const governedBy =
    parsed.tAnalytical === maximumPeriod
      ? "equal"
      : parsed.tAnalytical !== undefined && parsed.tAnalytical < maximumPeriod
        ? "analytical-period"
        : "cu-times-ta"

  return {
    status: "ok",
    ...parsed,
    cu,
    maximumPeriod,
    t,
    governedBy,
    reference: "A.4.2-2",
    evidenceId: baseShearEvidenceIds.periodCeiling,
  }
}

function resolveSaAtT(saAtT: BaseShearParams["saAtT"]) {
  if (typeof saAtT === "number") return saAtT
  if (saAtT.status === "site-specific-study-required") return saAtT
  return saAtT.sa
}

export function baseShear(params: BaseShearParams): BaseShearResult {
  const acceleration = resolveSaAtT(params.saAtT)
  if (typeof acceleration !== "number") return acceleration
  if (!Number.isFinite(acceleration) || acceleration <= 0) {
    throw new RangeError("Sa(T) must be a finite number greater than zero")
  }

  const hasMass = params.massKg !== undefined
  const hasWeight = params.weightKn !== undefined
  if (hasMass === hasWeight) {
    throw new RangeError("Provide exactly one of massKg or weightKn")
  }

  const gravityMps2 = baseShearConstants.gravityMps2
  if (hasMass) {
    if (!Number.isFinite(params.massKg) || params.massKg <= 0) {
      throw new RangeError("massKg must be a finite number greater than zero")
    }
    const weightKn = (params.massKg * gravityMps2) / 1_000
    return {
      status: "ok",
      inputBasis: "mass-kg",
      saAtT: acceleration,
      gravityMps2,
      massKg: params.massKg,
      weightKn,
      vsKn: acceleration * weightKn,
      vsOverWeight: acceleration,
      reference: "A.4.3-1",
      evidenceIds: [baseShearEvidenceIds.baseShear, baseShearEvidenceIds.gravityAndMass],
    }
  }

  if (!Number.isFinite(params.weightKn) || params.weightKn <= 0) {
    throw new RangeError("weightKn must be a finite number greater than zero")
  }
  return {
    status: "ok",
    inputBasis: "weight-kn",
    saAtT: acceleration,
    gravityMps2,
    weightKn: params.weightKn,
    vsKn: acceleration * params.weightKn,
    vsOverWeight: acceleration,
    reference: "A.4.3-1",
    evidenceIds: [baseShearEvidenceIds.baseShear, baseShearEvidenceIds.gravityAndMass],
  }
}

function distributionExponent(t: number) {
  const constants = baseShearConstants.forceDistribution
  if (t <= constants.firstBoundarySeconds) return constants.lowPeriodExponent
  if (t <= constants.secondBoundarySeconds) {
    return constants.middleIntercept + constants.middleSlope * t
  }
  return constants.highPeriodExponent
}

export function forceDistribution(params: ForceDistributionParams): ForceDistributionResult {
  const parsed = forceDistributionParamsSchema.parse(params)
  for (let index = 1; index < parsed.stories.length; index += 1) {
    if (parsed.stories[index].hx <= parsed.stories[index - 1].hx) {
      throw new RangeError("Story heights must be strictly increasing from base to top")
    }
  }

  const k = distributionExponent(parsed.t)
  const terms = parsed.stories.map(({ wx, hx }) => wx * hx ** k)
  const denominator = terms.reduce((sum, term) => sum + term, 0)
  const stories = parsed.stories.map((story, index) => {
    const cvx = terms[index] / denominator
    return { ...story, index, cvx, fx: cvx * parsed.vs, storyShear: 0 }
  })

  let cumulativeShear = 0
  for (let index = stories.length - 1; index >= 0; index -= 1) {
    cumulativeShear += stories[index].fx
    stories[index].storyShear = cumulativeShear
  }

  return {
    status: "ok",
    t: parsed.t,
    k,
    vs: parsed.vs,
    denominator,
    stories,
    reference: "A.4.3-2 / A.4.3-3",
    evidenceId: baseShearEvidenceIds.forceDistribution,
  }
}

function dynamicBaseShearNote(regularity: StructuralRegularity): DynamicBaseShearNote {
  const minimumRatio = baseShearConstants.dynamicBaseShearMinimum[regularity]
  return {
    severity: "info",
    code: "dynamic-base-shear-minimum",
    message: `El cortante dinámico total en la base no puede ser menor que ${minimumRatio * 100}% del cortante estático.`,
    minimumRatio,
    reference: "A.5.4.5",
    evidenceId: baseShearEvidenceIds.dynamicMinimum,
  }
}

function applicabilityWarning(
  code: FheApplicabilityWarningCode,
  message: string,
  source: "permission" | "dynamic-required" = "permission",
): FheApplicabilityWarning {
  return {
    severity: "warning",
    code,
    message,
    reference: source === "permission" ? "A.3.4.2.1" : "A.3.4.2.2",
    evidenceId:
      source === "permission"
        ? baseShearEvidenceIds.applicability
        : baseShearEvidenceIds.dynamicAnalysisRequired,
  }
}

export function fheApplicability(params: FheApplicabilityParams): FheApplicabilityResult {
  const parsed = fheApplicabilityParamsSchema.parse(params)
  const notes: [DynamicBaseShearNote] = [dynamicBaseShearNote(parsed.regularity)]

  if (parsed.hazardZone === "low") {
    return { status: "ok", applicable: true, qualifyingRule: "low-hazard", warnings: [], notes }
  }
  if (parsed.hazardZone === "intermediate" && parsed.importanceGroup === "I") {
    return {
      status: "ok",
      applicable: true,
      qualifyingRule: "intermediate-group-i",
      warnings: [],
      notes,
    }
  }
  if (parsed.flexibleOnRigid) {
    return {
      status: "ok",
      applicable: true,
      qualifyingRule: "flexible-on-rigid",
      warnings: [],
      notes,
    }
  }

  const limits = baseShearConstants.fheApplicability
  const warnings: FheApplicabilityWarning[] = []
  const hasSoftSoil = ["D", "E", "F"].includes(parsed.soilProfile)
  if (hasSoftSoil && parsed.tc === undefined) {
    warnings.push(
      applicabilityWarning(
        "soft-soil-period-check-unavailable",
        "Se requiere Tc para verificar la condición de perfiles D, E o F con T > 2Tc.",
        "dynamic-required",
      ),
    )
  } else if (
    hasSoftSoil &&
    parsed.tc !== undefined &&
    parsed.t > limits.softSoilPeriodMultiplier * parsed.tc
  ) {
    warnings.push(
      applicabilityWarning(
        "soft-soil-long-period",
        "En perfiles D, E o F debe emplearse análisis dinámico cuando T es mayor que 2Tc.",
        "dynamic-required",
      ),
    )
  }

  if (parsed.regularity === "regular") {
    if (parsed.stories > limits.regularMaximumStories) {
      warnings.push(
        applicabilityWarning(
          "regular-story-limit",
          `La edificación regular supera ${limits.regularMaximumStories} niveles.`,
        ),
      )
    }
    if (parsed.heightM > limits.regularMaximumHeightM) {
      warnings.push(
        applicabilityWarning(
          "regular-height-limit",
          `La edificación regular supera ${limits.regularMaximumHeightM} m de altura.`,
        ),
      )
    }
    return {
      status: "ok",
      applicable: warnings.length === 0,
      qualifyingRule: warnings.length === 0 ? "regular-within-limits" : undefined,
      warnings,
      notes,
    }
  }

  if (parsed.stories > limits.irregularMaximumStories) {
    warnings.push(
      applicabilityWarning(
        "irregular-story-limit",
        `La edificación irregular supera ${limits.irregularMaximumStories} niveles.`,
      ),
    )
  }
  if (parsed.heightM > limits.irregularMaximumHeightM) {
    warnings.push(
      applicabilityWarning(
        "irregular-height-limit",
        `La edificación irregular supera ${limits.irregularMaximumHeightM} m de altura.`,
      ),
    )
  }

  return {
    status: "ok",
    applicable: warnings.length === 0,
    qualifyingRule: warnings.length === 0 ? "irregular-within-limits" : undefined,
    warnings,
    notes,
  }
}
