import { z } from "zod"

import {
  computeCalculationTrace,
  computeSpectrum,
  hazardLevelDetails,
  saAt,
} from "../nsr10"
import {
  importanceGroupSchema,
  soilProfileSchema,
} from "../nsr10/schema"
import {
  SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  supportedCapability,
  unsupportedCapability,
  spectrumCapabilitiesSchema,
} from "./capabilities"
import {
  SPECTRUM_CONTRACT_SCHEMA_VERSION,
  normalizedSpectrumOrdinateSchema,
  normalizedSpectrumResultDataSchema,
  nsr10NationalScenarioSchema,
} from "./types"
import { spectrumEngineMetadataSchema } from "./engine"

import type { CalculationTraceContext, SpectrumParams } from "../nsr10"
import type { SpectrumEngine } from "./engine"
import type {
  Applicability,
  NormalizedInputs,
  NormalizedSpectrumPoint,
  NormalizedSpectrumResult,
  SpectrumBranchMetadata,
  SpectrumMetric,
} from "./types"

export const NSR10_ENGINE_ID = "nsr10-existing-adapter" as const
export const NSR10_ENGINE_VERSION = "1" as const
export const NSR10_STUDY_ID = "nsr10-national" as const
export const NSR10_STUDY_VERSION = "NSR-10-2010" as const
export const NSR10_TRACE_SCHEMA_VERSION = 1 as const

export const nsr10Capabilities = spectrumCapabilitiesSchema.parse({
  comparison: supportedCapability(),
  contextualPdf: supportedCapability(),
  csvExport: supportedCapability(),
  etabsExport: supportedCapability(),
  jsonExport: supportedCapability(),
  svgPngExport: supportedCapability(),
  buildingBaseShear: supportedCapability(),
  fheWorkflow: supportedCapability(),
  bridgeRFactorWorkflow: unsupportedCapability(
    "NSR-10 national building spectra do not define the CCP-14 bridge R-factor workflow.",
  ),
  traceabilityViewer: supportedCapability(),
})

const normalizedNsr10InputsSchema = z
  .object({
    aa: z.number().finite(),
    av: z.number().finite(),
    ae: z.number().finite().nullable(),
    ad: z.number().finite().nullable(),
    hazardLevel: z.enum(["design", "limited-safety", "damage-threshold"]),
    soilProfile: soilProfileSchema,
    importanceGroup: importanceGroupSchema,
    mode: z.enum(["general", "modal"]),
    municipality: z
      .object({
        code: z.string().regex(/^\d{5}$/),
        municipio: z.string().trim().min(1),
        departamento: z.string().trim().min(1),
      })
      .strict()
      .nullable(),
  })
  .strict()

export const nsr10AdapterScenarioSchema = nsr10NationalScenarioSchema.extend({
  studyVersion: z.literal(NSR10_STUDY_VERSION),
  inputs: normalizedNsr10InputsSchema,
})

export type Nsr10AdapterScenario = z.infer<typeof nsr10AdapterScenarioSchema>

const branchFormulaId = (branchId: string) => {
  const clauseStart = branchId.indexOf("A.")
  if (clauseStart < 0) throw new Error(`NSR-10 branch has no formula ID: ${branchId}`)
  return `nsr10:formula:${branchId.slice(clauseStart)}`
}

const formulaCitationId = (formulaId: string) =>
  formulaId.replace("nsr10:formula:", "nsr10:citation:")

function normalizedPoint(point: {
  t: number
  sa: number
  branch: string
}): NormalizedSpectrumPoint {
  const formulaId = branchFormulaId(point.branch)
  return {
    tSeconds: point.t,
    saG: point.sa,
    branchId: point.branch,
    formulaId,
    citationIds: [formulaCitationId(formulaId)],
  }
}

function normalizedInputs(
  params: SpectrumParams,
  context: CalculationTraceContext,
): NormalizedInputs {
  return {
    aa: params.aa,
    av: params.av,
    ae: params.ae ?? null,
    ad: params.ad ?? null,
    hazardLevel: params.hazardLevel ?? "design",
    soilProfile: params.soilProfile,
    importanceGroup: params.importanceGroup,
    mode: params.mode ?? "general",
    municipality: context.municipality
      ? {
          code: context.municipality.code,
          municipio: context.municipality.municipio,
          departamento: context.municipality.departamento,
        }
      : null,
  }
}

