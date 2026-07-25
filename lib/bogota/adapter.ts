import { z } from "zod"

import {
  SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  supportedCapability,
  unsupportedCapability,
  spectrumCapabilitiesSchema,
} from "../spectra/capabilities"
import { spectrumEngineMetadataSchema } from "../spectra/engine"
import {
  SPECTRUM_CONTRACT_SCHEMA_VERSION,
  normalizedSpectrumOrdinateSchema,
  normalizedSpectrumResultDataSchema,
} from "../spectra/types"
import {
  BOGOTA_TRACE_SCHEMA_ID,
  BOGOTA_TRACE_SCHEMA_VERSION,
  assertBogotaLineageResolves,
  bogotaSourceIds,
} from "./evidence"
import {
  BogotaNumericalRepresentationError,
  bogotaBranchDefinitions,
  bogotaSiteSpecificReason,
  evaluateBogotaOrdinate,
  findBogotaHazard,
  findBogotaRow,
  preflightBogotaSpectrum,
} from "./engine"
import {
  BOGOTA_STUDY_ID,
  BOGOTA_STUDY_VERSION,
  bogotaCanonical,
  bogotaComputationInputSchema,
  bogotaScenarioSchema,
  type BogotaCanonicalRow,
  type BogotaComputationInput,
  type BogotaHazard,
  type BogotaHazardId,
  type BogotaNormalizedInputs,
  type BogotaScenario,
} from "./schema"
import "./study-relations"
import {
  bogotaBranchMetadata,
  bogotaMetrics,
  buildBogotaTrace,
  normalizeBogotaPoint,
} from "./trace"

import type { SpectrumEngine } from "../spectra/engine"
import type {
  NormalizedInputs,
  NormalizedSpectrumResult,
  SpectrumWarning,
} from "../spectra/types"

export const BOGOTA_ENGINE_ID = "bogota-spectrum" as const
export const BOGOTA_ENGINE_VERSION = "1" as const

export const bogotaCapabilities = spectrumCapabilitiesSchema.parse({
  comparison: supportedCapability(),
  contextualPdf: supportedCapability(),
  csvExport: supportedCapability(),
  etabsExport: supportedCapability(),
  jsonExport: supportedCapability(),
  svgPngExport: supportedCapability(),
  buildingBaseShear: supportedCapability(),
  fheWorkflow: supportedCapability(),
  bridgeRFactorWorkflow: unsupportedCapability(
    "Bogotá municipal building spectra do not define the CCP-14 bridge R-factor workflow.",
  ),
  traceabilityViewer: supportedCapability(),
})

const optionIds = new Set<string>(bogotaCanonical.options.map(({ id }) => id))
const hazardIds = new Set<string>(bogotaCanonical.hazards.map(({ id }) => id))

const engineIdentity = {
  id: BOGOTA_ENGINE_ID,
  version: BOGOTA_ENGINE_VERSION,
  studyId: BOGOTA_STUDY_ID,
  studyVersion: BOGOTA_STUDY_VERSION,
  scenarioType: "municipal-study" as const,
}

const warningDefinitions = [
  {
    severity: "warning" as const,
    code: "professional-zone-validation-required",
    message:
      "La selección manual no sustituye la clasificación del sitio: el profesional geotecnista/estructural debe verificar los mapas oficiales y el estudio del Título H.",
    citationIds: ["warning-professional-zone"],
  },
  {
    severity: "warning" as const,
    code: "zone-transition-band",
    message:
      "En una franja de transición de 100 m debe evaluarse el promedio dependiente del período de los espectros adyacentes, salvo reclasificación sustentada.",
    citationIds: ["warning-transition"],
  },
  {
    severity: "info" as const,
    code: "zone-reclassification-limits",
    message:
      "Una reclasificación debe corresponder a una zona adyacente o con máximo una zona intermedia y estar dentro de 500 m.",
    citationIds: ["warning-reclassification"],
  },
  {
    severity: "warning" as const,
    code: "site-specific-study-triggers",
    message:
      "Rellenos de espesor mayor que 3 m o períodos en base rígida mayores que 2.5 s exigen un estudio de respuesta sísmica particular.",
    citationIds: ["warning-site-specific"],
  },
  {
    severity: "info" as const,
    code: "soil-building-resonance",
    message:
      "Para períodos del edificio mayores que 1.0 s debe evaluarse la resonancia suelo–edificio dentro de ±10% del período del depósito.",
    citationIds: ["warning-resonance"],
  },
  {
    severity: "warning" as const,
    code: "liquefaction-assessment",
    message:
      "Debe evaluarse licuación en los ambientes y suelos susceptibles indicados por la norma distrital.",
    citationIds: ["warning-liquefaction"],
  },
  {
    severity: "warning" as const,
    code: "site-specific-minimum-coefficients",
    message:
      "Los Fa/Fv particulares no pueden ser inferiores al mínimo NSR-10 ni al 80% del valor municipal; gobierna el mayor.",
    citationIds: ["warning-minimums"],
  },
] satisfies SpectrumWarning[]

