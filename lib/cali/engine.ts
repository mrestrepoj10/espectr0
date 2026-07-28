import canonicalJson from "./data/canonical.json"

export const CALI_SUPPORTED_HAZARDS = ["design", "safety-limited"] as const

export type CaliSupportedHazardId = (typeof CALI_SUPPORTED_HAZARDS)[number]
export type CaliHazardId = CaliSupportedHazardId | "damage-threshold"
export type CaliBranchId = "plateau" | "inverse" | "inverse-square"

export type CaliEnginePoint = {
  tSeconds: number
  saG: number
  branchId: CaliBranchId
}

export type CaliSpectrumResult =
  | {
      status: "ok"
      optionId: string
      hazardId: CaliSupportedHazardId
      point: CaliEnginePoint
    }
  | {
      status: "unsupported"
      reasonCode: "cali-damage-inputs-missing"
      message: string
    }
  | {
      status: "invalid-input"
      reasonCode: "cali-invalid-input"
      message: string
    }

type CanonicalRow = (typeof canonicalJson.rows)[number]

const supportedHazards = new Set<string>(CALI_SUPPORTED_HAZARDS)
const rows = new Map(
  canonicalJson.rows.map((row) => [`${row.optionId}/${row.hazardId}`, row]),
)
const baseAcceleration = new Map(
  canonicalJson.hazards.map((hazard) => [hazard.id, hazard.baseAccelerationG]),
)

export function findCaliRow(optionId: string, hazardId: CaliHazardId) {
  return rows.get(`${optionId}/${hazardId}`) ?? null
}

function evaluateSupportedOrdinate(
  tSeconds: number,
  row: CanonicalRow,
  hazardId: CaliSupportedHazardId,
  importanceFactor: number,
): CaliEnginePoint {
  const tc = row.fields["column-1"]
  const fa = row.fields["column-2"]
  const tl = row.fields["column-3"]
  const fv = row.fields["column-4"]
  const acceleration = baseAcceleration.get(hazardId)

  if (acceleration === undefined) {
    throw new Error(`Missing Cali base acceleration for ${hazardId}`)
  }

  if (tSeconds <= tc) {
    return {
      tSeconds,
      saG: 2.5 * acceleration * fa * importanceFactor,
      branchId: "plateau",
    }
  }

  const velocityScale = 1.2 * acceleration * fv
  if (tSeconds <= tl) {
    return {
      tSeconds,
      saG: (velocityScale / tSeconds) * importanceFactor,
      branchId: "inverse",
    }
  }

  return {
    tSeconds,
    saG:
      (importanceFactor / tSeconds) *
      velocityScale *
      (tl / tSeconds),
    branchId: "inverse-square",
  }
}

export function evaluateCaliOrdinate(input: {
  optionId: string
  hazardId: CaliHazardId
  tSeconds: number
  importanceFactor?: number
}): CaliSpectrumResult {
  const importanceFactor = input.importanceFactor ?? 1
  if (
    !input.optionId ||
    !Number.isFinite(input.tSeconds) ||
    input.tSeconds < 0 ||
    !Number.isFinite(importanceFactor) ||
    importanceFactor <= 0
  ) {
    return {
      status: "invalid-input",
      reasonCode: "cali-invalid-input",
      message: "La zona, el periodo y el factor de importancia deben ser válidos.",
    }
  }

  if (input.hazardId === "damage-threshold") {
    return {
      status: "unsupported",
      reasonCode: "cali-damage-inputs-missing",
      message:
        "El Decreto 0158 de 2014 no publica A0d ni Fa para las ramas T ≤ Tcd; no se calcula una curva de daño incompleta.",
    }
  }

  if (!supportedHazards.has(input.hazardId)) {
    return {
      status: "invalid-input",
      reasonCode: "cali-invalid-input",
      message: "El nivel de amenaza de Cali no es válido.",
    }
  }

  const row = findCaliRow(input.optionId, input.hazardId)
  if (!row) {
    return {
      status: "invalid-input",
      reasonCode: "cali-invalid-input",
      message: "La combinación zona × amenaza no existe en la tabla adoptada.",
    }
  }

  const point = evaluateSupportedOrdinate(
    input.tSeconds,
    row,
    input.hazardId,
    importanceFactor,
  )
  if (!Number.isFinite(point.saG) || point.saG < 0) {
    return {
      status: "invalid-input",
      reasonCode: "cali-invalid-input",
      message: "La ordenada solicitada no puede representarse de forma finita.",
    }
  }

  return {
    status: "ok",
    optionId: input.optionId,
    hazardId: input.hazardId,
    point,
  }
}
