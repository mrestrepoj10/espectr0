export const approximatePeriodSystems = [
  "concrete-moment-frame",
  "steel-moment-frame",
  "steel-eccentric-or-brb-braced",
  "all-other",
] as const

export type ApproximatePeriodSystem = (typeof approximatePeriodSystems)[number]

type ApproximatePeriodCoefficient = {
  ct: number
  alpha: number
  evidenceId: "a4.2.3-approximate-period"
}

export const approximatePeriodCoefficients = {
  "concrete-moment-frame": {
    ct: 0.047,
    alpha: 0.9,
    evidenceId: "a4.2.3-approximate-period",
  },
  "steel-moment-frame": {
    ct: 0.072,
    alpha: 0.8,
    evidenceId: "a4.2.3-approximate-period",
  },
  "steel-eccentric-or-brb-braced": {
    ct: 0.073,
    alpha: 0.75,
    evidenceId: "a4.2.3-approximate-period",
  },
  "all-other": {
    ct: 0.049,
    alpha: 0.75,
    evidenceId: "a4.2.3-approximate-period",
  },
} as const satisfies Record<ApproximatePeriodSystem, ApproximatePeriodCoefficient>

export const baseShearConstants = {
  gravityMps2: 9.8,
  periodCeiling: {
    intercept: 1.75,
    avFvFactor: 1.2,
    minimum: 1.2,
  },
  forceDistribution: {
    firstBoundarySeconds: 0.5,
    secondBoundarySeconds: 2.5,
    middleIntercept: 0.75,
    middleSlope: 0.5,
    lowPeriodExponent: 1,
    highPeriodExponent: 2,
  },
  fheApplicability: {
    regularMaximumStories: 20,
    regularMaximumHeightM: 60,
    irregularMaximumStories: 6,
    irregularMaximumHeightM: 18,
    softSoilPeriodMultiplier: 2,
  },
  dynamicBaseShearMinimum: {
    regular: 0.8,
    irregular: 0.9,
  },
} as const

export const baseShearEvidenceIds = {
  gravityAndMass: "a3.0-gravity-mass",
  applicability: "a3.4.2.1-fhe-applicability",
  dynamicAnalysisRequired: "a3.4.2.2-dynamic-required",
  periodCeiling: "a4.2.2-period-ceiling",
  approximatePeriod: "a4.2.3-approximate-period",
  baseShear: "a4.3.1-base-shear",
  forceDistribution: "a4.3.2-force-distribution",
  dynamicMinimum: "a5.4.5-dynamic-minimum",
} as const