const hazardScopeClaim = {
  design: "scope-design",
  "limited-safety": "scope-limited",
  "damage-threshold": "scope-damage",
} as const

function successWarnings(hazardId: BogotaHazardId): SpectrumWarning[] {
  return [
    ...warningDefinitions.map((warning) => ({
      ...warning,
      citationIds: [...warning.citationIds],
    })),
    {
      severity: "info",
      code: "municipal-building-scope",
      message:
        "Este espectro municipal tiene alcance reglamentario para edificaciones dentro del caso de amenaza seleccionado.",
      citationIds: ["scope-mandatory", hazardScopeClaim[hazardId]],
    },
  ]
}

function invalidNormalizedInputs(input: unknown): NormalizedInputs {
  const record =
    input !== null && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {}
  const stringOrNull = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null
  const finiteOrNull = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null
  return {
    zoneId: stringOrNull(record.zoneId),
    hazardId: stringOrNull(record.hazardId),
    importanceFactor: finiteOrNull(record.importanceFactor),
    fillThicknessMeters: finiteOrNull(record.fillThicknessMeters),
    rigidBasePeriodSeconds: finiteOrNull(record.rigidBasePeriodSeconds),
  }
}

function resolvedSelection(inputs: NormalizedInputs) {
  const zoneId =
    typeof inputs.zoneId === "string" && optionIds.has(inputs.zoneId)
      ? inputs.zoneId
      : null
  const hazardId =
    typeof inputs.hazardId === "string" && hazardIds.has(inputs.hazardId)
      ? (inputs.hazardId as BogotaHazardId)
      : null
  return { zoneId, hazardId }
}

function scenarioEvidenceKey(zoneId: string | null, hazardId: string | null) {
  return {
    studyId: BOGOTA_STUDY_ID,
    studyVersion: BOGOTA_STUDY_VERSION,
    optionId: zoneId,
    hazardId,
  }
}

function normalizedHazard(hazard: BogotaHazard) {
  return {
    id: hazard.id,
    label: hazard.label,
    returnPeriodYears: hazard.returnPeriodYears,
    dampingRatio: hazard.dampingRatio,
  }
}

function invalidApplicability(message: string) {
  return {
    status: "invalid-input" as const,
    reasonCode: "bogota-invalid-input",
    message,
    citationIds: [],
  }
}

function numericalUnsupportedApplicability(message: string) {
  return {
    status: "unsupported" as const,
    reasonCode: "bogota-numerical-representation-unsupported",
    message,
    citationIds: [],
  }
}

function invalidResult(input: unknown, message: string): NormalizedSpectrumResult {
  const inputs = invalidNormalizedInputs(input)
  const selection = resolvedSelection(inputs)
  const hazard = selection.hazardId
    ? findBogotaHazard(selection.hazardId)
    : null
  const applicability = invalidApplicability(message)
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "invalid-input",
    engine: engineIdentity,
    study: { id: BOGOTA_STUDY_ID, version: BOGOTA_STUDY_VERSION },
    scenarioEvidenceKey: scenarioEvidenceKey(
      selection.zoneId,
      selection.hazardId,
    ),
    scenarioType: "municipal-study",
    normalizedInputs: inputs,
    hazard: hazard ? normalizedHazard(hazard) : null,
    warnings: [],
    applicability,
    sourceIds: [...bogotaSourceIds],
    citationIds: [],
    evidenceAvailability: {
      status: "unavailable",
      reason: "La entrada no resuelve una fila canónica Bogotá zona×amenaza.",
    },
    traceSchemaVersion: BOGOTA_TRACE_SCHEMA_VERSION,
    trace: null,
    capabilities: bogotaCapabilities,
  })
  assertBogotaLineageResolves(data)
  return {
    ...data,
    saAt() {
      return normalizedSpectrumOrdinateSchema.parse({
        status: "invalid-input",
        applicability,
      })
    },
  }
}

