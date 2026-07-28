import {
  BOGOTA_TRACE_SCHEMA_VERSION,
  bogotaBoundaryPolicy,
  bogotaFormulaCitationId,
  bogotaTracePayloadSchema,
  bogotaValueEvidenceId,
  resolveBogotaFormulaEvidence,
  resolveBogotaValueEvidence,
  type BogotaTracePayload,
} from "./evidence"
import {
  bogotaBranchDefinitions,
  evaluateBogotaOrdinate,
  type BogotaBranchDefinition,
  type BogotaEnginePoint,
} from "./engine"

import type {
  NormalizedSpectrumPoint,
  SpectrumBranchMetadata,
  SpectrumMetric,
} from "../spectra/types"
import type {
  BogotaCanonicalRow,
  BogotaHazard,
  BogotaNormalizedInputs,
} from "./schema"

const fieldMetadata = {
  fa: { label: "Fa", unit: "dimensionless" },
  fv: { label: "Fv", unit: "dimensionless" },
  transition_start: { label: "T0", unit: "s" },
  transition_end: { label: "Tc", unit: "s" },
  long_period: { label: "TL", unit: "s" },
  ground_peak: { label: "A0", unit: "g" },
} as const

function directSteps(row: BogotaCanonicalRow): BogotaTracePayload["steps"] {
  return Object.entries(row.fields).map(([fieldId, value]) => {
    const evidenceId = bogotaValueEvidenceId(
      row.hazardId,
      row.optionId,
      fieldId,
    )
    const evidence = resolveBogotaValueEvidence(evidenceId)
    if (!evidence) throw new Error(`Missing Bogotá row evidence ${evidenceId}`)
    const metadata = fieldMetadata[fieldId as keyof typeof fieldMetadata]
    const derivedLineage = evidence.derivedLineage
    return {
      id: evidenceId,
      classification: evidence.provenance,
      label: metadata.label,
      value,
      unit: metadata.unit,
      dependencies:
        derivedLineage?.dependencies.map(({ valueId }) => valueId) ?? [],
      evidenceIds: [evidenceId],
      citationIds:
        evidence.provenance === "derived" && derivedLineage
          ? [
              derivedLineage.formulaCitationId,
              ...derivedLineage.dependencies.flatMap(
                ({ inputCitationIds }) => inputCitationIds,
              ),
            ]
          : [...evidence.citationIds],
      ...(derivedLineage
        ? {
            expression: derivedLineage.formula,
            substitution: derivedLineage.substitution,
          }
        : {}),
    }
  })
}

function constantSteps(hazard: BogotaHazard): BogotaTracePayload["steps"] {
  if (hazard.id === "design") {
    return [
      {
        id: "bogota-constant-aa",
        classification: "direct-source",
        label: "Aa",
        value: hazard.baseAccelerations.Aa,
        unit: "g",
        dependencies: [],
        evidenceIds: ["design-plateau"],
        citationIds: [bogotaFormulaCitationId("design-plateau")],
      },
      {
        id: "bogota-constant-av",
        classification: "direct-source",
        label: "Av",
        value: hazard.baseAccelerations.Av,
        unit: "g",
        dependencies: [],
        evidenceIds: ["design-decay"],
        citationIds: [bogotaFormulaCitationId("design-decay")],
      },
    ]
  }
  if (hazard.id === "limited-safety") {
    return [
      {
        id: "bogota-constant-ae",
        classification: "direct-source",
        label: "Ae",
        value: hazard.baseAccelerations.Ae,
        unit: "g",
        dependencies: [],
        evidenceIds: ["limited-plateau"],
        citationIds: [bogotaFormulaCitationId("limited-plateau")],
      },
    ]
  }
  return [
    {
      id: "bogota-constant-ad",
      classification: "direct-source",
      label: "Ad",
      value: hazard.baseAccelerations.Ad,
      unit: "g",
      dependencies: [],
      evidenceIds: ["damage-plateau"],
      citationIds: [bogotaFormulaCitationId("damage-plateau")],
    },
  ]
}

function valueId(
  row: BogotaCanonicalRow,
  fieldId: keyof BogotaCanonicalRow["fields"],
) {
  return bogotaValueEvidenceId(row.hazardId, row.optionId, fieldId)
}

function formulaDependencies(formulaId: string, row: BogotaCanonicalRow) {
  const fa = valueId(row, "fa")
  const fv = valueId(row, "fv")
  const t0 = valueId(row, "transition_start")
  const tl = valueId(row, "long_period")
  const a0 = valueId(row, "ground_peak")
  const importance = "bogota-input-importance-factor"
  switch (formulaId) {
    case "design-plateau":
      return ["bogota-constant-aa", fa, importance]
    case "design-decay":
      return ["bogota-constant-av", fv, importance]
    case "design-long":
      return ["bogota-constant-av", fv, tl, importance]
    case "limited-plateau":
      return ["bogota-constant-ae", fa, importance]
    case "limited-decay":
      return ["bogota-constant-ae", fv, importance]
    case "limited-long":
      return ["bogota-constant-ae", fv, tl, importance]
    case "damage-ramp":
      return [a0, "bogota-constant-ad", fa, t0]
    case "damage-plateau":
      return ["bogota-constant-ad", fa]
    case "damage-decay":
      return ["bogota-constant-ad", fv]
    case "damage-long":
      return ["bogota-constant-ad", fv, tl]
    default:
      throw new Error(`Unknown Bogotá production formula ${formulaId}`)
  }
}

