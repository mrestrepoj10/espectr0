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
import canonicalJson from "./data/canonical.json"
import claimsMatrix from "./evidence/claims-matrix.json"
import formulaInventory from "./evidence/formula-inventory.json"
import evidenceManifest from "./evidence/manifest.json"
import { evaluateCaliOrdinate, findCaliRow } from "./engine"
import "./study-relations"

import type { SpectrumEngine } from "../spectra/engine"
import type {
  NormalizedInputs,
  NormalizedSpectrumPoint,
  NormalizedSpectrumResult,
  SpectrumWarning,
} from "../spectra/types"
import type { CaliBranchId, CaliHazardId, CaliSupportedHazardId } from "./engine"

export const caliCanonical = canonicalJson

export const CALI_STUDY_ID = "cali-microzonation" as const
export const CALI_STUDY_VERSION = "D0158-2014/INGEOMINAS-DAGMA-2005-v1" as const
export const CALI_ENGINE_ID = "cali-spectrum" as const
export const CALI_ENGINE_VERSION = "1" as const
export const CALI_TRACE_SCHEMA_ID = "cali-spectrum-trace" as const
export const CALI_TRACE_SCHEMA_VERSION = 1 as const

const optionIds = new Set(canonicalJson.curveComponents.map(({ id }) => id))
const hazardIds = new Set(canonicalJson.hazards.map(({ id }) => id))
const hazardMetadata = new Map(canonicalJson.hazards.map((hazard) => [hazard.id, hazard]))
const sourceIds = new Set(evidenceManifest.sources.map(({ id }) => id))
const manifestCitationIds = new Set(evidenceManifest.citations.map(({ id }) => id))
const approvedFormulaIds = new Set(formulaInventory.formulas.map(({ id }) => id))
const approvedClaimIds = new Set(claimsMatrix.claims.map(({ id }) => id))
if (canonicalJson.ancillary.uncontrolledFillAmplification !== 1.2) {
  throw new Error("Unexpected Cali site amplification coefficient")
}

const caliOptionIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => optionIds.has(value), "Unknown Cali curve component")
const caliHazardIdSchema = z.enum(["design", "safety-limited", "damage-threshold"])
export const caliComputationInputSchema = z
  .object({
    optionId: caliOptionIdSchema,
    hazardId: caliHazardIdSchema,
    importanceFactor: z.number().finite().positive().default(1),
    uncontrolledFillThicknessMeters: z.number().finite().nonnegative().nullable(),
    colluvialDeposit: z.boolean(),
  })
  .strict()

export const caliCapabilities = spectrumCapabilitiesSchema.parse({
  comparison: unsupportedCapability(
    "El comparador actual todavía no consume escenarios municipales normalizados.",
  ),
  contextualPdf: unsupportedCapability(
    "La memoria PDF municipal genérica todavía no está instalada para Cali.",
  ),
  csvExport: supportedCapability(),
  etabsExport: supportedCapability(),
  jsonExport: supportedCapability(),
  svgPngExport: supportedCapability(),
  buildingBaseShear: unsupportedCapability(
    "El flujo de cortante basal actual todavía es exclusivo de NSR-10 nacional.",
  ),
  fheWorkflow: unsupportedCapability(
    "El flujo FHE actual todavía es exclusivo de NSR-10 nacional.",
  ),
  bridgeRFactorWorkflow: unsupportedCapability(
    "El estudio municipal de edificaciones no define el flujo de puentes CCP-14.",
  ),
  traceabilityViewer: unsupportedCapability(
    "El visor municipal se habilitará cuando pueda resolver las regiones del PDF oficial.",
  ),
})

const engineIdentity = {
  id: CALI_ENGINE_ID,
  version: CALI_ENGINE_VERSION,
  studyId: CALI_STUDY_ID,
  studyVersion: CALI_STUDY_VERSION,
  scenarioType: "municipal-study" as const,
}