function numericalUnsupportedResult(
  inputs: BogotaNormalizedInputs,
  hazard: BogotaHazard,
  message: string,
): NormalizedSpectrumResult {
  const applicability = numericalUnsupportedApplicability(message)
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "unsupported",
    engine: engineIdentity,
    study: { id: BOGOTA_STUDY_ID, version: BOGOTA_STUDY_VERSION },
    scenarioEvidenceKey: scenarioEvidenceKey(inputs.zoneId, inputs.hazardId),
    scenarioType: "municipal-study",
    normalizedInputs: inputs,
    hazard: normalizedHazard(hazard),
    warnings: [],
    applicability,
    sourceIds: [...bogotaSourceIds],
    citationIds: [],
    evidenceAvailability: {
      status: "unavailable",
      reason:
        "La salida numérica solicitada no puede representarse de forma finita.",
    },
    traceSchemaVersion: BOGOTA_TRACE_SCHEMA_VERSION,
    trace: null,
    capabilities: bogotaCapabilities,
  })
  assertBogotaLineageResolves(data)
  return {
    ...data,
    saAt() {
      return normalizedSpectrumOrdinateSchema.parse({
        status: "unsupported",
        applicability,
      })
    },
  }
}

function siteSpecificApplicability(reason: ReturnType<typeof bogotaSiteSpecificReason>) {
  const message =
    reason === "fill-thickness-over-3m"
      ? "El espesor de relleno informado supera 3 m; se requiere estudio de respuesta sísmica particular."
      : "El período fundamental en base rígida informado supera 2.5 s; se requiere estudio de respuesta sísmica particular."
  return {
    status: "site-specific-study-required" as const,
    reasonCode: reason ?? "bogota-site-specific-study-required",
    message,
    citationIds: ["warning-site-specific"],
  }
}

function siteSpecificResult(
  inputs: BogotaNormalizedInputs,
  hazard: BogotaHazard,
  reason: Exclude<ReturnType<typeof bogotaSiteSpecificReason>, null>,
): NormalizedSpectrumResult {
  const applicability = siteSpecificApplicability(reason)
  const warning = {
    severity: "warning" as const,
    code: "site-specific-study-required",
    message: applicability.message,
    citationIds: [...applicability.citationIds],
  }
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "site-specific-study-required",
    engine: engineIdentity,
    study: { id: BOGOTA_STUDY_ID, version: BOGOTA_STUDY_VERSION },
    scenarioEvidenceKey: scenarioEvidenceKey(inputs.zoneId, inputs.hazardId),
    scenarioType: "municipal-study",
    normalizedInputs: inputs,
    hazard: normalizedHazard(hazard),
    warnings: [warning],
    applicability,
    sourceIds: [...bogotaSourceIds],
    citationIds: ["warning-site-specific"],
    evidenceAvailability: { status: "available" },
    traceSchemaVersion: BOGOTA_TRACE_SCHEMA_VERSION,
    trace: null,
    capabilities: bogotaCapabilities,
  })
  assertBogotaLineageResolves(data)
  return {
    ...data,
    saAt() {
      return normalizedSpectrumOrdinateSchema.parse({
        status: "site-specific-study-required",
        applicability,
      })
    },
  }
}

function invalidPeriodOrdinate(tSeconds: number) {
  const applicability = invalidApplicability(
    `El período debe ser finito y no negativo; se recibió ${String(tSeconds)}.`,
  )
  return normalizedSpectrumOrdinateSchema.parse({
    status: "invalid-input",
    applicability,
  })
}

function numericalUnsupportedOrdinate() {
  const applicability = numericalUnsupportedApplicability(
    "La ordenada solicitada no puede representarse como un número finito.",
  )
  return normalizedSpectrumOrdinateSchema.parse({
    status: "unsupported",
    applicability,
  })
}

