import { z } from "zod"

import {
  SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  spectrumCapabilitiesSchema,
  supportedCapability,
  unsupportedCapability,
} from "../spectra/capabilities"
import { spectrumEngineMetadataSchema } from "../spectra/engine"
import {
  SPECTRUM_CONTRACT_SCHEMA_VERSION,
  normalizedSpectrumOrdinateSchema,
  normalizedSpectrumResultDataSchema,
} from "../spectra/types"
import {
  CCP14_ENGINE_ID,
  CCP14_ENGINE_VERSION,
  CCP14_HAZARD_ID,
  CCP14_STUDY_ID,
  CCP14_STUDY_VERSION,
  CCP14_TRACE_SCHEMA_ID,
  CCP14_TRACE_SCHEMA_VERSION,
} from "./constants"
import {
  ccp14ComputationInputSchema,
  computeCcp14Spectrum,
} from "./engine"
import {
  ccp14DirectValueBacking,
  ccp14LegendBacking,
  resolveCcp14MapLocation,
} from "./map-locations"
import "./study-relations"

import type { SpectrumEngine } from "../spectra/engine"
import type {
  NormalizedInputs,
  NormalizedSpectrumPoint,
  NormalizedSpectrumResult,
  SpectrumWarning,
} from "../spectra/types"
import type {
  Ccp14BranchId,
  Ccp14EngineSuccess,
  Ccp14FactorId,
} from "./engine"

export {
  CCP14_ENGINE_ID,
  CCP14_ENGINE_VERSION,
  CCP14_HAZARD_ID,
  CCP14_STUDY_ID,
  CCP14_STUDY_VERSION,
  CCP14_TRACE_SCHEMA_ID,
  CCP14_TRACE_SCHEMA_VERSION,
} from "./constants"

const SOURCE_IDS = [
  "mintransporte-resolution-108-2015-invias-copy",
  "invias-ccp14-section-3",
] as const

const engineIdentity = {
  id: CCP14_ENGINE_ID,
  version: CCP14_ENGINE_VERSION,
  studyId: CCP14_STUDY_ID,
  studyVersion: CCP14_STUDY_VERSION,
  scenarioType: "ccp14" as const,
}

export const ccp14Capabilities = spectrumCapabilitiesSchema.parse({
  comparison: unsupportedCapability(
    "The shared comparison consumer has not yet registered the CCP-14 engine.",
  ),
  contextualPdf: supportedCapability(),
  csvExport: supportedCapability(),
  etabsExport: supportedCapability(),
  jsonExport: supportedCapability(),
  svgPngExport: supportedCapability(),
  buildingBaseShear: unsupportedCapability(
    "CCP-14 is a bridge standard and does not expose the NSR-10 building base-shear workflow.",
  ),
  fheWorkflow: unsupportedCapability(
    "CCP-14 is a bridge standard and does not expose the NSR-10 FHE building workflow.",
  ),
  bridgeRFactorWorkflow: supportedCapability(),
  traceabilityViewer: supportedCapability(),
})

const hazard = {
  id: CCP14_HAZARD_ID,
  label: "Sismo de diseño CCP-14 (7 % de excedencia en 75 años)",
  returnPeriodYears: 1000,
  dampingRatio: 0.05,
}

const formulaByBranch: Record<Ccp14BranchId, string> = {
  "initial-linear": "ccp14-csm-initial",
  plateau: "ccp14-csm-plateau",
  "inverse-period": "ccp14-csm-inverse",
}

const citationByBranch: Record<Ccp14BranchId, string[]> = {
  "initial-linear": ["claim-spectrum-branches", "conflict-t0-figure", "conflict-t0-definition"],
  plateau: ["claim-spectrum-branches"],
  "inverse-period": ["claim-spectrum-branches"],
}

