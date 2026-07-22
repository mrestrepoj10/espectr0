import { z } from "zod"

import siteCoefficientsData from "./data/site-coefficients.json"
import { traceFa, traceFv } from "./site-coefficients"
import {
  computeSpectrum,
  hazardLevelDetails,
  saAt,
  spectrumCoefficients,
} from "./spectrum"

import type { Municipio } from "./schema"
import type { SiteCoefficientInterpolationTrace } from "./site-coefficients"
import type {
  SiteSpecificStudyRequired,
  SpectrumBranch,
  SpectrumCoefficients,
  SpectrumParams,
  SpectrumPoint,
} from "./spectrum"

const spectrumBranchSchema = z.enum([
  "rising-A.2.6-7",
  "plateau-A.2.6-3",
  "inverse-T-A.2.6-1",
  "inverse-T2-A.2.6-5",
  "rising-A.12.3-2",
  "plateau-A.12.3-4",
  "inverse-T-A.12.3-1",
  "inverse-T2-A.12.3-6",
])

const spectrumPointSchema = z
  .object({
    t: z.number().finite().nonnegative(),
    sa: z.number().finite().nonnegative(),
    branch: spectrumBranchSchema,
  })
  .strict()

export const siteCoefficientInterpolationTraceSchema = z
  .object({
    coefficient: z.enum(["fa", "fv"]),
    tableId: z.enum(["A.2.4-3", "A.2.4-4"]),
    parameter: z.enum(["Aa", "Av"]),
    inputParameter: z.enum(["Aa", "Av", "Ae", "Ad"]),
    soilProfile: z.enum(["A", "B", "C", "D", "E"]),
    input: z.number().finite(),
    mode: z.enum(["fraction", "exact", "clamped"]),
    clampedTo: z.enum(["lower", "upper"]).nullable(),
    lower: z
      .object({
        breakpoint: z.number().finite(),
        value: z.number().finite().positive(),
      })
      .strict(),
    upper: z
      .object({
        breakpoint: z.number().finite(),
        value: z.number().finite().positive(),
      })
      .strict(),
    fraction: z.number().finite().min(0).max(1),
    result: z.number().finite().positive(),
  })
  .strict()

export const calculationStepSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    reference: z.string().min(1),
    formula: z.string().min(1),
    substitution: z.string().min(1),
    result: z.number().finite(),
    unit: z.string(),
    dependencies: z.array(z.string().min(1)),
  })
  .strict()

const representativePointSchema = z
  .object({
    label: z.string().min(1),
    point: spectrumPointSchema,
    step: calculationStepSchema,
  })
  .strict()

export const calculationTraceSchema = z
  .object({
    schemaVersion: z.literal(1),
    context: z
      .object({
        standard: z.literal("NSR-10"),
        document: z.string().min(1),
        municipality: z
          .object({
            code: z.string().regex(/^\d{5}$/),
            name: z.string().min(1),
            department: z.string().min(1),
          })
          .strict()
          .nullable(),
        hazardLevel: z.enum(["design", "limited-safety", "damage-threshold"]),
        returnPeriodYears: z.number().int().positive(),
        dampingRatio: z.number().positive().max(1),
      })
      .strict(),
    inputs: z
      .object({
        aa: z.number().finite().positive(),
        av: z.number().finite().positive(),
        ae: z.number().finite().positive().nullable(),
        ad: z.number().finite().positive().nullable(),
        hazardLevel: z.enum(["design", "limited-safety", "damage-threshold"]),
        soilProfile: z.enum(["A", "B", "C", "D", "E"]),
        importanceGroup: z.enum(["I", "II", "III", "IV"]),
        mode: z.enum(["general", "modal"]),
      })
      .strict(),
    siteCoefficients: z
      .object({
        fa: siteCoefficientInterpolationTraceSchema.nullable(),
        fv: siteCoefficientInterpolationTraceSchema,
      })
      .strict(),
    steps: z.array(calculationStepSchema),
    branches: z.array(
      z
        .object({
          id: spectrumBranchSchema,
          label: z.string().min(1),
          reference: z.string().min(1),
          condition: z.string().min(1),
          formula: z.string().min(1),
          points: z.array(spectrumPointSchema),
        })
        .strict(),
    ),
    representativePoints: z.array(representativePointSchema).min(1),
  })
  .strict()

