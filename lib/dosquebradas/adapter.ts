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
  assertDosquebradasLineageResolves,
  dosquebradasCellCitation,
  dosquebradasFormulaCitation,
  dosquebradasSourceIds,
} from "./evidence"
import {
  deriveDosquebradasAv,
  dosquebradasFormulaByBranch,
  evaluateDosquebradasOrdinate,
  type DosquebradasBranchId,
} from "./engine"
import {
  DOSQUEBRADAS_STUDY_ID,
  DOSQUEBRADAS_STUDY_VERSION,
  dosquebradasComputationInputSchema,
  dosquebradasScenarioSchema,
  findDosquebradasRow,
  type DosquebradasComputationInput,
  type DosquebradasScenario,
} from "./schema"
import "./study-relations"

export const DOSQUEBRADAS_ENGINE_ID = "dosquebradas-spectrum" as const
export const DOSQUEBRADAS_ENGINE_VERSION = "1" as const
export const DOSQUEBRADAS_TRACE_SCHEMA_ID = "dosquebradas-calculation-trace" as const
export const DOSQUEBRADAS_TRACE_SCHEMA_VERSION = 1 as const

export const dosquebradasCapabilities = spectrumCapabilitiesSchema.parse({
  comparison: unsupportedCapability(
    "El comparador todavía no consume escenarios municipales normalizados de Dosquebradas.",
  ),
  contextualPdf: unsupportedCapability(
    "El renderizador PDF contextual todavía no está instalado para Dosquebradas.",
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
    "El resolvedor visual de evidencia todavía no está instalado para Dosquebradas.",
  ),
})

const engineIdentity = {
  id: DOSQUEBRADAS_ENGINE_ID,
  version: DOSQUEBRADAS_ENGINE_VERSION,
  studyId: DOSQUEBRADAS_STUDY_ID,
  studyVersion: DOSQUEBRADAS_STUDY_VERSION,
  scenarioType: "municipal-study" as const,
}

const validZoneIds = new Set(["zona-1", "zona-2", "zona-3", "zona-4", "zona-5"])

const unknownMunicipalReturnPeriodWarning = {
  severity: "info" as const,
  code: "municipal-return-period-unknown",
  message:
    "La Tabla 27 no declara período de retorno o probabilidad. El resultado conserva este metadato como desconocido y no lo sustituye con un valor nacional o de referencia.",
  citationIds: ["table-27"],
}

function invalidInputs(input: unknown): NormalizedInputs {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  return {
    zoneId:
      typeof record.zoneId === "string" && validZoneIds.has(record.zoneId)
        ? record.zoneId
        : null,
    hazardId: record.hazardId === "design" ? "design" : null,
    importanceFactor:
      typeof record.importanceFactor === "number" &&
      Number.isFinite(record.importanceFactor)
        ? record.importanceFactor
        : null,
  }
}

function evidenceKey(inputs: NormalizedInputs) {
  return {
    studyId: DOSQUEBRADAS_STUDY_ID,
    studyVersion: DOSQUEBRADAS_STUDY_VERSION,
    optionId: typeof inputs.zoneId === "string" ? inputs.zoneId : null,
    hazardId: inputs.hazardId === "design" ? "design" : null,
  }
}