const commonWarnings: SpectrumWarning[] = [
  {
    severity: "warning",
    code: "ccp14-manual-hazard-inputs",
    message:
      "PGA, Ss y S1 se leen de las Figuras 3.10.2.1-1 a 3.10.2.1-3 o de los valores o mapas especiales aprobados por la entidad contratante, con interpolación lineal entre contornos. La publicación oficial no incluye un registro de municipios ni una tabla localidad-a-PGA/Ss/S1, así que la calculadora no asigna estos valores por ciudad.",
    citationIds: ["claim-map-inputs", "claim-exact-locality-count"],
  },
  {
    severity: "warning",
    code: "ccp14-t0-official-conflict",
    message:
      "La publicación oficial de INVÍAS es internamente inconsistente: la Figura 3.10.4.1-1 indica T0 = 0,2·Ts mientras la definición bajo las ecuaciones indica T0 = 0,2 s. Salvo que se declare otra lectura, el resultado aplica la de la figura, que es la única compatible con la forma espectral dibujada y la única que mantiene T0 ≤ Ts para todo dato válido. Esto no resuelve oficialmente la contradicción.",
    citationIds: ["conflict-t0-figure", "conflict-t0-definition"],
  },
  {
    severity: "warning",
    code: "ccp14-site-specific-triggers",
    message:
      "El Procedimiento General solo aplica si el diseñador descarta las cuatro condiciones de 3.10.2: sitio a menos de 10 km de una falla activa, perfil de sitio tipo F, sismos de larga duración esperados en la región, e importancia del puente que exija menor probabilidad de excedencia. Cualquiera de ellas obliga al Procedimiento Particular de Sitio de 3.10.2.2.",
    citationIds: ["claim-site-specific-triggers"],
  },
]

function normalizedInputs(input: unknown): NormalizedInputs {
  const record = input && typeof input === "object" ? input as Record<string, unknown> : {}
  const scalar = (key: string) => {
    const value = record[key]
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? value
      : null
  }
  return {
    pgaG: scalar("pgaG"),
    ssG: scalar("ssG"),
    s1G: scalar("s1G"),
    soilClass: scalar("soilClass"),
    mapLocationId: scalar("mapLocationId"),
    pgaRegion: scalar("pgaRegion"),
    ssRegion: scalar("ssRegion"),
    s1Region: scalar("s1Region"),
    t0Interpretation: scalar("t0Interpretation"),
    distanceToActiveFaultKm: scalar("distanceToActiveFaultKm"),
    longDurationEarthquakesExpected: scalar("longDurationEarthquakesExpected"),
    enhancedHazardRequiredByImportance: scalar("enhancedHazardRequiredByImportance"),
  }
}

function evidenceKey(optionId: string | null, hazardId: string | null) {
  return {
    studyId: CCP14_STUDY_ID,
    studyVersion: CCP14_STUDY_VERSION,
    optionId,
    hazardId,
  }
}

function failedResult(
  input: unknown,
  failure: {
    status: "invalid-input" | "unsupported" | "site-specific-study-required"
    reasonCode: string
    message: string
    citationIds: string[]
  },
): NormalizedSpectrumResult {
  const parsedInput = ccp14ComputationInputSchema.safeParse(input)
  const optionId = parsedInput.success ? parsedInput.data.soilClass : null
  const activeHazard = parsedInput.success ? hazard : null
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: failure.status,
    engine: engineIdentity,
    study: { id: CCP14_STUDY_ID, version: CCP14_STUDY_VERSION },
    scenarioEvidenceKey: evidenceKey(optionId, activeHazard?.id ?? null),
    scenarioType: "ccp14",
    normalizedInputs: parsedInput.success ? parsedInput.data : normalizedInputs(input),
    hazard: activeHazard,
    warnings: parsedInput.success ? commonWarnings : [],
    applicability: failure,
    sourceIds: [...SOURCE_IDS],
    citationIds: [...new Set([
      ...failure.citationIds,
      ...(parsedInput.success ? commonWarnings.flatMap(({ citationIds }) => citationIds) : []),
    ])],
    evidenceAvailability: parsedInput.success
      ? { status: "available" }
      : { status: "unavailable", reason: "La entrada inválida no resolvió un escenario CCP-14." },
    traceSchemaVersion: CCP14_TRACE_SCHEMA_VERSION,
    trace: null,
    capabilities: ccp14Capabilities,
  })
  return {
    ...data,
    saAt() {
      return normalizedSpectrumOrdinateSchema.parse({
        status: failure.status,
        applicability: failure,
      })
    },
  }
}