export type CalculationStep = z.infer<typeof calculationStepSchema>
export type CalculationTrace = z.infer<typeof calculationTraceSchema>
export type CalculationTraceContext = {
  municipality?: Pick<Municipio, "code" | "municipio" | "departamento">
}
export type SpectralAccelerationTraceOk = {
  status: "ok"
  point: SpectrumPoint
  step: CalculationStep
}
export type SpectralAccelerationTraceResult =
  | SpectralAccelerationTraceOk
  | SiteSpecificStudyRequired

const branchMetadata: Record<
  SpectrumBranch,
  { label: string; reference: string; condition: string; formula: string }
> = {
  "rising-A.2.6-7": {
    label: "Rama ascendente modal",
    reference: "A.2.6.1.2, Ec. A.2.6-7",
    condition: "0 ≤ T < T0, solo en análisis dinámico modal",
    formula: "Sa = Sa_max · (0.4 + 0.6 · T / T0)",
  },
  "plateau-A.2.6-3": {
    label: "Meseta de aceleración",
    reference: "A.2.6.1.1, Ec. A.2.6-3",
    condition: "0 ≤ T ≤ TC en modo general; T0 ≤ T ≤ TC en modo modal",
    formula: "Sa = 2.5 · A · Fa · I",
  },
  "inverse-T-A.2.6-1": {
    label: "Rama de velocidad constante",
    reference: "A.2.6.1, Ec. A.2.6-1",
    condition: "TC < T ≤ TL",
    formula: "Sa = 1.2 · A_v · Fv · I / T",
  },
  "inverse-T2-A.2.6-5": {
    label: "Rama de desplazamiento constante",
    reference: "A.2.6.1.1, Ec. A.2.6-5",
    condition: "T > TL",
    formula: "Sa = 1.2 · A_v · Fv · TL · I / T²",
  },
  "rising-A.12.3-2": {
    label: "Rama ascendente de umbral de daño",
    reference: "A.12.3, Ec. A.12.3-2",
    condition: "0 ≤ T < 0.25 s",
    formula: "Sa = Ad · (1 + 8 · T)",
  },
  "plateau-A.12.3-4": {
    label: "Meseta de umbral de daño",
    reference: "A.12.3, Ec. A.12.3-4",
    condition: "0.25 s ≤ T ≤ TC",
    formula: "Sa = 3 · Ad",
  },
  "inverse-T-A.12.3-1": {
    label: "Rama 1/T de umbral de daño",
    reference: "A.12.3, Ec. A.12.3-1",
    condition: "TC < T ≤ TL",
    formula: "Sa = 1.5 · Ad · S / T",
  },
  "inverse-T2-A.12.3-6": {
    label: "Rama 1/T² de umbral de daño",
    reference: "A.12.3, Ec. A.12.3-6",
    condition: "T > TL",
    formula: "Sa = 1.5 · Ad · S · TL / T²",
  },
}

function decimal(value: number) {
  return Object.is(value, -0) ? "0" : String(value)
}

function interpolationSubstitution(trace: SiteCoefficientInterpolationTrace) {
  if (trace.mode !== "fraction") {
    const action = trace.mode === "exact" ? "columna exacta" : "límite de tabla"
    return `${trace.inputParameter} = ${decimal(trace.input)}; ${action} ${decimal(trace.result)}`
  }

  return `${trace.inputParameter} = ${decimal(trace.input)}; ${decimal(trace.lower.value)} + ${decimal(trace.fraction)} · (${decimal(trace.upper.value)} − ${decimal(trace.lower.value)})`
}

function branchDetails(branch: SpectrumBranch, coefficients: SpectrumCoefficients) {
  const metadata = branchMetadata[branch]
  if (coefficients.hazardLevel === "damage-threshold") return metadata

  const shortSymbol = coefficients.hazardLevel === "design" ? "Aa" : "Ae"
  const longSymbol = coefficients.hazardLevel === "design" ? "Av" : "Ae"
  return {
    ...metadata,
    formula: metadata.formula
      .replace("A_v", longSymbol)
      .replace("A ·", `${shortSymbol} ·`),
  }
}

