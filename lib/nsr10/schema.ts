import { z } from "zod"

import { approximatePeriodSystems } from "./base-shear-constants"

export const supportedSoilProfileSchema = z.enum(["A", "B", "C", "D", "E"])
export const soilProfileSchema = z.enum(["A", "B", "C", "D", "E", "F"])
export const importanceGroupSchema = z.enum(["I", "II", "III", "IV"])
export const approximatePeriodSystemSchema = z.enum(approximatePeriodSystems)
export const seismicHazardZoneSchema = z.enum(["low", "intermediate", "high"])
export const structuralRegularitySchema = z.enum(["regular", "irregular"])
export const dynamicAnalysisIrregularitySchema = z.enum([
  "none",
  "vertical-1aA",
  "vertical-1bA",
  "vertical-2A",
  "vertical-3A",
  "unclassified",
])

export const approximatePeriodParamsSchema = z
  .object({
    system: approximatePeriodSystemSchema,
    hn: z.number().finite().positive(),
  })
  .strict()

export const periodCeilingParamsSchema = z
  .object({
    av: z.number().finite().positive(),
    fv: z.number().finite().positive(),
    ta: z.number().finite().positive(),
    tAnalytical: z.number().finite().positive().optional(),
  })
  .strict()

export const forceDistributionStorySchema = z
  .object({
    wx: z.number().finite().positive(),
    hx: z.number().finite().positive(),
  })
  .strict()

export const forceDistributionParamsSchema = z
  .object({
    stories: z.array(forceDistributionStorySchema).min(1),
    t: z.number().finite().nonnegative(),
    vs: z.number().finite().positive(),
  })
  .strict()

export const fheApplicabilityParamsSchema = z
  .object({
    hazardZone: seismicHazardZoneSchema,
    importanceGroup: importanceGroupSchema,
    regularity: structuralRegularitySchema,
    dynamicAnalysisIrregularity: dynamicAnalysisIrregularitySchema,
    stories: z.number().int().positive(),
    heightM: z.number().finite().positive(),
    soilProfile: soilProfileSchema,
    t: z.number().finite().nonnegative(),
    tc: z.number().finite().positive().optional(),
    flexibleOnRigid: z.boolean().optional(),
  })
  .strict()

export const municipioSchema = z
  .object({
    code: z.string().regex(/^\d{5}$/, "Expected a five-digit DANE municipality code"),
    departamento: z.string().trim().min(1),
    municipio: z.string().trim().min(1),
    aa: z.number().finite().min(0.05).max(0.5),
    av: z.number().finite().min(0.05).max(0.5),
    ae: z.number().finite().min(0.02).max(0.36),
    ad: z.number().finite().min(0.02).max(0.14),
  })
  .strict()

export const municipiosSchema = z.array(municipioSchema)

const regulatorySourceSchema = z
  .object({
    document: z.string().trim().min(1),
    fa_section: z.string().trim().min(1),
    fa_table: z.string().trim().min(1),
    fv_section: z.string().trim().min(1),
    fv_table: z.string().trim().min(1),
  })
  .strict()

const coefficientProfilesSchema = z.record(
  supportedSoilProfileSchema,
  z.array(z.number().finite().positive()).min(1),
)

export const siteCoefficientTableSchema = z
  .object({
    parameter: z.enum(["Aa", "Av"]),
    breakpoints: z.array(z.number().finite().nonnegative()).min(2),
    profiles: coefficientProfilesSchema,
  })
  .strict()