function invalidResult(input: unknown, message: string): NormalizedSpectrumResult {
  const normalizedInputs = invalidInputs(input)
  const key = evidenceKey(normalizedInputs)
  const applicability = {
    status: "invalid-input" as const,
    reasonCode: "dosquebradas-invalid-input",
    message,
    citationIds: [],
  }
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "invalid-input",
    engine: engineIdentity,
    study: { id: DOSQUEBRADAS_STUDY_ID, version: DOSQUEBRADAS_STUDY_VERSION },
    scenarioEvidenceKey: key,
    scenarioType: "municipal-study",
    normalizedInputs,
    hazard:
      key.hazardId === "design"
        ? {
            id: "design",
            label: "Diseño · período de retorno municipal no declarado",
            returnPeriodYears: null,
            dampingRatio: 0.05,
          }
        : null,
    warnings: key.hazardId === "design" ? [unknownMunicipalReturnPeriodWarning] : [],
    applicability,
    sourceIds: [...dosquebradasSourceIds],
    citationIds: key.hazardId === "design" ? ["table-27"] : [],
    evidenceAvailability: {
      status: "unavailable",
      reason: "La entrada no resuelve una fila manual de la Tabla 27.",
    },
    traceSchemaVersion: DOSQUEBRADAS_TRACE_SCHEMA_VERSION,
    trace: null,
    capabilities: dosquebradasCapabilities,
  })
  assertDosquebradasLineageResolves(data)
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
  input: DosquebradasComputationInput,
  tSeconds: number,
): NormalizedSpectrumPoint | ReturnType<typeof normalizedSpectrumOrdinateSchema.parse> {
  const ordinate = evaluateDosquebradasOrdinate({
    zoneId: input.zoneId,
    tSeconds,
    importanceFactor: input.importanceFactor,
  })
  if (ordinate.status === "invalid-input") {
    return normalizedSpectrumOrdinateSchema.parse({
      status: "invalid-input",
      applicability: {
        status: "invalid-input",
        reasonCode: "dosquebradas-invalid-period",
        message: ordinate.message,
        citationIds: [],
      },
    })
  }
  if (ordinate.status === "unsupported") {
    const row = findDosquebradasRow(input.zoneId)
    const belowTo = row ? tSeconds < row.fields.to : true
    return normalizedSpectrumOrdinateSchema.parse({
      status: "unsupported",
      applicability: {
        status: "unsupported",
        reasonCode: belowTo
          ? "dosquebradas-entrance-branch-unavailable"
          : "dosquebradas-long-period-branch-unavailable",
        message: ordinate.message,
        citationIds: [
          row
            ? dosquebradasCellCitation(input.zoneId, belowTo ? "to" : "tl")
            : "table-27",
        ],
      },
    })
  }
  const formulaCitation =
    ordinate.point.branchId === "dosquebradas-plateau"
      ? dosquebradasFormulaCitation.plateau
      : dosquebradasFormulaCitation.inverse
  return {
    ...ordinate.point,
    citationIds: [formulaCitation],
  }
}

function successfulPoint(
  input: DosquebradasComputationInput,
  tSeconds: number,
): NormalizedSpectrumPoint {
  const point = normalizedPoint(input, tSeconds)
  if ("status" in point) throw new Error(`Unexpected unsupported sampled period ${tSeconds}`)
  return point
}