function interpolationStep(
  trace: SiteCoefficientInterpolationTrace,
): CalculationStep {
  const symbol = trace.coefficient === "fa" ? "Fa" : "Fv"
  return {
    id: trace.coefficient,
    label: `Coeficiente de sitio ${symbol}`,
    reference: `Tabla ${trace.tableId}`,
    formula: `${symbol} = interpolación lineal por perfil de suelo`,
    substitution: interpolationSubstitution(trace),
    result: trace.result,
    unit: "",
    dependencies: [],
  }
}

function derivedSteps(
  coefficients: SpectrumCoefficients,
  faTrace: SiteCoefficientInterpolationTrace | null,
  fvTrace: SiteCoefficientInterpolationTrace,
): CalculationStep[] {
  const steps = faTrace
    ? [interpolationStep(faTrace), interpolationStep(fvTrace)]
    : [interpolationStep(fvTrace)]

  if (coefficients.hazardLevel === "damage-threshold") {
    return [
      ...steps,
      {
        id: "s",
        label: "Coeficiente de sitio para umbral de daño",
        reference: "A.12.3.1",
        formula: "S = 1.25 · Fv",
        substitution: `1.25 · ${decimal(coefficients.fv)}`,
        result: coefficients.s,
        unit: "",
        dependencies: ["fv"],
      },
      {
        id: "tc",
        label: "Período de transición corto",
        reference: "A.12.3",
        formula: "TC = 0.5 · S",
        substitution: `0.5 · ${decimal(coefficients.s)}`,
        result: coefficients.tc,
        unit: "s",
        dependencies: ["s"],
      },
      {
        id: "tl",
        label: "Período de transición largo",
        reference: "A.12.3",
        formula: "TL = 2.4 · S",
        substitution: `2.4 · ${decimal(coefficients.s)}`,
        result: coefficients.tl,
        unit: "s",
        dependencies: ["s"],
      },
      {
        id: "sa-max",
        label: "Aceleración espectral máxima",
        reference: "A.12.3, Ec. A.12.3-4",
        formula: "Sa_max = 3 · Ad",
        substitution: `3 · ${decimal(coefficients.ad)}`,
        result: coefficients.saMax,
        unit: "g",
        dependencies: [],
      },
      {
        id: "pga",
        label: "Aceleración pico del terreno",
        reference: "A.12.3, Ec. A.12.3-2",
        formula: "PGA = Ad",
        substitution: decimal(coefficients.ad),
        result: coefficients.pga,
        unit: "g",
        dependencies: [],
      },
    ]
  }

  const acceleration =
    coefficients.hazardLevel === "design" ? coefficients.aa : coefficients.ae
  const velocity =
    coefficients.hazardLevel === "design" ? coefficients.av : coefficients.ae
  const accelerationSymbol = coefficients.hazardLevel === "design" ? "Aa" : "Ae"
  const velocitySymbol = coefficients.hazardLevel === "design" ? "Av" : "Ae"

  return [
    ...steps,
    {
      id: "importance",
      label: "Coeficiente de importancia",
      reference: "A.2.5.2, Tabla A.2.5-1",
      formula: "I = valor del grupo de uso",
      substitution: decimal(coefficients.i),
      result: coefficients.i,
      unit: "",
      dependencies: [],
    },
    {
      id: "t0",
      label: "Período inicial de control",
      reference: "A.2.6.1.2",
      formula: `T0 = 0.1 · ${velocitySymbol} · Fv / (${accelerationSymbol} · Fa)`,
      substitution: `0.1 · ${decimal(velocity)} · ${decimal(coefficients.fv)} / (${decimal(acceleration)} · ${decimal(coefficients.fa)})`,
      result: coefficients.t0,
      unit: "s",
      dependencies: ["fa", "fv"],
    },
    {
      id: "tc",
      label: "Período de transición corto",
      reference: "A.2.6.1.1",
      formula: `TC = 0.48 · ${velocitySymbol} · Fv / (${accelerationSymbol} · Fa)`,
      substitution: `0.48 · ${decimal(velocity)} · ${decimal(coefficients.fv)} / (${decimal(acceleration)} · ${decimal(coefficients.fa)})`,
      result: coefficients.tc,
      unit: "s",
      dependencies: ["fa", "fv"],
    },
    {
      id: "tl",
      label: "Período de transición largo",
      reference: "A.2.6.1.1",
      formula: "TL = 2.4 · Fv",
      substitution: `2.4 · ${decimal(coefficients.fv)}`,
      result: coefficients.tl,
      unit: "s",
      dependencies: ["fv"],
    },
    {
      id: "sa-max",
      label: "Aceleración espectral máxima",
      reference: "A.2.6.1.1, Ec. A.2.6-3",
      formula: `Sa_max = 2.5 · ${accelerationSymbol} · Fa · I`,
      substitution: `2.5 · ${decimal(acceleration)} · ${decimal(coefficients.fa)} · ${decimal(coefficients.i)}`,
      result: coefficients.saMax,
      unit: "g",
      dependencies: ["fa", "importance"],
    },
    {
      id: "pga",
      label: "Aceleración pico del terreno",
      reference: "A.2.6.1.2, Ec. A.2.6-7",
      formula: `PGA = ${accelerationSymbol} · Fa · I`,
      substitution: `${decimal(acceleration)} · ${decimal(coefficients.fa)} · ${decimal(coefficients.i)}`,
      result: coefficients.pga,
      unit: "g",
      dependencies: ["fa", "importance"],
    },
  ]
}