const formulaByBranch: Record<CaliBranchId, string> = {
  plateau: "design-safety-minimum-plateau",
  inverse: "design-safety-minimum-inverse",
  "inverse-square": "design-safety-minimum-inverse-square",
}

const formulaCitation = (formulaId: string) => `formula-${formulaId}`
const cellCitation = (hazardId: string, optionId: string, column: number) =>
  `cell-${hazardId}-${optionId}-column-${column}`

function citationResolves(citationId: string) {
  if (manifestCitationIds.has(citationId)) return true
  if (citationId.startsWith("formula-")) {
    return approvedFormulaIds.has(citationId.slice("formula-".length))
  }
  if (citationId.startsWith("claim-")) {
    return approvedClaimIds.has(citationId.slice("claim-".length))
  }
  return false
}

export function assertCaliLineageResolves(
  result: ReturnType<typeof normalizedSpectrumResultDataSchema.parse>,
) {
  for (const sourceId of result.sourceIds) {
    if (!sourceIds.has(sourceId)) throw new Error(`Unknown Cali source ${sourceId}`)
  }
  for (const citationId of result.citationIds) {
    if (!citationResolves(citationId)) {
      throw new Error(`Unknown Cali citation ${citationId}`)
    }
  }
  if (result.status !== "ok") return
  const stepIds = new Set(result.trace.data.steps.map(({ id }) => id))
  for (const step of result.trace.data.steps) {
    for (const dependencyId of step.dependencies) {
      if (!stepIds.has(dependencyId)) {
        throw new Error(`Cali trace dependency does not resolve: ${dependencyId}`)
      }
    }
    const citationIds = "citationIds" in step && Array.isArray(step.citationIds)
      ? step.citationIds
      : []
    for (const citationId of citationIds) {
      if (typeof citationId !== "string" || !citationResolves(citationId)) {
        throw new Error(`Cali trace citation does not resolve: ${String(citationId)}`)
      }
    }
  }
}

const baseWarnings: SpectrumWarning[] = [
  {
    severity: "warning",
    code: "manual-zone-validation-required",
    message:
      "La selección es manual; el profesional responsable debe validar la zona contra la publicación oficial.",
    citationIds: ["claim-adoption"],
  },
  {
    severity: "warning",
    code: "concurrent-curves",
    message:
      "En las zonas 4B, 4C y 5 deben verificarse independientemente las dos curvas concurrentes Tc y TL.",
    citationIds: ["claim-concurrent-curves"],
  },
  {
    severity: "warning",
    code: "boundary-band",
    message:
      "En la franja de 200 m a cada lado de un límite se promedian los espectros adyacentes período a período.",
    citationIds: ["claim-boundary-band"],
  },
  {
    severity: "warning",
    code: "site-specific-long-period",
    message:
      "Para períodos estructurales mayores que 2,5 s el decreto exige un estudio de respuesta sísmica local.",
    citationIds: ["claim-long-period"],
  },
]

function normalizedHazard(hazardId: CaliHazardId) {
  const hazard = hazardMetadata.get(hazardId)
  if (!hazard) return null
  const labels: Record<CaliHazardId, string> = {
    design: "Diseño",
    "safety-limited": "Seguridad limitada",
    "damage-threshold": "Umbral de daño",
  }
  return {
    id: hazard.id,
    label: labels[hazard.id as CaliHazardId],
    returnPeriodYears: hazard.averageReturnPeriodYears,
    dampingRatio: hazard.dampingRatio,
  }
}

function invalidInputs(input: unknown): NormalizedInputs {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  return {
    optionId: typeof record.optionId === "string" && record.optionId ? record.optionId : null,
    hazardId: typeof record.hazardId === "string" && record.hazardId ? record.hazardId : null,
    importanceFactor:
      typeof record.importanceFactor === "number" && Number.isFinite(record.importanceFactor)
        ? record.importanceFactor
        : null,
    uncontrolledFillThicknessMeters:
      typeof record.uncontrolledFillThicknessMeters === "number" &&
      Number.isFinite(record.uncontrolledFillThicknessMeters)
        ? record.uncontrolledFillThicknessMeters
        : null,
    colluvialDeposit:
      typeof record.colluvialDeposit === "boolean" ? record.colluvialDeposit : null,
  }
}

