import { z } from "zod"

import {
  calculationTraceSchema,
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
import { spectrumEngineMetadataSchema } from "./engine"
import {
  NSR10_ENGINE_ID,
  NSR10_SOURCE_ID,
  NSR10_TRACE_SCHEMA_ID,
  assertNsr10LineageResolves,
  validateNsr10MunicipalityContext,
} from "./nsr10-evidence"
import {
  NSR10_STUDY_ID,
  NSR10_STUDY_VERSION,
} from "./nsr10-study-relations"
import {
  SPECTRUM_CONTRACT_SCHEMA_VERSION,
  normalizedSpectrumOrdinateSchema,
  normalizedSpectrumResultDataSchema,
  nsr10NationalScenarioSchema,
} from "./types"

import type {
  CalculationTrace,
  CalculationTraceContext,
  SpectrumParams,
} from "../nsr10"
import type { SpectrumEngine } from "./engine"
import type {
  NormalizedInputs,
  NormalizedSpectrumPoint,
  NormalizedSpectrumResult,
  SpectrumBranchMetadata,
  SpectrumMetric,
} from "./types"

export const NSR10_ENGINE_VERSION = "1" as const
export { NSR10_STUDY_ID, NSR10_STUDY_VERSION }
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

function snapshotInputs(params: SpectrumParams) {
  // Snapshot first, but leave runtime validation to the parent API. In
  // particular, Zod rejects non-finite numbers with a ZodError while the
  // existing NSR-10 functions deliberately expose stable RangeError messages.
  return Object.freeze({
    aa: params.aa,
    av: params.av,
    ...(params.ae === undefined ? {} : { ae: params.ae }),
    ...(params.ad === undefined ? {} : { ad: params.ad }),
    ...(params.hazardLevel === undefined ? {} : { hazardLevel: params.hazardLevel }),
    soilProfile: params.soilProfile,
    importanceGroup: params.importanceGroup,
    ...(params.mode === undefined ? {} : { mode: params.mode }),
  }) as SpectrumParams
}

function snapshotContext(context: CalculationTraceContext): CalculationTraceContext {
  return Object.freeze(
    context.municipality
      ? {
          municipality: Object.freeze({
            code: context.municipality.code,
            municipio: context.municipality.municipio,
            departamento: context.municipality.departamento,
          }),
        }
      : {},
  )
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

function scenarioEvidenceKey(
  context: CalculationTraceContext,
  hazardId: string,
) {
  return {
    studyId: NSR10_STUDY_ID,
    studyVersion: NSR10_STUDY_VERSION,
    optionId: context.municipality?.code ?? null,
    hazardId,
  }
}

function normalizedPoint(point: {
  t: number
  sa: number
  branch: string
}): NormalizedSpectrumPoint {
  return {
    tSeconds: point.t,
    saG: point.sa,
    branchId: point.branch,
    formulaId: point.branch,
    citationIds: [],
  }
}

const metricMetadata = {
  aa: { label: "Aa", unit: "g", formulaId: null },
  av: { label: "Av", unit: "g", formulaId: null },
  ae: { label: "Ae", unit: "g", formulaId: null },
  ad: { label: "Ad", unit: "g", formulaId: null },
  fa: { label: "Fa", unit: "dimensionless", formulaId: "fa" },
  fv: { label: "Fv", unit: "dimensionless", formulaId: "fv" },
  i: { label: "I", unit: "dimensionless", formulaId: "importance" },
  s: { label: "S", unit: "dimensionless", formulaId: "s" },
  t0: { label: "T0", unit: "s", formulaId: "t0" },
  tc: { label: "TC", unit: "s", formulaId: "tc" },
  tl: { label: "TL", unit: "s", formulaId: "tl" },
  saMax: { label: "Sa max", unit: "g", formulaId: "sa-max" },
  pga: { label: "PGA", unit: "g", formulaId: "pga" },
} as const

function metricsFromCoefficients(
  coefficients: Record<string, unknown>,
  trace: CalculationTrace,
  municipalityCitationId: string | null,
): SpectrumMetric[] {
  const stepById = new Map(trace.steps.map((step) => [step.id, step]))
  return Object.entries(metricMetadata).flatMap(([id, metadata]) => {
    const value = coefficients[id]
    if (typeof value !== "number") return []
    const step = metadata.formulaId ? stepById.get(metadata.formulaId) : undefined
    if (metadata.formulaId && !step) {
      throw new Error(`NSR-10 metric formula is absent from trace: ${metadata.formulaId}`)
    }
    return [
      {
        id,
        label: metadata.label,
        value,
        unit: metadata.unit,
        formulaId: metadata.formulaId,
        dependencyIds: step ? [...step.dependencies] : [],
        citationIds:
          municipalityCitationId && ["aa", "av", "ae", "ad"].includes(id)
            ? [municipalityCitationId]
            : [],
      },
    ] satisfies SpectrumMetric[]
  })
}

function branchMetadata(branchIds: readonly string[]): SpectrumBranchMetadata[] {
  return branchIds.map((id) => ({ id, formulaId: id, citationIds: [] }))
}

function evidenceAvailability(
  municipalityCitationId: string | null,
  siteSpecific = false,
) {
  const unavailableClaims = [
    {
      id: "spectrum-clause-regions",
      reason:
        "The F0 manifest has no A.2/A.12 normative clause regions; formula lineage resolves through the versioned calculation trace only.",
    },
  ]
  if (!municipalityCitationId) {
    unavailableClaims.push({
      id: "municipality-hazard-row",
      reason: "No validated municipality context was supplied for the hazard inputs.",
    })
  }
  if (siteSpecific) {
    unavailableClaims.push({
      id: "site-specific-clause-region",
      reason: "The F0 manifest has no A.2.10 normative clause region.",
    })
  }
  return { status: "partial" as const, unavailableClaims }
}

function siteSpecificApplicability(message: string) {
  return {
    status: "site-specific-study-required" as const,
    reasonCode: "soil-profile-f",
    message,
    citationIds: [],
  }
}

/**
 * Wraps the current NSR-10 APIs. Parent inputs are snapshotted once and every
 * calculation, trace, and later ordinate delegates through that same snapshot.
 */
export function adaptNsr10Spectrum(
  params: SpectrumParams,
  context: CalculationTraceContext = {},
): NormalizedSpectrumResult {
  const paramsSnapshot = snapshotInputs(params)
  const contextSnapshot = snapshotContext(context)
  const parent = computeSpectrum(paramsSnapshot)
  const municipalityEvidence = validateNsr10MunicipalityContext(
    paramsSnapshot,
    contextSnapshot,
  )
  const municipalityCitationId = municipalityEvidence?.citationId ?? null
  const citations = municipalityCitationId ? [municipalityCitationId] : []
  const details = hazardLevelDetails[parent.hazardLevel]
  const inputs = normalizedInputs(paramsSnapshot, contextSnapshot)

  if (parent.status !== "ok") {
    const applicability = siteSpecificApplicability(parent.notice)
    const data = normalizedSpectrumResultDataSchema.parse({
      schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
      status: "site-specific-study-required",
      engine: {
        id: NSR10_ENGINE_ID,
        version: NSR10_ENGINE_VERSION,
        studyId: NSR10_STUDY_ID,
        studyVersion: NSR10_STUDY_VERSION,
        scenarioType: "nsr10-national",
      },
      study: { id: NSR10_STUDY_ID, version: NSR10_STUDY_VERSION },
      scenarioEvidenceKey: scenarioEvidenceKey(
        contextSnapshot,
        parent.hazardLevel,
      ),
      scenarioType: "nsr10-national",
      normalizedInputs: inputs,
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
          citationIds: [],
        },
      ],
      applicability,
      sourceIds: [NSR10_SOURCE_ID],
      citationIds: citations,
      evidenceAvailability: evidenceAvailability(municipalityCitationId, true),
      traceSchemaVersion: NSR10_TRACE_SCHEMA_VERSION,
      trace: null,
      capabilities: nsr10Capabilities,
    })
    assertNsr10LineageResolves(data)

    return {
      ...data,
      saAt(tSeconds) {
        const ordinate = saAt(tSeconds, paramsSnapshot)
        if (ordinate.status === "ok") {
          throw new Error("Soil F unexpectedly produced an NSR-10 ordinate")
        }
        return normalizedSpectrumOrdinateSchema.parse({
          status: "site-specific-study-required",
          applicability: siteSpecificApplicability(ordinate.notice),
        })
      },
    }
  }

  const rawTrace = computeCalculationTrace(paramsSnapshot, contextSnapshot)
  if ("status" in rawTrace) {
    throw new Error("Successful spectrum returned no calculation trace")
  }
  const trace = calculationTraceSchema.parse(rawTrace)
  const branches = branchMetadata(parent.branches)
  const metrics = metricsFromCoefficients(
    parent.coefficients,
    trace,
    municipalityCitationId,
  )
  const formulaIds = [
    ...new Set([
      ...branches.map(({ formulaId }) => formulaId),
      ...metrics.flatMap(({ formulaId }) => (formulaId ? [formulaId] : [])),
    ]),
  ]
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "ok",
    engine: {
      id: NSR10_ENGINE_ID,
      version: NSR10_ENGINE_VERSION,
      studyId: NSR10_STUDY_ID,
      studyVersion: NSR10_STUDY_VERSION,
      scenarioType: "nsr10-national",
    },
    study: { id: NSR10_STUDY_ID, version: NSR10_STUDY_VERSION },
    scenarioEvidenceKey: scenarioEvidenceKey(
      contextSnapshot,
      parent.hazardLevel,
    ),
    scenarioType: "nsr10-national",
    normalizedInputs: inputs,
    points: parent.points.map(normalizedPoint),
    metrics,
    formulaIds,
    branches,
    hazard: {
      id: parent.hazardLevel,
      label: details.label,
      returnPeriodYears: parent.returnPeriodYears,
      dampingRatio: parent.dampingRatio,
    },
    warnings: [],
    applicability: { status: "applicable" },
    sourceIds: [NSR10_SOURCE_ID],
    citationIds: citations,
    evidenceAvailability: evidenceAvailability(municipalityCitationId),
    traceSchemaVersion: NSR10_TRACE_SCHEMA_VERSION,
    trace: {
      schemaId: NSR10_TRACE_SCHEMA_ID,
      schemaVersion: NSR10_TRACE_SCHEMA_VERSION,
      data: trace,
    },
    capabilities: nsr10Capabilities,
  })
  assertNsr10LineageResolves(data)

  return {
    ...data,
    saAt(tSeconds) {
      const ordinate = saAt(tSeconds, paramsSnapshot)
      if (ordinate.status !== "ok") {
        return normalizedSpectrumOrdinateSchema.parse({
          status: "site-specific-study-required",
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
  const paramsSnapshot = snapshotInputs(params)
  const contextSnapshot = snapshotContext(context)
  return nsr10AdapterScenarioSchema.parse({
    type: "nsr10-national",
    studyId: NSR10_STUDY_ID,
    studyVersion: NSR10_STUDY_VERSION,
    inputs: normalizedInputs(paramsSnapshot, contextSnapshot),
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
