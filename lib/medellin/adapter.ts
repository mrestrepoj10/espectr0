import { z } from "zod"

import {
  SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  supportedCapability,
  unsupportedCapability,
  spectrumCapabilitiesSchema,
} from "../spectra/capabilities"
import { spectrumEngineMetadataSchema, type SpectrumEngine } from "../spectra/engine"
import {
  SPECTRUM_CONTRACT_SCHEMA_VERSION,
  normalizedSpectrumOrdinateSchema,
  normalizedSpectrumResultDataSchema,
  type NormalizedInputs,
  type NormalizedSpectrumPoint,
  type NormalizedSpectrumResult,
} from "../spectra/types"
import {
  assertMedellinLineageResolves,
  medellinCellCitation,
  medellinFormulaCitation,
  medellinSourceIds,
} from "./evidence"
import {
  MEDELLIN_MAX_PERIOD_SECONDS,
  evaluateMedellinOrdinate,
  medellinFormulaByBranch,
  medellinSmax,
  type MedellinBranchId,
} from "./engine"
import {
  MEDELLIN_STUDY_ID,
  MEDELLIN_STUDY_VERSION,
  findMedellinHazard,
  findMedellinRow,
  medellinComputationInputSchema,
  medellinHazardIdSchema,
  medellinScenarioSchema,
  medellinZoneIdSchema,
  type MedellinComputationInput,
  type MedellinScenario,
} from "./schema"
import "./study-relations"

export const MEDELLIN_ENGINE_ID = "medellin-spectrum" as const
export const MEDELLIN_ENGINE_VERSION = "1" as const
export const MEDELLIN_TRACE_SCHEMA_ID = "medellin-calculation-trace" as const
export const MEDELLIN_TRACE_SCHEMA_VERSION = 1 as const

export const medellinCapabilities = spectrumCapabilitiesSchema.parse({
  comparison: unsupportedCapability(
    "El comparador todavía no consume escenarios municipales normalizados de Medellín.",
  ),
  contextualPdf: unsupportedCapability(
    "El renderizador PDF contextual todavía no está instalado para Medellín.",
  ),
  csvExport: supportedCapability(),
  etabsExport: supportedCapability(),
  jsonExport: supportedCapability(),
  svgPngExport: supportedCapability(),
  buildingBaseShear: unsupportedCapability(
    "El cortante basal sigue siendo un flujo exclusivo de NSR-10 nacional.",
  ),
  fheWorkflow: unsupportedCapability(
    "El flujo FHE sigue siendo exclusivo de NSR-10 nacional.",
  ),
  bridgeRFactorWorkflow: unsupportedCapability(
    "El estudio municipal no define el flujo de puentes de CCP-14.",
  ),
  traceabilityViewer: unsupportedCapability(
    "El resolvedor visual de evidencia todavía no está instalado para Medellín.",
  ),
})

const engineIdentity = {
  id: MEDELLIN_ENGINE_ID,
  version: MEDELLIN_ENGINE_VERSION,
  studyId: MEDELLIN_STUDY_ID,
  studyVersion: MEDELLIN_STUDY_VERSION,
  scenarioType: "municipal-study" as const,
}

// The shared v2 contract requires a positive integer. The historical table
// states no return periods; 475 is carried only as explicit NSR-10 context.
const CONTRACT_CONTEXT_RETURN_PERIOD_YEARS = 475
const directFields = [
  "ground_peak",
  "short_amplification",
  "plateau_per_importance",
  "plateau_start",
  "decay_start",
  "decay_exponent",
] as const

function hazardMetadata(hazardId: string) {
  const hazard = findMedellinHazard(hazardId)
  return hazard
    ? {
        id: hazard.id,
        label: `${hazard.label} · período municipal no declarado (475 años solo como contexto contractual NSR-10)`,
        returnPeriodYears: CONTRACT_CONTEXT_RETURN_PERIOD_YEARS,
        dampingRatio: hazard.dampingRatio,
      }
    : null
}

function invalidInputs(input: unknown): NormalizedInputs {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  const zone = medellinZoneIdSchema.safeParse(record.zoneId)
  const hazard = medellinHazardIdSchema.safeParse(record.hazardId)
  return {
    zoneId: zone.success ? zone.data : null,
    hazardId: hazard.success ? hazard.data : null,
    importanceFactor:
      typeof record.importanceFactor === "number" && Number.isFinite(record.importanceFactor)
        ? record.importanceFactor
        : null,
  }
}