const metricMetadata = {
  aa: { label: "Aa", unit: "g", citationIds: ["nsr10:citation:municipality-aa"] },
  av: { label: "Av", unit: "g", citationIds: ["nsr10:citation:municipality-av"] },
  ae: { label: "Ae", unit: "g", citationIds: ["nsr10:citation:municipality-ae"] },
  ad: { label: "Ad", unit: "g", citationIds: ["nsr10:citation:municipality-ad"] },
  fa: { label: "Fa", unit: "dimensionless", citationIds: ["nsr10:citation:A.2.4-3"] },
  fv: { label: "Fv", unit: "dimensionless", citationIds: ["nsr10:citation:A.2.4-4"] },
  i: { label: "I", unit: "dimensionless", citationIds: ["nsr10:citation:A.2.5-1"] },
  s: { label: "S", unit: "dimensionless", citationIds: ["nsr10:citation:A.12.3.1"] },
  t0: { label: "T0", unit: "s", citationIds: ["nsr10:citation:A.2.6-6"] },
  tc: { label: "TC", unit: "s", citationIds: ["nsr10:citation:spectrum-control-period"] },
  tl: { label: "TL", unit: "s", citationIds: ["nsr10:citation:spectrum-long-period"] },
  saMax: { label: "Sa max", unit: "g", citationIds: ["nsr10:citation:spectrum-plateau"] },
  pga: { label: "PGA", unit: "g", citationIds: ["nsr10:citation:spectrum-pga"] },
} as const

function metricsFromCoefficients(coefficients: Record<string, unknown>): SpectrumMetric[] {
  return Object.entries(metricMetadata).flatMap(([id, metadata]) => {
    const value = coefficients[id]
    if (typeof value !== "number") return []
    return [
      {
        id,
        label: metadata.label,
        value,
        unit: metadata.unit,
        formulaId: null,
        citationIds: [...metadata.citationIds],
      },
    ] satisfies SpectrumMetric[]
  })
}

function branchMetadata(branchIds: readonly string[]): SpectrumBranchMetadata[] {
  return branchIds.map((id) => {
    const formulaId = branchFormulaId(id)
    return { id, formulaId, citationIds: [formulaCitationId(formulaId)] }
  })
}

function citationIds(
  branches: readonly SpectrumBranchMetadata[],
  context: CalculationTraceContext,
  applicability: Applicability,
) {
  const ids = new Set<string>([
    "nsr10:citation:hazard-metadata",
    "nsr10:citation:A.2.4-3",
    "nsr10:citation:A.2.4-4",
  ])
  for (const branch of branches) {
    for (const citationId of branch.citationIds) ids.add(citationId)
  }
  if (context.municipality) {
    ids.add(`nsr10:citation:municipality:${context.municipality.code}`)
  }
  if (applicability.status !== "applicable") {
    for (const citationId of applicability.citationIds) ids.add(citationId)
  }
  return [...ids]
}

function siteSpecificApplicability(message: string): Applicability {
  return {
    status: "site-specific-study-required",
    reasonCode: "soil-profile-f",
    message,
    citationIds: ["nsr10:citation:A.2.10"],
  }
}

/**
 * Wraps the current NSR-10 spectrum and trace APIs. No spectrum equation is
 * evaluated in this adapter; all ordinates and metrics project parent results.
 */