function successResult(input: DosquebradasComputationInput): NormalizedSpectrumResult {
  const row = findDosquebradasRow(input.zoneId)
  if (!row) return invalidResult(input, "La zona manual no existe en la Tabla 27.")
  const { to, tc, tl, aa, fa, fv } = row.fields
  const av = deriveDosquebradasAv(input.zoneId)
  const directFields = ["to", "tc", "tl", "aa", "fa", "fv"] as const
  const directSteps = directFields.map((fieldId) => ({
    id: `dosquebradas-${input.zoneId}-${fieldId}`,
    classification: "direct-source",
    label: fieldId.toUpperCase(),
    value: row.fields[fieldId],
    unit: fieldId === "to" || fieldId === "tc" || fieldId === "tl" ? "s" : fieldId === "aa" ? "g" : "dimensionless",
    dependencies: [],
    citationIds: [dosquebradasCellCitation(input.zoneId, fieldId)],
  }))
  const inputStep = {
    id: "dosquebradas-input-importance",
    classification: "user-input",
    label: "I",
    value: input.importanceFactor,
    unit: "dimensionless",
    dependencies: [],
    citationIds: ["nsr10-a.2.5-1"],
  }
  const avStep = {
    id: "dosquebradas-derived-av",
    classification: "derived",
    label: "Av derivado",
    value: av,
    unit: "g",
    dependencies: [
      `dosquebradas-${input.zoneId}-tc`,
      `dosquebradas-${input.zoneId}-aa`,
      `dosquebradas-${input.zoneId}-fa`,
      `dosquebradas-${input.zoneId}-fv`,
    ],
    citationIds: [dosquebradasFormulaCitation.av],
    expression: "Av = Tc × Aa × Fa / (0.48 × Fv)",
    substitution: `Av = ${tc} × ${aa} × ${fa} / (0.48 × ${fv}) = ${av}`,
  }
  const plateauValue = 2.5 * aa * fa * input.importanceFactor
  const inverseValue = (1.2 * av * fv * input.importanceFactor) / tl
  const formulaSteps = [
    {
      id: dosquebradasFormulaByBranch["dosquebradas-plateau"],
      classification: "derived",
      label: "Sa meseta",
      value: plateauValue,
      unit: "g",
      dependencies: [
        `dosquebradas-${input.zoneId}-aa`,
        `dosquebradas-${input.zoneId}-fa`,
        "dosquebradas-input-importance",
      ],
      citationIds: [dosquebradasFormulaCitation.plateau],
      expression: "Sa = 2.5 × Aa × Fa × I",
      substitution: `Sa = 2.5 × ${aa} × ${fa} × ${input.importanceFactor} = ${plateauValue} g`,
    },
    {
      id: dosquebradasFormulaByBranch["dosquebradas-inverse"],
      classification: "derived",
      label: "Sa 1/T",
      value: inverseValue,
      unit: "g",
      dependencies: [
        "dosquebradas-derived-av",
        `dosquebradas-${input.zoneId}-fv`,
        "dosquebradas-input-importance",
        `dosquebradas-${input.zoneId}-tl`,
      ],
      citationIds: [dosquebradasFormulaCitation.inverse],
      expression: "Sa = 1.2 × Av × Fv × I / T",
      substitution: `Sa(TL) = 1.2 × ${av} × ${fv} × ${input.importanceFactor} / ${tl} = ${inverseValue} g`,
    },
  ]
  const branches = [
    ["dosquebradas-plateau", dosquebradasFormulaCitation.plateau],
    ["dosquebradas-inverse", dosquebradasFormulaCitation.inverse],
  ].map(([id, citationId]) => ({
    id: id as DosquebradasBranchId,
    formulaId: dosquebradasFormulaByBranch[id as DosquebradasBranchId],
    citationIds: [citationId],
  }))
  const endPeriod = tl
  const sampledPeriods = Array.from(
    { length: Math.floor((endPeriod - to) / 0.01) + 1 },
    (_, index) => Number((to + index * 0.01).toFixed(8)),
  )
  const periods = [...new Set([...sampledPeriods, to, tc, tl, endPeriod])].sort(
    (left, right) => left - right,
  )
  const points = periods.map((period) => successfulPoint(input, period))
  const traceSteps = [
    ...directSteps,
    inputStep,
    avStep,
    ...formulaSteps,
  ]
  const metrics = [
    ...directFields.map((fieldId) => ({
      id: fieldId,
      label: fieldId.toUpperCase(),
      value: row.fields[fieldId],
      unit:
        fieldId === "to" || fieldId === "tc" || fieldId === "tl"
          ? ("s" as const)
          : fieldId === "aa"
            ? ("g" as const)
            : ("dimensionless" as const),
      formulaId: null,
      dependencyIds: [],
      citationIds: [dosquebradasCellCitation(input.zoneId, fieldId)],
    })),
    {
      id: "importanceFactor",
      label: "I",
      value: input.importanceFactor,
      unit: "dimensionless" as const,
      formulaId: null,
      dependencyIds: [],
      citationIds: ["nsr10-a.2.5-1"],
    },
    {
      id: "avDerived",
      label: "Av derivado",
      value: av,
      unit: "g" as const,
      formulaId: avStep.id,
      dependencyIds: avStep.dependencies,
      citationIds: [dosquebradasFormulaCitation.av],
    },
    {
      id: "saMax",
      label: "Sa máx",
      value: plateauValue,
      unit: "g" as const,
      formulaId: formulaSteps[0].id,
      dependencyIds: formulaSteps[0].dependencies,
      citationIds: [dosquebradasFormulaCitation.plateau],
    },
  ]
  const warnings = [
    {
      severity: "warning" as const,
      code: "professional-zone-validation-required",
      message:
        "La zona se selecciona manualmente. El profesional responsable debe validarla con la microzonificación oficial y las condiciones reales del predio.",
      citationIds: ["table-27", "currentness-and-harmonization"],
    },
    {
      severity: "warning" as const,
      code: "entrance-branch-unavailable",
      message: `La curva normalizada inicia en To=${to} s; para T < To la ordenada se reporta como no soportada porque el paquete oficial no atestigua esa rama.`,
      citationIds: [dosquebradasCellCitation(input.zoneId, "to")],
    },
    {
      severity: "warning" as const,
      code: "long-period-branch-unavailable",
      message: `La curva normalizada termina en TL=${tl} s; para T > TL la ordenada se reporta como no soportada porque el paquete oficial no atestigua esa rama.`,
      citationIds: [dosquebradasCellCitation(input.zoneId, "tl")],
    },
    {
      severity: "info" as const,
      code: "nsr10-harmonization-pending",
      message:
        "El POT 2024 mantiene vigentes los soportes CARDER y ordena ajustar y armonizar el modelo con NSR-10.",
      citationIds: ["currentness-and-harmonization"],
    },
    unknownMunicipalReturnPeriodWarning,
  ]
  const citationIds = [
    ...new Set([
      ...directFields.map((field) => dosquebradasCellCitation(input.zoneId, field)),
      ...traceSteps.flatMap((step) => step.citationIds),
      ...warnings.flatMap((warning) => warning.citationIds),
    ]),
  ]
  const trace = {
    schemaVersion: DOSQUEBRADAS_TRACE_SCHEMA_VERSION,
    context: {
      ...input,
      derivedAv: av,
      supportedFromSeconds: to,
      supportedThroughSeconds: tl,
      municipalReturnPeriodYears: null,
    },
    steps: traceSteps,
    branches: branches.map(({ id, formulaId }) => ({ id, formulaId })),
  }
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "ok",
    engine: engineIdentity,
    study: { id: DOSQUEBRADAS_STUDY_ID, version: DOSQUEBRADAS_STUDY_VERSION },
    scenarioEvidenceKey: {
      studyId: DOSQUEBRADAS_STUDY_ID,
      studyVersion: DOSQUEBRADAS_STUDY_VERSION,
      optionId: input.zoneId,
      hazardId: input.hazardId,
    },
    scenarioType: "municipal-study",
    normalizedInputs: input,
    points,
    metrics,
    formulaIds: traceSteps.map(({ id }) => id),
    branches,
    hazard: {
      id: "design",
      label: "Diseño · período de retorno municipal no declarado",
      returnPeriodYears: null,
      dampingRatio: 0.05,
    },
    warnings,
    applicability: { status: "applicable" },
    sourceIds: [...dosquebradasSourceIds],
    citationIds,
    evidenceAvailability: {
      status: "partial",
      unavailableClaims: [
        {
          id: "entrance-branch-below-to",
          reason: "El paquete oficial no atestigua la ecuación aplicable para T < To.",
        },
        {
          id: "long-period-branch-above-tl",
          reason: "El paquete oficial no atestigua la ecuación aplicable para T > TL.",
        },
        {
          id: "municipal-return-period",
          reason: "La Tabla 27 no declara explícitamente período de retorno o probabilidad.",
        },
      ],
    },
    traceSchemaVersion: DOSQUEBRADAS_TRACE_SCHEMA_VERSION,
    trace: {
      schemaId: DOSQUEBRADAS_TRACE_SCHEMA_ID,
      schemaVersion: DOSQUEBRADAS_TRACE_SCHEMA_VERSION,
      data: trace,
    },
    capabilities: dosquebradasCapabilities,
  })
  assertDosquebradasLineageResolves(data)
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