function factorStep(engine: Ccp14EngineSuccess, factorId: Ccp14FactorId) {
  const factor = engine.factors[factorId]
  const inputStep = factorId === "Fpga" ? "ccp14-input-pga" : factorId === "Fa" ? "ccp14-input-ss" : "ccp14-input-s1"
  const inputLabel = factorId === "Fpga" ? "PGA" : factorId === "Fa" ? "Ss" : "S1"
  return {
    id: `ccp14-factor-${factorId.toLowerCase()}`,
    classification: "derived",
    label: factorId,
    value: factor.value,
    unit: "dimensionless",
    dependencies: [inputStep, "ccp14-input-soil-class"],
    citationIds: factor.citationIds,
    expression:
      factor.mode === "interpolation"
        ? "interpolación lineal entre los valores tabulados adyacentes"
        : "valor tabulado de la tabla de factores de sitio",
    substitution: `${factorId}(${inputLabel} = ${factor.argument}, perfil ${engine.input.soilClass}) = ${factor.value}`,
  }
}

function normalizedPoint(engine: Ccp14EngineSuccess, tSeconds: number): NormalizedSpectrumPoint {
  const point = engine.at(tSeconds)
  const formulaId = formulaByBranch[point.branchId]
  return {
    tSeconds,
    saG: point.csm,
    branchId: point.branchId,
    formulaId,
    citationIds: citationByBranch[point.branchId],
  }
}