function evidenceKey(optionId: string | null, hazardId: string | null) {
  return {
    studyId: CALI_STUDY_ID,
    studyVersion: CALI_STUDY_VERSION,
    optionId: optionId && optionIds.has(optionId) ? optionId : null,
    hazardId: hazardId && hazardIds.has(hazardId) ? hazardId : null,
  }
}

function failedResult(
  input: unknown,
  status: "invalid-input" | "unsupported",
  reasonCode: string,
  message: string,
): NormalizedSpectrumResult {
  const inputs = invalidInputs(input)
  const key = evidenceKey(
    typeof inputs.optionId === "string" ? inputs.optionId : null,
    typeof inputs.hazardId === "string" ? inputs.hazardId : null,
  )
  const citationIds =
    status === "unsupported"
      ? [formulaCitation("damage-ramp"), formulaCitation("damage-plateau")]
      : []
  const applicability = { status, reasonCode, message, citationIds }
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status,
    engine: engineIdentity,
    study: { id: CALI_STUDY_ID, version: CALI_STUDY_VERSION },
    scenarioEvidenceKey: key,
    scenarioType: "municipal-study",
    normalizedInputs: inputs,
    hazard: key.hazardId ? normalizedHazard(key.hazardId as CaliHazardId) : null,
    warnings: [],
    applicability,
    sourceIds: ["cali-decree-0158-2014", "cali-ingeominas-dagma-2005-tomo6"],
    citationIds,
    evidenceAvailability:
      status === "unsupported"
        ? {
            status: "partial",
            unavailableClaims: [
              {
                id: "damage-early-branches",
                reason: "El decreto no publica A0d ni Fa para completar T ≤ Tcd.",
              },
            ],
          }
        : { status: "unavailable", reason: "La entrada no resuelve una fila canónica." },
    traceSchemaVersion: CALI_TRACE_SCHEMA_VERSION,
    trace: null,
    capabilities: caliCapabilities,
  })
  assertCaliLineageResolves(data)
  return {
    ...data,
    saAt() {
      return normalizedSpectrumOrdinateSchema.parse({ status, applicability })
    },
  }
}

function normalizePoint(
  optionId: string,
  hazardId: CaliSupportedHazardId,
  tSeconds: number,
  importanceFactor: number,
  siteCoefficientMultiplier: 1 | 1.2,
): NormalizedSpectrumPoint {
  const result = evaluateCaliOrdinate({
    optionId,
    hazardId,
    tSeconds,
    importanceFactor,
    siteCoefficientMultiplier,
  })
  if (result.status !== "ok") throw new Error(result.message)
  const formulaId = formulaByBranch[result.point.branchId]
  return {
    ...result.point,
    formulaId,
    citationIds: [formulaCitation(formulaId)],
  }
}