export function adaptDosquebradasSpectrum(input: unknown): NormalizedSpectrumResult {
  const parsed = dosquebradasComputationInputSchema.safeParse(input)
  return parsed.success
    ? successResult(parsed.data)
    : invalidResult(input, z.prettifyError(parsed.error))
}

export function createDosquebradasScenario(
  input: DosquebradasComputationInput,
): DosquebradasScenario {
  return dosquebradasScenarioSchema.parse({
    type: "municipal-study",
    studyId: DOSQUEBRADAS_STUDY_ID,
    studyVersion: DOSQUEBRADAS_STUDY_VERSION,
    inputs: dosquebradasComputationInputSchema.parse(input),
  })
}

const metadata = spectrumEngineMetadataSchema.parse({
  ...engineIdentity,
  capabilitySchemaVersion: SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  capabilities: dosquebradasCapabilities,
})

export const dosquebradasSpectrumEngine: SpectrumEngine<DosquebradasScenario> = {
  metadata,
  accepts(scenario): scenario is DosquebradasScenario {
    return dosquebradasScenarioSchema.safeParse(scenario).success
  },
  compute(scenario) {
    const parsed = dosquebradasScenarioSchema.safeParse(scenario)
    return parsed.success
      ? adaptDosquebradasSpectrum(parsed.data.inputs)
      : invalidResult(scenario, z.prettifyError(parsed.error))
  },
}