function representativePeriod(formulaId: string, row: BogotaCanonicalRow) {
  if (formulaId.endsWith("long")) return row.fields.long_period * 2
  if (formulaId.endsWith("decay")) return row.fields.long_period
  if (formulaId === "damage-ramp") return 0
  return row.fields.transition_start
}

function formulaSteps(
  definitions: readonly BogotaBranchDefinition[],
  row: BogotaCanonicalRow,
  hazard: BogotaHazard,
  importanceFactor: number,
): BogotaTracePayload["steps"] {
  return definitions.map((definition) => {
    const evidence = resolveBogotaFormulaEvidence(definition.formulaId)
    if (!evidence) throw new Error(`Missing Bogotá formula ${definition.formulaId}`)
    const tSeconds = representativePeriod(definition.formulaId, row)
    const evaluated = evaluateBogotaOrdinate(
      tSeconds,
      row,
      hazard,
      importanceFactor,
    )
    return {
      id: definition.formulaId,
      classification: "derived",
      label: definition.formulaId,
      value: evaluated.saG,
      unit: "g",
      dependencies: formulaDependencies(definition.formulaId, row),
      evidenceIds: [definition.formulaId],
      citationIds: [bogotaFormulaCitationId(definition.formulaId)],
      expression: evidence.expression,
      substitution: `T=${tSeconds}; Fa=${row.fields.fa}; Fv=${row.fields.fv}; T0=${row.fields.transition_start}; Tc=${row.fields.transition_end}; TL=${row.fields.long_period}; A0=${row.fields.ground_peak}; I=${importanceFactor}; Sa=${evaluated.saG}`,
    }
  })
}

export function buildBogotaTrace(
  inputs: BogotaNormalizedInputs,
  row: BogotaCanonicalRow,
  hazard: BogotaHazard,
) {
  const definitions = bogotaBranchDefinitions[hazard.id]
  const steps: BogotaTracePayload["steps"] = [
    ...directSteps(row),
    {
      id: "bogota-input-importance-factor",
      classification: "user-input",
      label: "I",
      value: inputs.importanceFactor,
      unit: "dimensionless",
      dependencies: [],
      evidenceIds: [],
      citationIds: [],
    },
    ...constantSteps(hazard),
    ...formulaSteps(definitions, row, hazard, inputs.importanceFactor),
  ]
  return bogotaTracePayloadSchema.parse({
    schemaVersion: BOGOTA_TRACE_SCHEMA_VERSION,
    context: {
      zoneId: inputs.zoneId,
      hazardId: inputs.hazardId,
      importanceFactor: inputs.importanceFactor,
      boundaryPolicy: bogotaBoundaryPolicy,
    },
    steps,
    branches: definitions.map((definition) => ({
      id: definition.id,
      formulaId: definition.formulaId,
      domain: definition.domain,
      citationIds: [bogotaFormulaCitationId(definition.formulaId)],
    })),
  })
}

export function bogotaCitationsForFormula(
  formulaId: string,
  trace: BogotaTracePayload,
) {
  const stepById = new Map(trace.steps.map((step) => [step.id, step]))
  const formula = stepById.get(formulaId)
  if (!formula) throw new Error(`Missing formula trace step ${formulaId}`)
  return [
    ...new Set([
      ...formula.citationIds,
      ...formula.dependencies.flatMap(
        (dependencyId) => stepById.get(dependencyId)?.citationIds ?? [],
      ),
    ]),
  ]
}

export function normalizeBogotaPoint(
  point: BogotaEnginePoint,
  trace: BogotaTracePayload,
): NormalizedSpectrumPoint {
  return {
    ...point,
    citationIds: bogotaCitationsForFormula(point.formulaId, trace),
  }
}

export function bogotaMetrics(
  row: BogotaCanonicalRow,
  trace: BogotaTracePayload,
): SpectrumMetric[] {
  const stepById = new Map(trace.steps.map((step) => [step.id, step]))
  const directMetrics = Object.entries(row.fields).map(([fieldId, value]) => {
    const evidenceId = valueId(
      row,
      fieldId as keyof BogotaCanonicalRow["fields"],
    )
    const step = stepById.get(evidenceId)
    if (!step) throw new Error(`Missing metric lineage ${evidenceId}`)
    const metadata = fieldMetadata[fieldId as keyof typeof fieldMetadata]
    return {
      id: fieldId,
      label: metadata.label,
      value,
      unit: metadata.unit,
      formulaId: step.classification === "derived" ? step.id : null,
      dependencyIds:
        step.classification === "derived" ? [...step.dependencies] : [],
      citationIds: [...step.citationIds],
    } satisfies SpectrumMetric
  })
  const plateauFormulaId =
    row.hazardId === "design"
      ? "design-plateau"
      : row.hazardId === "limited-safety"
        ? "limited-plateau"
        : "damage-plateau"
  const plateau = stepById.get(plateauFormulaId)
  if (!plateau) throw new Error(`Missing plateau lineage ${plateauFormulaId}`)
  return [
    ...directMetrics,
    {
      id: "sa-plateau",
      label: "Sa meseta",
      value: plateau.value,
      unit: "g",
      formulaId: plateau.id,
      dependencyIds: [...plateau.dependencies],
      citationIds: bogotaCitationsForFormula(plateau.id, trace),
    },
  ]
}

export function bogotaBranchMetadata(
  definitions: readonly BogotaBranchDefinition[],
): SpectrumBranchMetadata[] {
  return definitions.map((definition) => ({
    id: definition.id,
    formulaId: definition.formulaId,
    citationIds: [bogotaFormulaCitationId(definition.formulaId)],
  }))
}