function successResult(input: z.infer<typeof caliComputationInputSchema>): NormalizedSpectrumResult {
  const hazardId = input.hazardId as CaliSupportedHazardId
  const row = findCaliRow(input.optionId, hazardId)
  const hazard = normalizedHazard(hazardId)
  if (!row || !hazard) {
    return failedResult(input, "invalid-input", "cali-invalid-input", "La fila solicitada no existe.")
  }
  const tc = row.fields["column-1"]
  const fa = row.fields["column-2"]
  const tl = row.fields["column-3"]
  const fv = row.fields["column-4"]
  const acceleration = hazardMetadata.get(hazardId)?.baseAccelerationG
  if (acceleration === undefined) throw new Error("Missing Cali hazard acceleration")
  const siteCoefficientMultiplier: 1 | 1.2 =
    (input.uncontrolledFillThicknessMeters ?? 0) > 3 || input.colluvialDeposit
      ? 1.2
      : 1
  const effectiveFa = fa * siteCoefficientMultiplier
  const effectiveFv = fv * siteCoefficientMultiplier
  const warnings: SpectrumWarning[] = [
    ...baseWarnings,
    ...(siteCoefficientMultiplier > 1
      ? [{
          severity: "warning" as const,
          code: "fill-colluvium-amplification",
          message: "Se aumentaron Fa y Fv en 20% por la condición declarada de relleno no controlado mayor a 3 m o depósito coluvial.",
          citationIds: ["claim-fill-colluvium"],
        }]
      : []),
  ]

  const fieldValues = [tc, fa, tl, fv]
  const fieldLabels = ["Tc", "Fa", "TL", "Fv"]
  const fieldUnits = ["s", "dimensionless", "s", "dimensionless"]
  const directSteps = [
    {
      id: "cali-input-importance",
      classification: "user-input",
      label: "I",
      value: input.importanceFactor,
      unit: "dimensionless",
      dependencies: [],
      citationIds: [],
    },
    {
      id: "cali-input-fill-thickness",
      classification: "user-input",
      label: "Espesor de relleno no controlado",
      value: input.uncontrolledFillThicknessMeters,
      unit: "m",
      dependencies: [],
      citationIds: [],
    },
    {
      id: "cali-input-colluvial-deposit",
      classification: "user-input",
      label: "Depósito coluvial",
      value: input.colluvialDeposit,
      unit: "boolean",
      dependencies: [],
      citationIds: [],
    },
    {
      id: "cali-site-coefficient-multiplier",
      classification: "derived",
      label: "Multiplicador Fa/Fv",
      value: siteCoefficientMultiplier,
      unit: "dimensionless",
      dependencies: ["cali-input-fill-thickness", "cali-input-colluvial-deposit"],
      citationIds: ["claim-fill-colluvium"],
      expression: "M = 1.2 si relleno no controlado > 3 m o depósito coluvial; de lo contrario M = 1",
      substitution: `M = ${siteCoefficientMultiplier}`,
    },
    {
      id: "cali-base-acceleration",
      classification: "direct-source",
      label: "A",
      value: acceleration,
      unit: "g",
      dependencies: [],
      citationIds: Object.values(formulaByBranch).map(formulaCitation),
    },
    ...[1, 2, 3, 4].map((column) => ({
      id: `cali-${hazardId}-${input.optionId}-column-${column}`,
      classification: "direct-source",
      label: fieldLabels[column - 1],
      value: fieldValues[column - 1],
      unit: fieldUnits[column - 1],
      dependencies: [],
      citationIds: [cellCitation(hazardId, input.optionId, column)],
    })),
    {
      id: "cali-effective-fa",
      classification: "derived",
      label: "Fa efectivo",
      value: effectiveFa,
      unit: "dimensionless",
      dependencies: [`cali-${hazardId}-${input.optionId}-column-2`, "cali-site-coefficient-multiplier"],
      citationIds: siteCoefficientMultiplier > 1 ? ["claim-fill-colluvium"] : [],
      expression: "Fa efectivo = Fa × multiplicador del sitio",
      substitution: `${fa} × ${siteCoefficientMultiplier} = ${effectiveFa}`,
    },
    {
      id: "cali-effective-fv",
      classification: "derived",
      label: "Fv efectivo",
      value: effectiveFv,
      unit: "dimensionless",
      dependencies: [`cali-${hazardId}-${input.optionId}-column-4`, "cali-site-coefficient-multiplier"],
      citationIds: siteCoefficientMultiplier > 1 ? ["claim-fill-colluvium"] : [],
      expression: "Fv efectivo = Fv × multiplicador del sitio",
      substitution: `${fv} × ${siteCoefficientMultiplier} = ${effectiveFv}`,
    },
  ]
  const activeBranchIds: CaliBranchId[] = [
    "plateau",
    ...(tc < 2.5 ? (["inverse"] as const) : []),
    ...(tl < 2.5 ? (["inverse-square"] as const) : []),
  ]
  const representativePeriods: Record<CaliBranchId, number> = {
    plateau: 0,
    inverse: Math.min(tl, 2.5),
    "inverse-square": (tl + 2.5) / 2,
  }
  const expressions: Record<CaliBranchId, string> = {
    plateau: "Sa = 2.5 A Fa I",
    inverse: "Sa = 1.2 A Fv I / T",
    "inverse-square": "Sa = 1.2 A Fv TL I / T²",
  }
  const formulaValue = (branchId: CaliBranchId) => {
    const point = normalizePoint(
      input.optionId,
      hazardId,
      representativePeriods[branchId],
      input.importanceFactor,
      siteCoefficientMultiplier,
    )
    return point.saG
  }
  const periodSteps = [
    ...(activeBranchIds.includes("inverse") ? [{
      id: "cali-representative-period-inverse",
      classification: "derived",
      label: "T representativo 1/T",
      value: representativePeriods.inverse,
      unit: "s",
      dependencies: [`cali-${hazardId}-${input.optionId}-column-3`],
      citationIds: [cellCitation(hazardId, input.optionId, 3), "claim-long-period"],
      expression: "T = min(TL, 2.5 s)",
      substitution: `min(${tl}, 2.5) = ${representativePeriods.inverse} s`,
    }] : []),
    ...(activeBranchIds.includes("inverse-square") ? [{
      id: "cali-representative-period-inverse-square",
      classification: "derived",
      label: "T representativo 1/T²",
      value: representativePeriods["inverse-square"],
      unit: "s",
      dependencies: [`cali-${hazardId}-${input.optionId}-column-3`],
      citationIds: [cellCitation(hazardId, input.optionId, 3), "claim-long-period"],
      expression: "T = (TL + 2.5 s) / 2",
      substitution: `(${tl} + 2.5) / 2 = ${representativePeriods["inverse-square"]} s`,
    }] : []),
  ]
  const formulaSteps = [
    {
      id: formulaByBranch.plateau,
      classification: "derived",
      label: "Sa meseta",
      value: formulaValue("plateau"),
      unit: "g",
      dependencies: ["cali-base-acceleration", "cali-effective-fa", "cali-input-importance"],
      citationIds: [formulaCitation(formulaByBranch.plateau)],
      expression: expressions.plateau,
      substitution: `2.5 × ${acceleration} × ${effectiveFa} × ${input.importanceFactor} = ${formulaValue("plateau")} g`,
    },
    ...(activeBranchIds.includes("inverse") ? [{
      id: formulaByBranch.inverse,
      classification: "derived",
      label: "Sa 1/T",
      value: formulaValue("inverse"),
      unit: "g",
      dependencies: ["cali-base-acceleration", "cali-effective-fv", "cali-input-importance", "cali-representative-period-inverse"],
      citationIds: [formulaCitation(formulaByBranch.inverse)],
      expression: expressions.inverse,
      substitution: `1.2 × ${acceleration} × ${effectiveFv} × ${input.importanceFactor} / ${representativePeriods.inverse} = ${formulaValue("inverse")} g`,
    }] : []),
    ...(activeBranchIds.includes("inverse-square") ? [{
      id: formulaByBranch["inverse-square"],
      classification: "derived",
      label: "Sa 1/T²",
      value: formulaValue("inverse-square"),
      unit: "g",
      dependencies: ["cali-base-acceleration", "cali-effective-fv", `cali-${hazardId}-${input.optionId}-column-3`, "cali-input-importance", "cali-representative-period-inverse-square"],
      citationIds: [formulaCitation(formulaByBranch["inverse-square"])],
      expression: expressions["inverse-square"],
      substitution: `1.2 × ${acceleration} × ${effectiveFv} × ${tl} × ${input.importanceFactor} / (${representativePeriods["inverse-square"]})² = ${formulaValue("inverse-square")} g`,
    }] : []),
  ]
  const branches = activeBranchIds.map((branchId) => ({
    id: branchId,
    formulaId: formulaByBranch[branchId],
    citationIds: [formulaCitation(formulaByBranch[branchId])],
  }))
  const trace = {
    schemaVersion: CALI_TRACE_SCHEMA_VERSION,
    context: {
      optionId: input.optionId,
      hazardId,
      importanceFactor: input.importanceFactor,
      uncontrolledFillThicknessMeters: input.uncontrolledFillThicknessMeters,
      colluvialDeposit: input.colluvialDeposit,
      siteCoefficientMultiplier,
    },
    steps: [...directSteps, ...periodSteps, ...formulaSteps],
    branches: branches.map(({ id, formulaId }) => ({ id, formulaId })),
  }
  const endPeriod = 2.5
  const periods = Array.from({ length: Math.round(endPeriod / 0.01) + 1 }, (_, index) =>
    Number((index * 0.01).toFixed(8)),
  )
  const points = periods.map((period) =>
    normalizePoint(input.optionId, hazardId, period, input.importanceFactor, siteCoefficientMultiplier),
  )
  const directMetrics = [
    { id: "tc", label: "Tc", value: tc, unit: "s" as const, citation: 1 },
    { id: "fa", label: "Fa", value: fa, unit: "dimensionless" as const, citation: 2 },
    { id: "tl", label: "TL", value: tl, unit: "s" as const, citation: 3 },
    { id: "fv", label: "Fv", value: fv, unit: "dimensionless" as const, citation: 4 },
    { id: "a", label: "A", value: acceleration, unit: "g" as const, citation: null },
    { id: "i", label: "I", value: input.importanceFactor, unit: "dimensionless" as const, citation: null },
  ].map((metric) => ({
    id: metric.id,
    label: metric.label,
    value: metric.value,
    unit: metric.unit,
    formulaId: null,
    dependencyIds: [],
    citationIds:
      metric.citation === null ? [] : [cellCitation(hazardId, input.optionId, metric.citation)],
  }))
  const plateauFormula = formulaByBranch.plateau
  const plateauStep = formulaSteps.find(({ id }) => id === plateauFormula)
  if (!plateauStep) throw new Error("Missing Cali plateau trace")
  const metrics = [
    ...directMetrics,
    {
      id: "faEffective",
      label: "Fa efectivo",
      value: effectiveFa,
      unit: "dimensionless" as const,
      formulaId: "cali-effective-fa",
      dependencyIds: [`cali-${hazardId}-${input.optionId}-column-2`, "cali-site-coefficient-multiplier"],
      citationIds: siteCoefficientMultiplier > 1 ? ["claim-fill-colluvium"] : [],
    },
    {
      id: "fvEffective",
      label: "Fv efectivo",
      value: effectiveFv,
      unit: "dimensionless" as const,
      formulaId: "cali-effective-fv",
      dependencyIds: [`cali-${hazardId}-${input.optionId}-column-4`, "cali-site-coefficient-multiplier"],
      citationIds: siteCoefficientMultiplier > 1 ? ["claim-fill-colluvium"] : [],
    },
    {
      id: "saMax",
      label: "Sa máx",
      value: 2.5 * acceleration * effectiveFa * input.importanceFactor,
      unit: "g" as const,
      formulaId: plateauFormula,
      dependencyIds: plateauStep.dependencies,
      citationIds: [formulaCitation(plateauFormula), cellCitation(hazardId, input.optionId, 2)],
    },
  ]
  const citationIds = [
    ...new Set([
      ...[1, 2, 3, 4].map((column) => cellCitation(hazardId, input.optionId, column)),
      ...Object.values(formulaByBranch).map(formulaCitation),
      ...warnings.flatMap((warning) => warning.citationIds),
      "claim-return-periods",
    ]),
  ]
  const data = normalizedSpectrumResultDataSchema.parse({
    schemaVersion: SPECTRUM_CONTRACT_SCHEMA_VERSION,
    status: "ok",
    engine: engineIdentity,
    study: { id: CALI_STUDY_ID, version: CALI_STUDY_VERSION },
    scenarioEvidenceKey: evidenceKey(input.optionId, hazardId),
    scenarioType: "municipal-study",
    normalizedInputs: input,
    points,
    metrics,
    formulaIds: [...directSteps, ...periodSteps, ...formulaSteps].map(({ id }) => id),
    branches,
    hazard,
    warnings,
    applicability: { status: "applicable" },
    sourceIds: [
      "cali-decree-0158-2014",
      "cali-ingeominas-dagma-2005-tomo6",
      "nsr10-title-a-2017",
    ],
    citationIds,
    evidenceAvailability: { status: "available" },
    traceSchemaVersion: CALI_TRACE_SCHEMA_VERSION,
    trace: {
      schemaId: CALI_TRACE_SCHEMA_ID,
      schemaVersion: CALI_TRACE_SCHEMA_VERSION,
      data: trace,
    },
    capabilities: caliCapabilities,
  })
  assertCaliLineageResolves(data)
  return {
    ...data,
    saAt(tSeconds) {
      if (!Number.isFinite(tSeconds) || tSeconds < 0) {
        const applicability = {
          status: "invalid-input" as const,
          reasonCode: "cali-invalid-period",
          message: "El período debe ser finito y no negativo.",
          citationIds: [],
        }
        return normalizedSpectrumOrdinateSchema.parse({ status: "invalid-input", applicability })
      }
      if (tSeconds > 2.5) {
        const applicability = {
          status: "site-specific-study-required" as const,
          reasonCode: "cali-site-specific-long-period",
          message: "Para períodos mayores que 2,5 s el Decreto 0158 exige un estudio de respuesta sísmica local.",
          citationIds: ["claim-long-period"],
        }
        return normalizedSpectrumOrdinateSchema.parse({
          status: "site-specific-study-required",
          applicability,
        })
      }
      return normalizedSpectrumOrdinateSchema.parse({
        status: "ok",
        point: normalizePoint(
          input.optionId,
          hazardId,
          tSeconds,
          input.importanceFactor,
          siteCoefficientMultiplier,
        ),
      })
    },
  }
}

