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
  assertManizalesLineageResolves,
  manizalesCellCitation,
  manizalesFormulaCitation,
  manizalesSourceIds,
} from "./evidence"
import {
  evaluateManizalesOrdinate,
  manizalesFormulaByBranch,
  type ManizalesBranchId,
} from "./engine"
import {
  MANIZALES_STUDY_ID,
  MANIZALES_STUDY_VERSION,
  manizalesComputationInputSchema,
  manizalesPresentation,
  manizalesScenarioSchema,
  findManizalesRow,
  type ManizalesComputationInput,
  type ManizalesScenario,
} from "./schema"
import "./study-relations"

export const MANIZALES_ENGINE_ID = "manizales-spectrum" as const
export const MANIZALES_ENGINE_VERSION = "1" as const
export const MANIZALES_TRACE_SCHEMA_ID = "manizales-calculation-trace" as const
export const MANIZALES_TRACE_SCHEMA_VERSION = 1 as const

export const manizalesCapabilities = spectrumCapabilitiesSchema.parse({
  comparison: unsupportedCapability(
    "El comparador todavía no consume escenarios municipales normalizados de Manizales.",
  ),
  contextualPdf: supportedCapability(),
  csvExport: supportedCapability(),
  etabsExport: supportedCapability(),
  jsonExport: supportedCapability(),
  svgPngExport: supportedCapability(),
  buildingBaseShear: unsupportedCapability(
    "El cortante basal sigue siendo un flujo exclusivo de NSR-10 nacional.",
  ),
  fheWorkflow: unsupportedCapability("El flujo FHE sigue siendo exclusivo de NSR-10 nacional."),
  bridgeRFactorWorkflow: unsupportedCapability(
    "El estudio municipal no define el flujo de puentes de CCP-14.",
  ),
  traceabilityViewer: supportedCapability(),
})

const engineIdentity = {
  id: MANIZALES_ENGINE_ID,
  version: MANIZALES_ENGINE_VERSION,
  studyId: MANIZALES_STUDY_ID,
  studyVersion: MANIZALES_STUDY_VERSION,
  scenarioType: "municipal-study" as const,
}

const validZoneIds = new Set(["zone-a", "zone-b", "zone-c"])
const directFields = ["to", "tc", "tl", "am", "an", "fa", "fv"] as const
const fieldUnit = (fieldId: (typeof directFields)[number]) =>
  fieldId === "to" || fieldId === "tc" || fieldId === "tl"
    ? ("s" as const)
    : fieldId === "am" || fieldId === "an"
      ? ("g" as const)
      : ("dimensionless" as const)

const unknownMunicipalReturnPeriodWarning = {
  severity: "info" as const,
  code: "municipal-return-period-unknown",
  message:
    "El capítulo 8 del estudio no declara período de retorno ni probabilidad de excedencia para los espectros de diseño. El resultado conserva este metadato como desconocido y no lo sustituye con un valor nacional.",
  citationIds: ["figura-8.5"],
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
      typeof record.importanceFactor === "number" && Number.isFinite(record.importanceFactor)
        ? record.importanceFactor
        : null,
  }
}

function evidenceKey(inputs: NormalizedInputs) {
  return {
    studyId: MANIZALES_STUDY_ID,
    studyVersion: MANIZALES_STUDY_VERSION,
    optionId: typeof inputs.zoneId === "string" ? inputs.zoneId : null,
    hazardId: inputs.hazardId === "design" ? "design" : null,
  }
}

const designHazard = {
  id: "design",
  label: "Diseño · período de retorno no declarado por el estudio",
  returnPeriodYears: null,
  dampingRatio: 0.05,
}