function invalidResult(input: unknown, message: string): NormalizedSpectrumResult {
  const normalizedInputs = invalidInputs(input)
  const hazardId =
    typeof normalizedInputs.hazardId === "string" ? normalizedInputs.hazardId : null
  const applicability = {
    status: "invalid-input" as const,
    reasonCode: "medellin-invalid-input",
    message,
    citationIds: [] as string[],
  }
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "invalid-input",
    engine: engineIdentity,
    study: { id: MEDELLIN_STUDY_ID, version: MEDELLIN_STUDY_VERSION },
    scenarioEvidenceKey: {
      studyId: MEDELLIN_STUDY_ID,
      studyVersion: MEDELLIN_STUDY_VERSION,
      optionId:
        typeof normalizedInputs.zoneId === "string" ? normalizedInputs.zoneId : null,
      hazardId,
    },
    scenarioType: "municipal-study",
    normalizedInputs,
    hazard: hazardId ? hazardMetadata(hazardId) : null,
    warnings: [],
    applicability,
    sourceIds: [...medellinSourceIds],
    citationIds: [],
    evidenceAvailability: {
      status: "unavailable",
      reason: "La entrada no resuelve una fila manual de la tabla técnica de Medellín.",
    },
    traceSchemaVersion: MEDELLIN_TRACE_SCHEMA_VERSION,
    trace: null,
    capabilities: medellinCapabilities,
  })
  assertMedellinLineageResolves(data)
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

function normalizedPoint(
  input: MedellinComputationInput,
  tSeconds: number,
): NormalizedSpectrumPoint | ReturnType<typeof normalizedSpectrumOrdinateSchema.parse> {
  const ordinate = evaluateMedellinOrdinate({ ...input, tSeconds })
  if (ordinate.status === "invalid-input") {
    return normalizedSpectrumOrdinateSchema.parse({
      status: "invalid-input",
      applicability: {
        status: "invalid-input",
        reasonCode: "medellin-invalid-period",
        message: ordinate.message,
        citationIds: [],
      },
    })
  }
  if (ordinate.status === "unsupported") {
    const below = ordinate.interval === "below-t0"
    return normalizedSpectrumOrdinateSchema.parse({
      status: "unsupported",
      applicability: {
        status: "unsupported",
        reasonCode: below
          ? "medellin-rising-branch-equation-unavailable"
          : "medellin-period-domain-exceeded",
        message: ordinate.message,
        citationIds: below
          ? [
              medellinCellCitation(
                input.hazardId,
                input.zoneId,
                "plateau_start",
              ),
              "figure-spectrum-branches",
            ]
          : ["warning-period-domain"],
      },
    })
  }
  return {
    ...ordinate.point,
    citationIds: [
      ordinate.point.branchId === "medellin-plateau"
        ? medellinFormulaCitation.plateau
        : medellinFormulaCitation.decay,
    ],
  }
}

function successfulPoint(
  input: MedellinComputationInput,
  tSeconds: number,
): NormalizedSpectrumPoint {
  const point = normalizedPoint(input, tSeconds)
  if ("status" in point) throw new Error(`Unexpected unsupported sampled period ${tSeconds}`)
  return point
}