export const siteCoefficientsSchema = z
  .object({
    source: regulatorySourceSchema,
    interpolation: z.string().trim().min(1),
    fa: siteCoefficientTableSchema.extend({ parameter: z.literal("Aa") }),
    fv: siteCoefficientTableSchema.extend({ parameter: z.literal("Av") }),
    profile_f: z
      .object({
        supported: z.literal(false),
        section: z.literal("A.2.10"),
        notice: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict()

export const importanceCoefficientsSchema = z
  .object({
    source: z
      .object({
        document: z.string().trim().min(1),
        section: z.string().trim().min(1),
        table: z.string().trim().min(1),
      })
      .strict(),
    groups: z.record(importanceGroupSchema, z.number().finite().positive()),
  })
  .strict()

const decimalWitnessSchema = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/, "Expected a decimal witness")

export const oracleUnitsSchema = z
  .object({
    aa: z.literal("fraction-of-g"),
    av: z.literal("fraction-of-g"),
    fa: z.literal("dimensionless"),
    fv: z.literal("dimensionless"),
    importance_coefficient: z.literal("dimensionless"),
    t: z.literal("s"),
    fixed_periods: z.literal("s"),
    period: z.literal("s"),
    period_decimal: z.literal("s"),
    t0: z.literal("s"),
    tc: z.literal("s"),
    tl: z.literal("s"),
    sa_max: z.literal("fraction-of-g"),
    sa: z.literal("fraction-of-g"),
    sa_decimal: z.literal("fraction-of-g"),
  })
  .strict()

export const oracleAbsoluteTolerancesSchema = z
  .object({
    acceleration: z
      .object({
        value: z.number().finite().positive(),
        unit: z.literal("fraction-of-g"),
      })
      .strict(),
    period: z
      .object({ value: z.number().finite().positive(), unit: z.literal("s") })
      .strict(),
    coefficient: z
      .object({
        value: z.number().finite().positive(),
        unit: z.literal("dimensionless"),
      })
      .strict(),
  })
  .strict()

const oracleFormulaReferenceSchema = z.enum([
  "A.2.6-1",
  "A.2.6-2",
  "A.2.6-3",
  "A.2.6-4",
  "A.2.6-5",
  "A.2.6-6",
])

const oracleDerivedValuesSchema = z
  .object({
    fa: z.number().finite().positive(),
    fv: z.number().finite().positive(),
    t0: z.number().finite().nonnegative(),
    tc: z.number().finite().nonnegative(),
    tl: z.number().finite().nonnegative(),
    sa_max: z.number().finite().nonnegative(),
  })
  .strict()

const oracleDecimalValuesSchema = z
  .object({
    fa: decimalWitnessSchema,
    fv: decimalWitnessSchema,
    t0: decimalWitnessSchema,
    tc: decimalWitnessSchema,
    tl: decimalWitnessSchema,
    sa_max: decimalWitnessSchema,
  })
  .strict()

const oracleArithmeticSchema = z
  .object({
    fa: z.string().min(1),
    fv: z.string().min(1),
    t0: z.string().min(1),
    tc: z.string().min(1),
    tl: z.string().min(1),
    sa_max: z.string().min(1),
  })
  .strict()

export const oraclePointSchema = z
  .object({
    period: z.number().finite().nonnegative(),
    period_decimal: decimalWitnessSchema,
    anchors: z.array(z.string().min(1)).min(1),
    sa: z.number().finite().nonnegative(),
    sa_decimal: decimalWitnessSchema,
    branch: z.enum([
      "plateau-A.2.6-3",
      "inverse-T-A.2.6-1",
      "inverse-T2-A.2.6-5",
    ]),
    arithmetic: z.string().min(1),
  })
  .strict()

export const oracleCaseSchema = z
  .object({
    id: z.string().min(1),
    sampling_band: z.enum([
      "low-coefficient",
      "intermediate-coefficient",
      "high-coefficient",
    ]),
    municipio: z.string().trim().min(1),
    departamento: z.string().trim().min(1),
    aa: z.number().finite().min(0.05).max(0.5),
    av: z.number().finite().min(0.05).max(0.5),
    soil_profile: supportedSoilProfileSchema,
    importance_group: importanceGroupSchema,
    importance_coefficient: z.number().finite().positive(),
    expected: oracleDerivedValuesSchema,
    expected_decimal: oracleDecimalValuesSchema,
    arithmetic: oracleArithmeticSchema,
    expected_sa_points: z.array(oraclePointSchema).min(1),
  })
  .strict()

const oracleSourceSchema = z
  .object({
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export const oracleSchema = z
  .object({
    schema_version: z.number().int().positive(),
    description: z.string().min(1),
    numeric_contract: z
      .object({
        calculation: z.string().min(1),
        json_numbers: z.string().min(1),
        decimal_witnesses: z.string().min(1),
        absolute_tolerances: oracleAbsoluteTolerancesSchema,
      })
      .strict(),
    legal_qualification: z.string().min(1),
    sampling_note: z.string().min(1),
    units: oracleUnitsSchema,
    formula_inventory: z.array(oracleFormulaReferenceSchema).length(6),
    sources: z
      .object({
        municipios: oracleSourceSchema,
        site_coefficients: oracleSourceSchema,
        importance_coefficients: oracleSourceSchema,
        spectrum_formulas: oracleSourceSchema,
      })
      .strict(),
    coverage: z
      .object({
        case_count: z.number().int().positive(),
        soil_profiles: z.array(supportedSoilProfileSchema).min(1),
        importance_groups: z.array(importanceGroupSchema).min(1),
        sampling_bands: z
          .array(
            z.enum([
              "low-coefficient",
              "intermediate-coefficient",
              "high-coefficient",
            ]),
          )
          .min(1),
        fixed_periods: z.array(z.number().finite().nonnegative()).min(1),
        case_periods: z.string().min(1),
      })
      .strict(),
    cases: z.array(oracleCaseSchema).min(1),
  })
  .strict()

export type SupportedSoilProfile = z.infer<typeof supportedSoilProfileSchema>
export type SoilProfile = z.infer<typeof soilProfileSchema>
export type ImportanceGroup = z.infer<typeof importanceGroupSchema>
export type ApproximatePeriodSystem = z.infer<typeof approximatePeriodSystemSchema>
export type SeismicHazardZone = z.infer<typeof seismicHazardZoneSchema>
export type StructuralRegularity = z.infer<typeof structuralRegularitySchema>
export type DynamicAnalysisIrregularity = z.infer<typeof dynamicAnalysisIrregularitySchema>
export type ApproximatePeriodParams = z.infer<typeof approximatePeriodParamsSchema>
export type PeriodCeilingParams = z.infer<typeof periodCeilingParamsSchema>
export type ForceDistributionStory = z.infer<typeof forceDistributionStorySchema>
export type ForceDistributionParams = z.infer<typeof forceDistributionParamsSchema>
export type FheApplicabilityParams = z.infer<typeof fheApplicabilityParamsSchema>
export type Municipio = z.infer<typeof municipioSchema>
export type Municipios = z.infer<typeof municipiosSchema>
export type SiteCoefficientTable = z.infer<typeof siteCoefficientTableSchema>
export type SiteCoefficients = z.infer<typeof siteCoefficientsSchema>
export type ImportanceCoefficients = z.infer<typeof importanceCoefficientsSchema>
export type OraclePoint = z.infer<typeof oraclePointSchema>
export type OracleCase = z.infer<typeof oracleCaseSchema>
export type Oracle = z.infer<typeof oracleSchema>