function invalidResult(input: unknown, message: string): NormalizedSpectrumResult {
  const normalizedInputs = invalidInputs(input)
  const key = evidenceKey(normalizedInputs)
  const applicability = {
    status: "invalid-input" as const,
    reasonCode: "manizales-invalid-input",
    message,
    citationIds: [],
  }
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "invalid-input",
    engine: engineIdentity,
    study: { id: MANIZALES_STUDY_ID, version: MANIZALES_STUDY_VERSION },
    scenarioEvidenceKey: key,
    scenarioType: "municipal-study",
    normalizedInputs,
    hazard: key.hazardId === "design" ? designHazard : null,
    warnings: key.hazardId === "design" ? [unknownMunicipalReturnPeriodWarning] : [],
    applicability,
    sourceIds: [...manizalesSourceIds],
    citationIds: key.hazardId === "design" ? ["figura-8.5"] : [],
    evidenceAvailability: {
      status: "unavailable",
      reason: "La entrada no resuelve una columna de la Figura 8.5.",
    },
    traceSchemaVersion: MANIZALES_TRACE_SCHEMA_VERSION,
    trace: null,
    capabilities: manizalesCapabilities,
  })
  assertManizalesLineageResolves(data)
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
  input: ManizalesComputationInput,
  tSeconds: number,
): NormalizedSpectrumPoint | ReturnType<typeof normalizedSpectrumOrdinateSchema.parse> {
  const ordinate = evaluateManizalesOrdinate({
    zoneId: input.zoneId,
    tSeconds,
    importanceFactor: input.importanceFactor,
  })
  if (ordinate.status === "invalid-input") {
    return normalizedSpectrumOrdinateSchema.parse({
      status: "invalid-input",
      applicability: {
        status: "invalid-input",
        reasonCode: "manizales-invalid-period",
        message: ordinate.message,
        citationIds: [],
      },
    })
  }
  const branchCitation = {
    "manizales-entrance": manizalesFormulaCitation.entrance,
    "manizales-plateau": manizalesFormulaCitation.plateau,
    "manizales-inverse": manizalesFormulaCitation.inverse,
    "manizales-floor": manizalesFormulaCitation.floor,
  }[ordinate.point.branchId]
  return { ...ordinate.point, citationIds: [branchCitation] }
}

function successfulPoint(
  input: ManizalesComputationInput,
  tSeconds: number,
): NormalizedSpectrumPoint {
  const point = normalizedPoint(input, tSeconds)
  if ("status" in point) throw new Error(`Unexpected unsupported sampled period ${tSeconds}`)
  return point
}