function successResult(engine: Ccp14EngineSuccess): NormalizedSpectrumResult {
  const { input } = engine
  const backing = ccp14DirectValueBacking(input.mapLocationId, {
    pgaG: input.pgaG,
    ssG: input.ssG,
    s1G: input.s1G,
  })
  const backingByField = new Map(backing.map((entry) => [entry.field, entry]))
  const legendByField = {
    pgaG: ccp14LegendBacking("PGA", input.pgaRegion, input.pgaG),
    ssG: ccp14LegendBacking("Ss", input.ssRegion, input.ssG),
    s1G: ccp14LegendBacking("S1", input.s1Region, input.s1G),
  }
  /**
   * A coefficient can be backed twice over: the figure may state it at the
   * location, and the engineer may also have read it as a whole legend region.
   * Both citations travel with the value; neither is invented when the number
   * stops matching what the publication says.
   */
  const coefficientCitations = (field: "pgaG" | "ssG" | "s1G") => [
    ...(backingByField.get(field) ? [backingByField.get(field)!.citationId] : []),
    ...(legendByField[field] ? [legendByField[field]!.citationId] : []),
    "claim-map-inputs",
  ]
  const directSteps = [
    { id: "ccp14-input-pga", label: "PGA", value: input.pgaG, unit: "g", citationIds: coefficientCitations("pgaG") },
    { id: "ccp14-input-ss", label: "Ss", value: input.ssG, unit: "g", citationIds: coefficientCitations("ssG") },
    { id: "ccp14-input-s1", label: "S1", value: input.s1G, unit: "g", citationIds: coefficientCitations("s1G") },
    { id: "ccp14-input-soil-class", label: "Perfil de sitio", value: input.soilClass, unit: "class", citationIds: ["claim-soils"] },
    {
      id: "ccp14-input-map-location",
      label: "Lugar rotulado en los mapas",
      value: input.mapLocationId === null
        ? "no declarado"
        : resolveCcp14MapLocation(input.mapLocationId).label,
      unit: "choice",
      citationIds: ["claim-map-location-labels"],
    },
  ].map((step) => ({ ...step, classification: "user-input", dependencies: [] }))
  const t0InterpretationStep = {
    id: "ccp14-input-t0-interpretation",
    classification:
      engine.t0InterpretationSource === "declared" ? "user-input" : "engine-default",
    label:
      engine.t0InterpretationSource === "declared"
        ? "Lectura de T₀ declarada"
        : "Lectura de T₀ aplicada por defecto",
    value: input.t0Interpretation,
    unit: "choice",
    dependencies: [],
    citationIds: ["conflict-t0-figure", "conflict-t0-definition"],
  }
  const factorSteps = (["Fpga", "Fa", "Fv"] as const).map((id) => factorStep(engine, id))
  const derivedSteps = [
    {
      id: "ccp14-as",
      label: "As",
      value: engine.as,
      unit: "g",
      dependencies: ["ccp14-factor-fpga", "ccp14-input-pga"],
      citationIds: ["claim-as"],
      expression: "As = Fpga × PGA",
      substitution: `${engine.factors.Fpga.value} × ${input.pgaG} = ${engine.as}`,
    },
    {
      id: "ccp14-sds",
      label: "SDS",
      value: engine.sds,
      unit: "g",
      dependencies: ["ccp14-factor-fa", "ccp14-input-ss"],
      citationIds: ["claim-sds"],
      expression: "SDS = Fa × Ss",
      substitution: `${engine.factors.Fa.value} × ${input.ssG} = ${engine.sds}`,
    },
    {
      id: "ccp14-sd1",
      label: "SD1",
      value: engine.sd1,
      unit: "g",
      dependencies: ["ccp14-factor-fv", "ccp14-input-s1"],
      citationIds: ["claim-sd1"],
      expression: "SD1 = Fv × S1",
      substitution: `${engine.factors.Fv.value} × ${input.s1G} = ${engine.sd1}`,
    },
    {
      id: "ccp14-ts",
      label: "Ts",
      value: engine.ts,
      unit: "s",
      dependencies: ["ccp14-sd1", "ccp14-sds"],
      citationIds: ["claim-ts"],
      expression: "Ts = SD1 / SDS",
      substitution: `${engine.sd1} / ${engine.sds} = ${engine.ts} s`,
    },
    {
      id: "ccp14-t0",
      label: "T0",
      value: engine.t0,
      unit: "s",
      dependencies: input.t0Interpretation === "figure-0.2-ts"
        ? ["ccp14-input-t0-interpretation", "ccp14-ts"]
        : ["ccp14-input-t0-interpretation"],
      citationIds: ["conflict-t0-figure", "conflict-t0-definition"],
      expression: input.t0Interpretation === "figure-0.2-ts" ? "T0 = 0.2 Ts" : "T0 = 0.2 s",
      substitution: input.t0Interpretation === "figure-0.2-ts" ? `0.2 × ${engine.ts} = ${engine.t0} s` : "T0 = 0.2 s",
    },
    {
      id: "ccp14-performance-zone",
      label: "Zona de desempeño sísmico",
      value: engine.performanceZone,
      unit: "dimensionless",
      dependencies: ["ccp14-sd1"],
      citationIds: ["claim-zones"],
      expression: "Zona seleccionada con los umbrales de SD1 0,15, 0,30 y 0,50",
      substitution: `SD1 = ${engine.sd1} corresponde a la zona ${engine.performanceZone}`,
    },
  ].map((step) => ({ ...step, classification: "derived" }))
  const representativePeriods: Record<Ccp14BranchId, number> = {
    "initial-linear": 0,
    plateau: (engine.t0 + engine.ts) / 2,
    "inverse-period": Math.max(1, engine.ts + 0.5),
  }
  const branchSteps = (Object.keys(formulaByBranch) as Ccp14BranchId[]).map((branchId) => {
    const t = representativePeriods[branchId]
    const value = engine.at(t).csm
    const dependencies = branchId === "initial-linear"
      ? ["ccp14-as", "ccp14-sds", "ccp14-t0"]
      : branchId === "plateau"
        ? ["ccp14-sds"]
        : ["ccp14-sd1"]
    return {
      id: formulaByBranch[branchId],
      classification: "derived",
      label: `Csm · rama ${branchId}`,
      value,
      unit: "g",
      dependencies,
      citationIds: citationByBranch[branchId],
      expression: branchId === "initial-linear"
        ? "Csm = As + (SDS - As)(T/T0)"
        : branchId === "plateau" ? "Csm = SDS" : "Csm = SD1/T",
      substitution: `Csm(${t} s) = ${value}`,
    }
  })
  const steps = [
    ...directSteps,
    t0InterpretationStep,
    ...factorSteps,
    ...derivedSteps,
    ...branchSteps,
  ]
  const periods = Array.from({ length: 501 }, (_, index) => Number((index * 0.01).toFixed(8)))
  const points = periods.map((period) => normalizedPoint(engine, period))
  /**
   * Extreme but valid coefficients can push T0 or Ts past the sampled 0-5 s
   * window, leaving a published branch with no ordinate in this result. The
   * curve declares only the branches it actually carries; the formulas for the
   * others stay in the trace steps.
   */
  const sampledBranchIds = new Set(points.map(({ branchId }) => branchId))
  const branches = (Object.keys(formulaByBranch) as Ccp14BranchId[])
    .filter((id) => sampledBranchIds.has(id))
    .map((id) => ({
      id,
      formulaId: formulaByBranch[id],
      citationIds: citationByBranch[id],
    }))
  const metricDefinitions = [
    ["as", "As", engine.as, "g", "ccp14-as"],
    ["sds", "SDS", engine.sds, "g", "ccp14-sds"],
    ["sd1", "SD1", engine.sd1, "g", "ccp14-sd1"],
    ["ts", "Ts", engine.ts, "s", "ccp14-ts"],
    ["t0", "T0", engine.t0, "s", "ccp14-t0"],
    ["performanceZone", "Zona de desempeño sísmico", engine.performanceZone, "dimensionless", "ccp14-performance-zone"],
  ] as const
  const stepById = new Map(steps.map((step) => [step.id, step]))
  const metrics = metricDefinitions.map(([id, label, value, unit, formulaId]) => ({
    id,
    label,
    value,
    unit,
    formulaId,
    dependencyIds: stepById.get(formulaId)?.dependencies ?? [],
    citationIds: stepById.get(formulaId)?.citationIds ?? [],
  }))
  const warnings = [...commonWarnings]
  const citationIds = [...new Set([
    "adoption-resolution-article-1",
    "claim-hazard",
    "claim-map-figure-pga",
    "claim-map-figure-ss",
    "claim-map-figure-s1",
    "claim-site-factor-tables",
    ...steps.flatMap(({ citationIds }) => citationIds),
    ...branches.flatMap(({ citationIds }) => citationIds),
    ...warnings.flatMap(({ citationIds }) => citationIds),
  ])]
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "ok",
    engine: engineIdentity,
    study: { id: CCP14_STUDY_ID, version: CCP14_STUDY_VERSION },
    scenarioEvidenceKey: evidenceKey(input.soilClass, hazard.id),
    scenarioType: "ccp14",
    normalizedInputs: input,
    points,
    metrics,
    formulaIds: steps.map(({ id }) => id),
    branches,
    hazard,
    warnings,
    applicability: { status: "applicable" },
    sourceIds: [...SOURCE_IDS],
    citationIds,
    evidenceAvailability: { status: "available" },
    traceSchemaVersion: CCP14_TRACE_SCHEMA_VERSION,
    trace: {
      schemaId: CCP14_TRACE_SCHEMA_ID,
      schemaVersion: CCP14_TRACE_SCHEMA_VERSION,
      data: {
        schemaVersion: CCP14_TRACE_SCHEMA_VERSION,
        context: input,
        steps,
        branches: branches.map(({ id, formulaId }) => ({ id, formulaId })),
      },
    },
    capabilities: ccp14Capabilities,
  })
  return {
    ...data,
    saAt(tSeconds) {
      if (!Number.isFinite(tSeconds) || tSeconds < 0) {
        const applicability = {
          status: "invalid-input" as const,
          reasonCode: "ccp14-invalid-period",
          message: "El período debe ser finito y no negativo.",
          citationIds: [],
        }
        return normalizedSpectrumOrdinateSchema.parse({ status: "invalid-input", applicability })
      }
      return normalizedSpectrumOrdinateSchema.parse({
        status: "ok",
        point: normalizedPoint(engine, tSeconds),
      })
    },
  }
}