function pointStep(
  point: SpectrumPoint,
  coefficients: SpectrumCoefficients,
): CalculationStep {
  const metadata = branchDetails(point.branch, coefficients)
  let substitution: string
  let dependencies: string[]

  switch (point.branch) {
    case "rising-A.2.6-7":
      if (coefficients.hazardLevel === "damage-threshold") throw new Error("Invalid branch")
      substitution = `${decimal(coefficients.saMax)} · (0.4 + 0.6 · ${decimal(point.t)} / ${decimal(coefficients.t0)})`
      dependencies = ["sa-max", "t0"]
      break
    case "plateau-A.2.6-3":
      substitution = decimal(coefficients.saMax)
      dependencies = ["sa-max"]
      break
    case "inverse-T-A.2.6-1": {
      if (coefficients.hazardLevel === "damage-threshold") throw new Error("Invalid branch")
      const acceleration =
        coefficients.hazardLevel === "design" ? coefficients.av : coefficients.ae
      substitution = `1.2 · ${decimal(acceleration)} · ${decimal(coefficients.fv)} · ${decimal(coefficients.i)} / ${decimal(point.t)}`
      dependencies = ["fv", "importance"]
      break
    }
    case "inverse-T2-A.2.6-5": {
      if (coefficients.hazardLevel === "damage-threshold") throw new Error("Invalid branch")
      const acceleration =
        coefficients.hazardLevel === "design" ? coefficients.av : coefficients.ae
      substitution = `1.2 · ${decimal(acceleration)} · ${decimal(coefficients.fv)} · ${decimal(coefficients.tl)} · ${decimal(coefficients.i)} / ${decimal(point.t)}²`
      dependencies = ["fv", "tl", "importance"]
      break
    }
    case "rising-A.12.3-2":
      if (coefficients.hazardLevel !== "damage-threshold") throw new Error("Invalid branch")
      substitution = `${decimal(coefficients.ad)} · (1 + 8 · ${decimal(point.t)})`
      dependencies = []
      break
    case "plateau-A.12.3-4":
      if (coefficients.hazardLevel !== "damage-threshold") throw new Error("Invalid branch")
      substitution = `3 · ${decimal(coefficients.ad)}`
      dependencies = []
      break
    case "inverse-T-A.12.3-1":
      if (coefficients.hazardLevel !== "damage-threshold") throw new Error("Invalid branch")
      substitution = `1.5 · ${decimal(coefficients.ad)} · ${decimal(coefficients.s)} / ${decimal(point.t)}`
      dependencies = ["s"]
      break
    case "inverse-T2-A.12.3-6":
      if (coefficients.hazardLevel !== "damage-threshold") throw new Error("Invalid branch")
      substitution = `1.5 · ${decimal(coefficients.ad)} · ${decimal(coefficients.s)} · ${decimal(coefficients.tl)} / ${decimal(point.t)}²`
      dependencies = ["s", "tl"]
      break
  }

  return {
    id: `sa-at-${decimal(point.t)}`,
    label: `Ordenada espectral en T = ${decimal(point.t)} s`,
    reference: metadata.reference,
    formula: metadata.formula,
    substitution,
    result: point.sa,
    unit: "g",
    dependencies,
  }
}