function successResult(input: ManizalesComputationInput): NormalizedSpectrumResult {
  const row = findManizalesRow(input.zoneId)
  if (!row) return invalidResult(input, "La zona manual no existe en la Figura 8.5.")
  const { to, tc, tl, am, an, fa, fv } = row.fields
  const importance = input.importanceFactor

  const directSteps = directFields.map((fieldId) => ({
    id: `manizales-${input.zoneId}-${fieldId}`,
    classification: "direct-source",
    label: fieldId === "to" ? "To" : fieldId === "tc" ? "Tc" : fieldId === "tl" ? "TL" : fieldId === "am" ? "Am" : fieldId === "an" ? "An" : fieldId === "fa" ? "Fa" : "Fv",
    value: row.fields[fieldId],
    unit: fieldUnit(fieldId),
    dependencies: [],
    citationIds: [manizalesCellCitation(input.zoneId, fieldId)],
  }))
  const inputStep = {
    id: "manizales-input-importance",
    classification: "user-input",
    label: "I",
    value: importance,
    unit: "dimensionless",
    dependencies: [],
    // The 2002 sheet prints no I. Consideration (a) is what authorises the
    // multiplication: the recommendations complement the national code and no
    // requirement may fall below it.
    citationIds: ["consideration-a-complementary", "nsr10-a.2.5-1"],
  }
  const plateauValue = 2.5 * am * fa * importance
  const inverseAtTl = (an * fv * importance) / tl
  const floorValue = (am * importance) / 2
  const zone = input.zoneId
  const formulaSteps = [
    {
      id: manizalesFormulaByBranch["manizales-entrance"],
      classification: "derived",
      label: "Sa entrada",
      value: am * importance,
      unit: "g",
      dependencies: [
        `manizales-${zone}-am`,
        `manizales-${zone}-to`,
        `manizales-${zone}-fa`,
        "manizales-input-importance",
      ],
      citationIds: [manizalesFormulaCitation.entrance],
      expression: "Sa = Am·I + (Am·I / To) × (2.5 × Fa − 1) × T",
      substitution: `Sa(0) = ${am} × ${importance} = ${am * importance} g`,
    },
    {
      id: manizalesFormulaByBranch["manizales-plateau"],
      classification: "derived",
      label: "Sa meseta",
      value: plateauValue,
      unit: "g",
      dependencies: [
        `manizales-${zone}-am`,
        `manizales-${zone}-fa`,
        "manizales-input-importance",
      ],
      citationIds: [manizalesFormulaCitation.plateau],
      expression: "Sa = 2.5 × Am × Fa × I",
      substitution: `Sa = 2.5 × ${am} × ${fa} × ${importance} = ${plateauValue} g`,
    },
    {
      id: manizalesFormulaByBranch["manizales-inverse"],
      classification: "derived",
      label: "Sa 1/T",
      value: inverseAtTl,
      unit: "g",
      dependencies: [
        `manizales-${zone}-an`,
        `manizales-${zone}-fv`,
        `manizales-${zone}-tl`,
        "manizales-input-importance",
      ],
      citationIds: [manizalesFormulaCitation.inverse],
      expression: "Sa = An × Fv × I / T",
      substitution: `Sa(TL) = ${an} × ${fv} × ${importance} / ${tl} = ${inverseAtTl} g`,
    },
    {
      id: manizalesFormulaByBranch["manizales-floor"],
      classification: "derived",
      label: "Sa piso",
      value: floorValue,
      unit: "g",
      dependencies: [`manizales-${zone}-am`, "manizales-input-importance"],
      citationIds: [manizalesFormulaCitation.floor],
      expression: "Sa = Am × I / 2",
      substitution: `Sa = ${am} × ${importance} / 2 = ${floorValue} g`,
    },
  ]

  const branchIds: ManizalesBranchId[] = [
    "manizales-entrance",
    "manizales-plateau",
    "manizales-inverse",
    "manizales-floor",
  ]
  const branchCitationById: Record<ManizalesBranchId, string> = {
    "manizales-entrance": manizalesFormulaCitation.entrance,
    "manizales-plateau": manizalesFormulaCitation.plateau,
    "manizales-inverse": manizalesFormulaCitation.inverse,
    "manizales-floor": manizalesFormulaCitation.floor,
  }
  const branches = branchIds.map((id) => ({
    id,
    formulaId: manizalesFormulaByBranch[id],
    citationIds: [branchCitationById[id]],
  }))

  const endPeriod = manizalesPresentation.sampledThroughSeconds
  const sampledPeriods = Array.from(
    { length: Math.floor(endPeriod / 0.01) + 1 },
    (_, index) => Number((index * 0.01).toFixed(8)),
  )
  const periods = [...new Set([...sampledPeriods, 0, to, tc, tl, endPeriod])].sort(
    (left, right) => left - right,
  )
  const points = periods.map((period) => successfulPoint(input, period))
  const traceSteps = [...directSteps, inputStep, ...formulaSteps]

  const metrics = [
    ...directFields.map((fieldId, index) => ({
      id: fieldId,
      label: directSteps[index].label,
      value: row.fields[fieldId],
      unit: fieldUnit(fieldId),
      formulaId: null,
      dependencyIds: [],
      citationIds: [manizalesCellCitation(input.zoneId, fieldId)],
    })),
    {
      id: "importanceFactor",
      label: "I",
      value: importance,
      unit: "dimensionless" as const,
      formulaId: null,
      dependencyIds: [],
      citationIds: ["nsr10-a.2.5-1"],
    },
    {
      id: "saMax",
      label: "Sa máx",
      value: plateauValue,
      unit: "g" as const,
      formulaId: formulaSteps[1].id,
      dependencyIds: formulaSteps[1].dependencies,
      citationIds: [manizalesFormulaCitation.plateau],
    },
    {
      id: "saFloor",
      label: "Sa para T > TL",
      value: floorValue,
      unit: "g" as const,
      formulaId: formulaSteps[3].id,
      dependencyIds: formulaSteps[3].dependencies,
      citationIds: [manizalesFormulaCitation.floor],
    },
  ]

  const warnings = [
    {
      severity: "warning" as const,
      code: "professional-zone-validation-required",
      message:
        "La zona se selecciona manualmente. El profesional responsable debe validarla contra el mapa de zonificación 1:30000 de la Figura 8.1; en caso de duda el estudio ordena usar la Zona A.",
      citationIds: ["zone-map", "selection-procedure"],
    },
    {
      severity: "warning" as const,
      code: "special-analysis-at-or-above-2s",
      message: `La consideración de diseño (e) exige análisis sísmicos especiales para estructuras con período fundamental mayor o igual a ${manizalesPresentation.specialSeismicAnalysisRequiredAtOrAboveSeconds} s; esa parte de la curva queda fuera del alcance de las recomendaciones.`,
      citationIds: ["warning-special-analysis"],
    },
    {
      severity: "warning" as const,
      code: "topographic-amplification-not-applied",
      message:
        "La consideración de diseño (c) exige aplicar los factores de amplificación por efectos topográficos cerca de los bordes de talud. Este cálculo no los aplica porque no conoce la altura del talud ni la distancia al borde.",
      citationIds: ["consideration-c-topographic"],
    },
    ...(input.zoneId === "zone-c"
      ? [
          {
            severity: "warning" as const,
            code: "zone-c-requires-explicit-justification",
            message:
              "La consideración de diseño (f) exige que el ingeniero geotécnico justifique de forma explícita el uso de los espectros de la Zona C; ante cualquier duda deben usarse los de la Zona A o B.",
            citationIds: ["warning-zone-c-justification"],
          },
        ]
      : []),
    {
      severity: "info" as const,
      code: "importance-factor-applied",
      message:
        "La Figura 8.5 imprime el espectro sin coeficiente de importancia. Se multiplica por I según la consideración de diseño (a); con I = 1.00 la curva es exactamente la publicada.",
      citationIds: ["consideration-a-complementary", "nsr10-a.2.5-1"],
    },
    unknownMunicipalReturnPeriodWarning,
  ]

  const citationIds = [
    ...new Set([
      ...directFields.map((field) => manizalesCellCitation(input.zoneId, field)),
      ...traceSteps.flatMap((step) => step.citationIds),
      ...warnings.flatMap((warning) => warning.citationIds),
      "figura-8.5",
      "branch-limits",
      "damping-five-percent",
      "consideration-b-damping",
      "consideration-h-high-hazard",
      "consideration-i-am-equivalent",
      "three-zone-model",
    ]),
  ]

  const trace = {
    schemaVersion: MANIZALES_TRACE_SCHEMA_VERSION,
    context: {
      ...input,
      dampingRatio: 0.05,
      sampledThroughSeconds: endPeriod,
      spectraPresentedThroughSeconds: manizalesPresentation.spectraPresentedThroughSeconds,
      municipalReturnPeriodYears: null,
    },
    steps: traceSteps,
    branches: branches.map(({ id, formulaId }) => ({ id, formulaId })),
  }

  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "ok",
    engine: engineIdentity,
    study: { id: MANIZALES_STUDY_ID, version: MANIZALES_STUDY_VERSION },
    scenarioEvidenceKey: {
      studyId: MANIZALES_STUDY_ID,
      studyVersion: MANIZALES_STUDY_VERSION,
      optionId: input.zoneId,
      hazardId: input.hazardId,
    },
    scenarioType: "municipal-study",
    normalizedInputs: input,
    points,
    metrics,
    formulaIds: traceSteps.map(({ id }) => id),
    branches,
    hazard: designHazard,
    warnings,
    applicability: { status: "applicable" },
    sourceIds: [...manizalesSourceIds],
    citationIds,
    evidenceAvailability: {
      status: "partial",
      unavailableClaims: [
        {
          id: "municipal-return-period",
          reason: "El estudio no declara período de retorno ni probabilidad para los espectros de diseño.",
        },
        {
          id: "topographic-amplification",
          reason:
            "El factor Ftop depende de la altura del talud y de la distancia al borde, que el producto no conoce.",
        },
      ],
    },
    traceSchemaVersion: MANIZALES_TRACE_SCHEMA_VERSION,
    trace: {
      schemaId: MANIZALES_TRACE_SCHEMA_ID,
      schemaVersion: MANIZALES_TRACE_SCHEMA_VERSION,
      data: trace,
    },
    capabilities: manizalesCapabilities,
  })
  assertManizalesLineageResolves(data)
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

