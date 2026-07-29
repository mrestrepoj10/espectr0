import {
  findMedellinRow,
  type MedellinHazardId,
  type MedellinZoneId,
} from "./schema"

export const MEDELLIN_MAX_PERIOD_SECONDS = 4 as const

export type MedellinBranchId = "medellin-plateau" | "medellin-power-decay"
export type MedellinFormulaId =
  | "medellin-formula-plateau"
  | "medellin-formula-power-decay"

export const medellinFormulaByBranch: Record<
  MedellinBranchId,
  MedellinFormulaId
> = {
  "medellin-plateau": "medellin-formula-plateau",
  "medellin-power-decay": "medellin-formula-power-decay",
}

export type MedellinOrdinate =
  | {
      status: "ok"
      point: {
        tSeconds: number
        saG: number
        branchId: MedellinBranchId
        formulaId: MedellinFormulaId
      }
    }
  | { status: "invalid-input"; message: string }
  | { status: "unsupported"; message: string; interval: "below-t0" | "above-4s" }

export function medellinSmax(input: {
  zoneId: MedellinZoneId
  hazardId: MedellinHazardId
  importanceFactor: number
}) {
  const row = findMedellinRow(input.zoneId, input.hazardId)
  if (!row) throw new Error(`Unknown Medellín row: ${input.zoneId}/${input.hazardId}`)
  return (
    row.fields.short_amplification *
    row.fields.ground_peak *
    input.importanceFactor
  )
}

export function evaluateMedellinOrdinate(input: {
  zoneId: MedellinZoneId
  hazardId: MedellinHazardId
  tSeconds: number
  importanceFactor: number
}): MedellinOrdinate {
  const { zoneId, hazardId, tSeconds, importanceFactor } = input
  if (!Number.isFinite(tSeconds) || tSeconds < 0) {
    return {
      status: "invalid-input",
      message: "El período debe ser finito y no negativo.",
    }
  }
  if (!Number.isFinite(importanceFactor) || importanceFactor <= 0) {
    return {
      status: "invalid-input",
      message: "El coeficiente de importancia debe ser finito y positivo.",
    }
  }
  const row = findMedellinRow(zoneId, hazardId)
  if (!row) {
    return {
      status: "invalid-input",
      message: "La combinación manual de zona y amenaza no existe.",
    }
  }
  const { plateau_start: t0, decay_start: tc, decay_exponent: alpha } = row.fields
  if (tSeconds < t0) {
    return {
      status: "unsupported",
      interval: "below-t0",
      message: `La fuente fija T0=${t0} s, pero no publica la ecuación de la rama ascendente para T < T0.`,
    }
  }
  if (tSeconds > MEDELLIN_MAX_PERIOD_SECONDS) {
    return {
      status: "unsupported",
      interval: "above-4s",
      message: `La fuente limita el espectro publicado a ${MEDELLIN_MAX_PERIOD_SECONDS} s.`,
    }
  }

  const smax = medellinSmax({ zoneId, hazardId, importanceFactor })
  const branchId: MedellinBranchId =
    tSeconds <= tc ? "medellin-plateau" : "medellin-power-decay"
  const saG = branchId === "medellin-plateau" ? smax : smax * (tc / tSeconds) ** alpha
  return {
    status: "ok",
    point: {
      tSeconds,
      saG,
      branchId,
      formulaId: medellinFormulaByBranch[branchId],
    },
  }
}