function successResult(
  inputs: BogotaNormalizedInputs,
  row: BogotaCanonicalRow,
  hazard: BogotaHazard,
): NormalizedSpectrumResult {
  const preflight = preflightBogotaSpectrum(
    row,
    hazard,
    inputs.importanceFactor,
  )
  if (preflight.status === "unsupported") {
    return numericalUnsupportedResult(inputs, hazard, preflight.message)
  }
  const sampledPoints = preflight.points
  const trace = buildBogotaTrace(inputs, row, hazard)
  const definitions = bogotaBranchDefinitions[hazard.id]
  const resultWarnings = successWarnings(hazard.id)
  const resultMetrics = bogotaMetrics(row, trace)
  if (resultMetrics.some(({ value }) => !Number.isFinite(value))) {
    return numericalUnsupportedResult(
      inputs,
      hazard,
      "Las métricas solicitadas no pueden representarse como números finitos.",
    )
  }
  const points = sampledPoints.map((point) => normalizeBogotaPoint(point, trace))
  const citations = [
    ...new Set([
      ...trace.steps.flatMap((step) => step.citationIds),
      ...trace.branches.flatMap((branch) => branch.citationIds),
      ...resultWarnings.flatMap((warning) => warning.citationIds),
      "technical-recurrence",
      "technical-building-only",
    ]),
  ]
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "ok",
    engine: engineIdentity,
    study: { id: BOGOTA_STUDY_ID, version: BOGOTA_STUDY_VERSION },
    scenarioEvidenceKey: scenarioEvidenceKey(inputs.zoneId, inputs.hazardId),
    scenarioType: "municipal-study",
    normalizedInputs: inputs,
    points,
    metrics: resultMetrics,
    formulaIds: trace.steps.map(({ id }) => id),
    branches: bogotaBranchMetadata(definitions),
    hazard: normalizedHazard(hazard),
    warnings: resultWarnings,
    applicability: { status: "applicable" },
    sourceIds: [...bogotaSourceIds],
    citationIds: citations,
    evidenceAvailability: { status: "available" },
    traceSchemaVersion: BOGOTA_TRACE_SCHEMA_VERSION,
    trace: {
      schemaId: BOGOTA_TRACE_SCHEMA_ID,
      schemaVersion: BOGOTA_TRACE_SCHEMA_VERSION,
      data: trace,
    },
    capabilities: bogotaCapabilities,
  })
  assertBogotaLineageResolves(data)
  return {
    ...data,
    saAt(tSeconds) {
      if (!Number.isFinite(tSeconds) || tSeconds < 0) {
        return invalidPeriodOrdinate(tSeconds)
      }
      try {
        return normalizedSpectrumOrdinateSchema.parse({
          status: "ok",
          point: normalizeBogotaPoint(
            evaluateBogotaOrdinate(
              tSeconds,
              row,
              hazard,
              inputs.importanceFactor,
            ),
            trace,
          ),
        })
      } catch (error) {
        if (error instanceof BogotaNumericalRepresentationError) {
          return numericalUnsupportedOrdinate()
        }
        throw error
      }
    },
  }
}

export function adaptBogotaSpectrum(input: unknown): NormalizedSpectrumResult {
  const parsed = bogotaComputationInputSchema.safeParse(input)
  if (!parsed.success) {
    const message = z.prettifyError(parsed.error)
    return invalidResult(input, message)
  }
  const inputs = Object.freeze({ ...parsed.data })
  const row = findBogotaRow(inputs.zoneId, inputs.hazardId)
  const hazard = findBogotaHazard(inputs.hazardId)
  if (!row || !hazard) {
    return invalidResult(input, "La combinación zona×amenaza no existe en R2.")
  }
  const siteSpecific = bogotaSiteSpecificReason(inputs)
  if (siteSpecific) return siteSpecificResult(inputs, hazard, siteSpecific)
  try {
    return successResult(inputs, row, hazard)
  } catch (error) {
    if (error instanceof BogotaNumericalRepresentationError) {
      return numericalUnsupportedResult(
        inputs,
        hazard,
        "El espectro solicitado no puede representarse como números finitos.",
      )
    }
    throw error
  }
}

export function createBogotaScenario(
  input: BogotaComputationInput,
): BogotaScenario {
  const inputs = bogotaComputationInputSchema.parse(input)
  return bogotaScenarioSchema.parse({
    type: "municipal-study",
    studyId: BOGOTA_STUDY_ID,
    studyVersion: BOGOTA_STUDY_VERSION,
    inputs,
  })
}

const bogotaEngineMetadata = spectrumEngineMetadataSchema.parse({
  ...engineIdentity,
  capabilitySchemaVersion: SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  capabilities: bogotaCapabilities,
})

export const bogotaSpectrumEngine: SpectrumEngine<BogotaScenario> = {
  metadata: bogotaEngineMetadata,
  accepts(scenario): scenario is BogotaScenario {
    return bogotaScenarioSchema.safeParse(scenario).success
  },
  compute(scenario) {
    const parsed = bogotaScenarioSchema.safeParse(scenario)
    if (!parsed.success) {
      const rawInputs =
        scenario && typeof scenario === "object" && "inputs" in scenario
          ? scenario.inputs
          : scenario
      return invalidResult(rawInputs, z.prettifyError(parsed.error))
    }
    return adaptBogotaSpectrum(parsed.data.inputs)
  },
}

export type { BogotaScenario }