export function adaptManizalesSpectrum(input: unknown): NormalizedSpectrumResult {
  const parsed = manizalesComputationInputSchema.safeParse(input)
  return parsed.success ? successResult(parsed.data) : invalidResult(input, z.prettifyError(parsed.error))
}

export function createManizalesScenario(
  input: ManizalesComputationInput,
): ManizalesScenario {
  return manizalesScenarioSchema.parse({
    type: "municipal-study",
    studyId: MANIZALES_STUDY_ID,
    studyVersion: MANIZALES_STUDY_VERSION,
    inputs: manizalesComputationInputSchema.parse(input),
  })
}

const metadata = spectrumEngineMetadataSchema.parse({
  ...engineIdentity,
  capabilitySchemaVersion: SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  capabilities: manizalesCapabilities,
})

export const manizalesSpectrumEngine: SpectrumEngine<ManizalesScenario> = {
  metadata,
  accepts(scenario): scenario is ManizalesScenario {
    return manizalesScenarioSchema.safeParse(scenario).success
  },
  compute(scenario) {
    const parsed = manizalesScenarioSchema.safeParse(scenario)
    return parsed.success
      ? adaptManizalesSpectrum(parsed.data.inputs)
      : invalidResult(scenario, z.prettifyError(parsed.error))
  },
}