/** Produces a formula-level proof for one spectral ordinate without a UI calculation. */
export function traceSaAt(
  t: number,
  params: SpectrumParams,
): SpectralAccelerationTraceResult {
  const point = saAt(t, params)
  if (point.status !== "ok") return point

  const coefficients = spectrumCoefficients(params)
  if ("status" in coefficients) return coefficients

  return {
    status: "ok",
    point: { t: point.t, sa: point.sa, branch: point.branch },
    step: pointStep(point, coefficients),
  }
}

function representativePeriods(
  coefficients: SpectrumCoefficients,
  mode: SpectrumParams["mode"],
  finalPeriod: number,
) {
  const periods = new Set<number>([0])
  if (coefficients.hazardLevel === "damage-threshold") periods.add(0.25)
  else if (mode === "modal") periods.add(coefficients.t0)
  periods.add(coefficients.tc)
  periods.add(coefficients.tl)
  periods.add(finalPeriod)
  return [...periods].sort((left, right) => left - right)
}

/** Builds the deterministic, serializable calculation artifact for one spectrum. */
export function computeCalculationTrace(
  params: SpectrumParams,
  context: CalculationTraceContext = {},
): CalculationTrace | SiteSpecificStudyRequired {
  const spectrum = computeSpectrum(params)
  if (spectrum.status !== "ok") return spectrum

  const coefficients = spectrum.coefficients
  const profile = params.soilProfile
  if (profile === "F") throw new Error("Soil F cannot produce a spectrum trace")

  const hazardInput =
    coefficients.hazardLevel === "design"
      ? { fa: params.aa, fv: params.av }
      : coefficients.hazardLevel === "limited-safety"
        ? { fa: coefficients.ae, fv: coefficients.ae }
        : { fa: null, fv: coefficients.ad }
  const inputParameter =
    coefficients.hazardLevel === "design"
      ? { fa: "Aa" as const, fv: "Av" as const }
      : coefficients.hazardLevel === "limited-safety"
        ? { fa: "Ae" as const, fv: "Ae" as const }
        : { fa: null, fv: "Ad" as const }
  const faTrace =
    hazardInput.fa === null || inputParameter.fa === null
      ? null
      : traceFa(hazardInput.fa, profile, inputParameter.fa)
  const fvTrace = traceFv(hazardInput.fv, profile, inputParameter.fv)
  const finalPeriod = spectrum.points.at(-1)?.t
  if (finalPeriod === undefined) throw new Error("Spectrum sampling returned no points")

  const representativePoints = representativePeriods(
    coefficients,
    spectrum.mode,
    finalPeriod,
  ).map((period) => {
    const traced = traceSaAt(period, params)
    if (traced.status !== "ok") throw new Error("Supported soil returned no ordinate")
    return {
      label: period === finalPeriod ? "Final del intervalo graficado" : "Punto de control",
      point: traced.point,
      step: traced.step,
    }
  })

  const details = hazardLevelDetails[spectrum.hazardLevel]
  const trace = {
    schemaVersion: 1 as const,
    context: {
      standard: "NSR-10" as const,
      document: siteCoefficientsData.source.document,
      municipality: context.municipality
        ? {
            code: context.municipality.code,
            name: context.municipality.municipio,
            department: context.municipality.departamento,
          }
        : null,
      hazardLevel: spectrum.hazardLevel,
      returnPeriodYears: details.returnPeriodYears,
      dampingRatio: details.dampingRatio,
    },
    inputs: {
      aa: params.aa,
      av: params.av,
      ae: params.ae ?? null,
      ad: params.ad ?? null,
      hazardLevel: spectrum.hazardLevel,
      soilProfile: profile,
      importanceGroup: params.importanceGroup,
      mode: spectrum.mode,
    },
    siteCoefficients: { fa: faTrace, fv: fvTrace },
    steps: derivedSteps(coefficients, faTrace, fvTrace),
    branches: spectrum.branches.map((branch) => ({
      id: branch,
      ...branchDetails(branch, coefficients),
      points: spectrum.points.filter((point) => point.branch === branch),
    })),
    representativePoints,
  }

  return calculationTraceSchema.parse(trace)
}