export function adaptCcp14Spectrum(input: unknown): NormalizedSpectrumResult {
  const result = computeCcp14Spectrum(input)
  if (result.status !== "ok") return failedResult(input, result)
  return successResult(result)
}

const ccp14ScenarioSchema = z
  .object({
    type: z.literal("ccp14"),
    studyId: z.literal(CCP14_STUDY_ID),
    studyVersion: z.literal(CCP14_STUDY_VERSION),
    inputs: ccp14ComputationInputSchema,
  })
  .strict()

const metadata = spectrumEngineMetadataSchema.parse({
  ...engineIdentity,
  capabilitySchemaVersion: SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  capabilities: ccp14Capabilities,
})

export const ccp14SpectrumEngine: SpectrumEngine<z.infer<typeof ccp14ScenarioSchema>> = {
  metadata,
  accepts(scenario): scenario is z.infer<typeof ccp14ScenarioSchema> {
    return ccp14ScenarioSchema.safeParse(scenario).success
  },
  compute(scenario) {
    const parsed = ccp14ScenarioSchema.safeParse(scenario)
    return parsed.success
      ? adaptCcp14Spectrum(parsed.data.inputs)
      : failedResult(scenario, {
          status: "invalid-input",
          reasonCode: "ccp14-invalid-scenario",
          message: z.prettifyError(parsed.error),
          citationIds: [],
        })
  },
}