export function adaptNsr10Spectrum(
  params: SpectrumParams,
  context: CalculationTraceContext = {},
): NormalizedSpectrumResult {
  const parent = computeSpectrum(params)
  const details = hazardLevelDetails[parent.hazardLevel]
  const inputs = normalizedInputs(params, context)

  if (parent.status !== "ok") {
    const applicability = siteSpecificApplicability(parent.notice)
    const data = normalizedSpectrumResultDataSchema.parse({
      schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
      status: "site-specific-study-required",
      engine: { id: NSR10_ENGINE_ID, version: NSR10_ENGINE_VERSION },
      study: { id: NSR10_STUDY_ID, version: NSR10_STUDY_VERSION },
      scenarioType: "nsr10-national",
      normalizedInputs: inputs,
      points: [],
      metrics: [],
      formulaIds: [],
      branches: [],
      hazard: {
        id: parent.hazardLevel,
        label: details.label,
        returnPeriodYears: details.returnPeriodYears,
        dampingRatio: details.dampingRatio,
      },
      warnings: [
        {
          severity: "warning",
          code: "site-specific-study-required",
          message: parent.notice,
          citationIds: ["nsr10:citation:A.2.10"],
        },
      ],
      applicability,
      sourceIds: ["nsr10:title-a:2017"],
      citationIds: citationIds([], context, applicability),
      traceSchemaVersion: NSR10_TRACE_SCHEMA_VERSION,
      trace: null,
      capabilities: nsr10Capabilities,
    })

    return {
      ...data,
      saAt(tSeconds) {
        const ordinate = saAt(tSeconds, params)
        if (ordinate.status === "ok") {
          throw new Error("Soil F unexpectedly produced an NSR-10 ordinate")
        }
        return normalizedSpectrumOrdinateSchema.parse({
          status: "unavailable",
          applicability: siteSpecificApplicability(ordinate.notice),
        })
      },
    }
  }

  const branches = branchMetadata(parent.branches)
  const applicability = { status: "applicable" as const }
  const trace = computeCalculationTrace(params, context)
  if ("status" in trace) throw new Error("Successful spectrum returned no calculation trace")
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "ok",
    engine: { id: NSR10_ENGINE_ID, version: NSR10_ENGINE_VERSION },
    study: { id: NSR10_STUDY_ID, version: NSR10_STUDY_VERSION },
    scenarioType: "nsr10-national",
    normalizedInputs: inputs,
    points: parent.points.map(normalizedPoint),
    metrics: metricsFromCoefficients(parent.coefficients),
    formulaIds: branches.map(({ formulaId }) => formulaId),
    branches,
    hazard: {
      id: parent.hazardLevel,
      label: details.label,
      returnPeriodYears: parent.returnPeriodYears,
      dampingRatio: parent.dampingRatio,
    },
    warnings: [],
    applicability,
    sourceIds: ["nsr10:title-a:2017"],
    citationIds: citationIds(branches, context, applicability),
    traceSchemaVersion: NSR10_TRACE_SCHEMA_VERSION,
    trace,
    capabilities: nsr10Capabilities,
  })

  return {
    ...data,
    saAt(tSeconds) {
      const ordinate = saAt(tSeconds, params)
      if (ordinate.status !== "ok") {
        return normalizedSpectrumOrdinateSchema.parse({
          status: "unavailable",
          applicability: siteSpecificApplicability(ordinate.notice),
        })
      }
      return normalizedSpectrumOrdinateSchema.parse({
        status: "ok",
        point: normalizedPoint(ordinate),
      })
    },
  }
}

export function createNsr10AdapterScenario(
  params: SpectrumParams,
  context: CalculationTraceContext = {},
): Nsr10AdapterScenario {
  return nsr10AdapterScenarioSchema.parse({
    type: "nsr10-national",
    studyId: NSR10_STUDY_ID,
    studyVersion: NSR10_STUDY_VERSION,
    inputs: normalizedInputs(params, context),
  })
}

function scenarioParams(scenario: Nsr10AdapterScenario): SpectrumParams {
  return {
    aa: scenario.inputs.aa,
    av: scenario.inputs.av,
    ae: scenario.inputs.ae ?? undefined,
    ad: scenario.inputs.ad ?? undefined,
    hazardLevel: scenario.inputs.hazardLevel,
    soilProfile: scenario.inputs.soilProfile,
    importanceGroup: scenario.inputs.importanceGroup,
    mode: scenario.inputs.mode,
  }
}

function scenarioContext(scenario: Nsr10AdapterScenario): CalculationTraceContext {
  return scenario.inputs.municipality
    ? { municipality: scenario.inputs.municipality }
    : {}
}

const nsr10EngineMetadata = spectrumEngineMetadataSchema.parse({
  id: NSR10_ENGINE_ID,
  version: NSR10_ENGINE_VERSION,
  studyId: NSR10_STUDY_ID,
  studyVersion: NSR10_STUDY_VERSION,
  scenarioType: "nsr10-national",
  capabilitySchemaVersion: SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  capabilities: nsr10Capabilities,
})

export const nsr10SpectrumEngine: SpectrumEngine<Nsr10AdapterScenario> = {
  metadata: nsr10EngineMetadata,
  accepts(scenario): scenario is Nsr10AdapterScenario {
    return nsr10AdapterScenarioSchema.safeParse(scenario).success
  },
  compute(scenario) {
    const parsed = nsr10AdapterScenarioSchema.parse(scenario)
    return adaptNsr10Spectrum(scenarioParams(parsed), scenarioContext(parsed))
  },
}