function successResult(input: MedellinComputationInput): NormalizedSpectrumResult {
  const row = findMedellinRow(input.zoneId, input.hazardId)
  const sourceHazard = findMedellinHazard(input.hazardId)
  if (!row || !sourceHazard) {
    return invalidResult(input, "La combinación manual de zona y amenaza no existe.")
  }
  const fields = row.fields
  const t0 = fields.plateau_start
  const tc = fields.decay_start
  const smax = medellinSmax(input)
  const fieldStepId = (field: (typeof directFields)[number]) =>
    `medellin-${input.hazardId}-${input.zoneId}-${field}`
  const fieldUnit = (field: (typeof directFields)[number]) =>
    field === "ground_peak" || field === "plateau_per_importance"
      ? ("g" as const)
      : field === "plateau_start" || field === "decay_start"
        ? ("s" as const)
        : ("dimensionless" as const)
  const directSteps = directFields.map((field) => ({
    id: fieldStepId(field),
    classification: "direct-source",
    label: field,
    value: fields[field],
    unit: fieldUnit(field),
    dependencies: [],
    citationIds: [medellinCellCitation(input.hazardId, input.zoneId, field)],
  }))
  const inputStep = {
    id: "medellin-input-importance",
    classification: "user-input",
    label: "I",
    value: input.importanceFactor,
    unit: "dimensionless",
    dependencies: [],
    citationIds: [],
  }
  const smaxStep = {
    id: "medellin-formula-smax",
    classification: "derived",
    label: "Smax",
    value: smax,
    unit: "g",
    dependencies: [
      fieldStepId("ground_peak"),
      fieldStepId("short_amplification"),
      inputStep.id,
    ],
    citationIds: [medellinFormulaCitation.smax],
    expression: "Smax = Fa × aSmax × I",
    substitution: `Smax = ${fields.short_amplification} × ${fields.ground_peak} × ${input.importanceFactor} = ${smax} g`,
  }
  const plateauStep = {
    id: medellinFormulaByBranch["medellin-plateau"],
    classification: "derived",
    label: "Sa meseta",
    value: smax,
    unit: "g",
    dependencies: [smaxStep.id],
    citationIds: [medellinFormulaCitation.plateau],
    expression: "Sa = Smax para T0 ≤ T ≤ Tc",
    substitution: `Sa = ${smax} g`,
  }
  const tailAtFour = smax * (tc / MEDELLIN_MAX_PERIOD_SECONDS) ** fields.decay_exponent
  const decayStep = {
    id: medellinFormulaByBranch["medellin-power-decay"],
    classification: "derived",
    label: "Sa rama decreciente",
    value: tailAtFour,
    unit: "g",
    dependencies: [smaxStep.id, fieldStepId("decay_start"), fieldStepId("decay_exponent")],
    citationIds: [medellinFormulaCitation.decay],
    expression: "Sa = Smax × (Tc / T)^α para T > Tc",
    substitution: `Sa(4 s) = ${smax} × (${tc} / 4)^${fields.decay_exponent} = ${tailAtFour} g`,
  }
  const branches = [
    ["medellin-plateau", medellinFormulaCitation.plateau],
    ["medellin-power-decay", medellinFormulaCitation.decay],
  ].map(([id, citationId]) => ({
    id: id as MedellinBranchId,
    formulaId: medellinFormulaByBranch[id as MedellinBranchId],
    citationIds: [citationId],
  }))
  const regularPeriods = Array.from(
    { length: Math.floor((MEDELLIN_MAX_PERIOD_SECONDS - t0) / 0.01) + 1 },
    (_, index) => Number((t0 + index * 0.01).toFixed(8)),
  )
  const periods = [
    ...new Set([...regularPeriods, t0, tc, MEDELLIN_MAX_PERIOD_SECONDS]),
  ].sort((left, right) => left - right)
  const points = periods.map((period) => successfulPoint(input, period))
  const traceSteps = [...directSteps, inputStep, smaxStep, plateauStep, decayStep]
  const warnings = [
    {
      severity: "warning" as const,
      code: "professional-zone-validation-required",
      message:
        "La zona homogénea se selecciona manualmente. El profesional responsable debe validarla con la microzonificación oficial y las condiciones reales del predio.",
      citationIds: ["table-historical-coefficients"],
    },
    {
      severity: "info" as const,
      code: "source-equation-controls-rounded-display",
      message:
        "La ordenada se calcula con la ecuación publicada Smax = Fa × aSmax × I. El valor Samax/I de la tabla se conserva como dato directo y puede diferir levemente por la precisión mostrada.",
      citationIds: [
        medellinFormulaCitation.smax,
        medellinCellCitation(
          input.hazardId,
          input.zoneId,
          "plateau_per_importance",
        ),
      ],
    },
    {
      severity: "warning" as const,
      code: "rising-branch-equation-unavailable",
      message: `La curva normalizada inicia en T0=${t0} s. Para T < T0 se devuelve un resultado no soportado porque la figura no publica la ecuación ascendente.`,
      citationIds: [
        medellinCellCitation(input.hazardId, input.zoneId, "plateau_start"),
        "figure-spectrum-branches",
      ],
    },
    {
      severity: "info" as const,
      code: "historical-return-period-unknown",
      message:
        "La fuente oficial fijada no declara el período de retorno de esta familia histórica. El valor de 475 años satisface únicamente el campo numérico obligatorio del contrato y no se atribuye al estudio municipal.",
      citationIds: ["table-historical-coefficients"],
    },
    {
      severity: "info" as const,
      code: "source-damping-preserved",
      message: `Se conserva el amortiguamiento publicado de ${sourceHazard.dampingRatio * 100} % para esta familia.`,
      citationIds: ["warning-damping"],
    },
    {
      severity: "warning" as const,
      code: "source-period-domain",
      message: `El dominio publicado termina en ${MEDELLIN_MAX_PERIOD_SECONDS} s; períodos mayores se devuelven como no soportados.`,
      citationIds: ["warning-period-domain"],
    },
  ]
  const citationIds = [
    ...new Set([
      ...traceSteps.flatMap((step) => step.citationIds),
      ...warnings.flatMap((warning) => warning.citationIds),
    ]),
  ]
  const metrics = [
    ...directFields.map((field) => ({
      id: field,
      label: field,
      value: fields[field],
      unit: fieldUnit(field),
      formulaId: null,
      dependencyIds: [],
      citationIds: [medellinCellCitation(input.hazardId, input.zoneId, field)],
    })),
    {
      id: "importanceFactor",
      label: "I",
      value: input.importanceFactor,
      unit: "dimensionless" as const,
      formulaId: null,
      dependencyIds: [],
      citationIds: [],
    },
    {
      id: "smax",
      label: "Smax",
      value: smax,
      unit: "g" as const,
      formulaId: smaxStep.id,
      dependencyIds: smaxStep.dependencies,
      citationIds: [medellinFormulaCitation.smax],
    },
  ]
  const trace = {
    schemaVersion: MEDELLIN_TRACE_SCHEMA_VERSION,
    context: {
      ...input,
      dampingRatio: sourceHazard.dampingRatio,
      municipalReturnPeriodYears: null,
      supportedFromSeconds: t0,
      supportedThroughSeconds: MEDELLIN_MAX_PERIOD_SECONDS,
    },
    steps: traceSteps,
    branches: branches.map(({ id, formulaId }) => ({ id, formulaId })),
  }
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "ok",
    engine: engineIdentity,
    study: { id: MEDELLIN_STUDY_ID, version: MEDELLIN_STUDY_VERSION },
    scenarioEvidenceKey: {
      studyId: MEDELLIN_STUDY_ID,
      studyVersion: MEDELLIN_STUDY_VERSION,
      optionId: input.zoneId,
      hazardId: input.hazardId,
    },
    scenarioType: "municipal-study",
    normalizedInputs: input,
    points,
    metrics,
    // Contract v2 requires every trace dependency referenced by a metric to
    // appear in this declared ID set, including direct and user-input steps.
    formulaIds: traceSteps.map(({ id }) => id),
    branches,
    hazard: hazardMetadata(input.hazardId),
    warnings,
    applicability: { status: "applicable" },
    sourceIds: [...medellinSourceIds],
    citationIds,
    evidenceAvailability: {
      status: "partial",
      unavailableClaims: [
        {
          id: "rising-branch-below-t0",
          reason: "La fuente oficial no publica la ecuación ascendente para T < T0.",
        },
        {
          id: "municipal-return-period",
          reason: "La fuente oficial no declara período de retorno o probabilidad para las dos familias históricas.",
        },
      ],
    },
    traceSchemaVersion: MEDELLIN_TRACE_SCHEMA_VERSION,
    trace: {
      schemaId: MEDELLIN_TRACE_SCHEMA_ID,
      schemaVersion: MEDELLIN_TRACE_SCHEMA_VERSION,
      data: trace,
    },
    capabilities: medellinCapabilities,
  })
  assertMedellinLineageResolves(data)
  return {
    ...data,
    saAt(tSeconds) {
      const point = normalizedPoint(input, tSeconds)
      return "status" in point
        ? point
        : normalizedSpectrumOrdinateSchema.parse({ status: "ok", point })
    },
  }
}

export function adaptMedellinSpectrum(input: unknown): NormalizedSpectrumResult {
  const parsed = medellinComputationInputSchema.safeParse(input)
  return parsed.success
    ? successResult(parsed.data)
    : invalidResult(input, z.prettifyError(parsed.error))
}

export function createMedellinScenario(
  input: MedellinComputationInput,
): MedellinScenario {
  return medellinScenarioSchema.parse({
    type: "municipal-study",
    studyId: MEDELLIN_STUDY_ID,
    studyVersion: MEDELLIN_STUDY_VERSION,
    inputs: medellinComputationInputSchema.parse(input),
  })
}

const metadata = spectrumEngineMetadataSchema.parse({
  ...engineIdentity,
  capabilitySchemaVersion: SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  capabilities: medellinCapabilities,
})

export const medellinSpectrumEngine: SpectrumEngine<MedellinScenario> = {
  metadata,
  accepts(scenario): scenario is MedellinScenario {
    return medellinScenarioSchema.safeParse(scenario).success
  },
  compute(scenario) {
    const parsed = medellinScenarioSchema.safeParse(scenario)
    return parsed.success
      ? adaptMedellinSpectrum(parsed.data.inputs)
      : invalidResult(scenario, z.prettifyError(parsed.error))
  },
}