export function adaptCaliSpectrum(input: unknown): NormalizedSpectrumResult {
  const parsed = caliComputationInputSchema.safeParse(input)
  if (!parsed.success) {
    return failedResult(input, "invalid-input", "cali-invalid-input", z.prettifyError(parsed.error))
  }
  if (parsed.data.hazardId === "damage-threshold") {
    return failedResult(
      parsed.data,
      "unsupported",
      "cali-damage-inputs-missing",
      "El Decreto 0158 de 2014 no publica A0d ni Fa para T ≤ Tcd; no se calcula una curva de daño incompleta.",
    )
  }
  return successResult(parsed.data)
}

const caliScenarioSchema = z
  .object({
    type: z.literal("municipal-study"),
    studyId: z.literal(CALI_STUDY_ID),
    studyVersion: z.literal(CALI_STUDY_VERSION),
    inputs: caliComputationInputSchema,
  })
  .strict()

const metadata = spectrumEngineMetadataSchema.parse({
  ...engineIdentity,
  capabilitySchemaVersion: SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  capabilities: caliCapabilities,
})

export const caliSpectrumEngine: SpectrumEngine<z.infer<typeof caliScenarioSchema>> = {
  metadata,
  accepts(scenario): scenario is z.infer<typeof caliScenarioSchema> {
    return caliScenarioSchema.safeParse(scenario).success
  },
  compute(scenario) {
    const parsed = caliScenarioSchema.safeParse(scenario)
    return parsed.success
      ? adaptCaliSpectrum(parsed.data.inputs)
      : failedResult(scenario, "invalid-input", "cali-invalid-input", z.prettifyError(parsed.error))
  },
}
