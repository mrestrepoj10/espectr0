import {
  bogotaCanonical,
  type BogotaCanonicalRow,
  type BogotaHazard,
  type BogotaHazardId,
  type BogotaNormalizedInputs,
} from "./schema"

export const BOGOTA_SAMPLE_STEP_SECONDS = 0.025 as const
export const BOGOTA_FILL_SITE_SPECIFIC_THRESHOLD_METERS = 3 as const
export const BOGOTA_RIGID_BASE_SITE_SPECIFIC_THRESHOLD_SECONDS = 2.5 as const

export const bogotaBranchDefinitions = {
  design: [
    {
      id: "bogota-design-plateau",
      formulaId: "design-plateau",
      domain: "0 <= T <= Tc (tabulated)",
    },
    {
      id: "bogota-design-decay",
      formulaId: "design-decay",
      domain: "Tc (tabulated) < T <= TL",
    },
    {
      id: "bogota-design-long",
      formulaId: "design-long",
      domain: "T > TL",
    },
  ],
  "limited-safety": [
    {
      id: "bogota-limited-plateau",
      formulaId: "limited-plateau",
      domain: "0 <= T <= Tc (tabulated)",
    },
    {
      id: "bogota-limited-decay",
      formulaId: "limited-decay",
      domain: "Tc (tabulated) < T <= TL",
    },
    {
      id: "bogota-limited-long",
      formulaId: "limited-long",
      domain: "T > TL",
    },
  ],
  "damage-threshold": [
    {
      id: "bogota-damage-ramp",
      formulaId: "damage-ramp",
      domain: "0 <= T < T0d (tabulated)",
    },
    {
      id: "bogota-damage-plateau",
      formulaId: "damage-plateau",
      domain: "T0d (tabulated) <= T <= Tcd (tabulated)",
    },
    {
      id: "bogota-damage-decay",
      formulaId: "damage-decay",
      domain: "Tcd (tabulated) < T <= TLd",
    },
    {
      id: "bogota-damage-long",
      formulaId: "damage-long",
      domain: "T > TLd",
    },
  ],
} as const

export type BogotaBranchDefinition =
  (typeof bogotaBranchDefinitions)[BogotaHazardId][number]

export type BogotaEnginePoint = {
  tSeconds: number
  saG: number
  branchId: BogotaBranchDefinition["id"]
  formulaId: BogotaBranchDefinition["formulaId"]
}

export type BogotaSpectrumPreflight =
  | { status: "ok"; points: BogotaEnginePoint[] }
  | {
      status: "unsupported"
      reasonCode: "bogota-numerical-representation-unsupported"
      message: string
    }

export class BogotaNumericalRepresentationError extends RangeError {
  readonly code = "bogota-numerical-representation-unsupported" as const

  constructor(formulaId: string) {
    super(`Bogotá formula ${formulaId} produced an unrepresentable Sa`)
    this.name = "BogotaNumericalRepresentationError"
  }
}

const rowBySelection = new Map(
  bogotaCanonical.rows.map((row) => [
    `${row.optionId}/${row.hazardId}`,
    row,
  ]),
)
const hazardById = new Map(
  bogotaCanonical.hazards.map((hazard) => [hazard.id, hazard]),
)

export function findBogotaRow(zoneId: string, hazardId: BogotaHazardId) {
  return rowBySelection.get(`${zoneId}/${hazardId}`) ?? null
}

export function findBogotaHazard(hazardId: BogotaHazardId) {
  return hazardById.get(hazardId) ?? null
}

export function bogotaSiteSpecificReason(inputs: BogotaNormalizedInputs) {
  if (
    inputs.fillThicknessMeters !== null &&
    inputs.fillThicknessMeters > BOGOTA_FILL_SITE_SPECIFIC_THRESHOLD_METERS
  ) {
    return "fill-thickness-over-3m" as const
  }
  if (
    inputs.rigidBasePeriodSeconds !== null &&
    inputs.rigidBasePeriodSeconds >
      BOGOTA_RIGID_BASE_SITE_SPECIFIC_THRESHOLD_SECONDS
  ) {
    return "rigid-base-period-over-2.5s" as const
  }
  return null
}

function point(
  tSeconds: number,
  saG: number,
  definition: BogotaBranchDefinition,
): BogotaEnginePoint {
  if (!Number.isFinite(saG) || saG < 0) {
    throw new BogotaNumericalRepresentationError(definition.formulaId)
  }
  return {
    tSeconds,
    saG,
    branchId: definition.id,
    formulaId: definition.formulaId,
  }
}

export function evaluateBogotaOrdinate(
  tSeconds: number,
  row: BogotaCanonicalRow,
  hazard: BogotaHazard,
  importanceFactor: number,
): BogotaEnginePoint {
  const { fa, fv, transition_start, transition_end, long_period, ground_peak } =
    row.fields

  if (hazard.id === "design") {
    const [plateau, decay, long] = bogotaBranchDefinitions.design
    const plateauScale = 2.5 * hazard.baseAccelerations.Aa * fa
    const velocityScale = 1.2 * hazard.baseAccelerations.Av * fv
    if (tSeconds <= transition_end) {
      return point(
        tSeconds,
        plateauScale * importanceFactor,
        plateau,
      )
    }
    if (tSeconds <= long_period) {
      return point(
        tSeconds,
        (velocityScale / tSeconds) * importanceFactor,
        decay,
      )
    }
    return point(
      tSeconds,
      ((velocityScale * (long_period / tSeconds)) * importanceFactor) /
        tSeconds,
      long,
    )
  }

  if (hazard.id === "limited-safety") {
    const [plateau, decay, long] = bogotaBranchDefinitions["limited-safety"]
    const plateauScale = 2.5 * hazard.baseAccelerations.Ae * fa
    const velocityScale = 1.2 * hazard.baseAccelerations.Ae * fv
    if (tSeconds <= transition_end) {
      return point(
        tSeconds,
        plateauScale * importanceFactor,
        plateau,
      )
    }
    if (tSeconds <= long_period) {
      return point(
        tSeconds,
        (velocityScale / tSeconds) * importanceFactor,
        decay,
      )
    }
    return point(
      tSeconds,
      ((velocityScale * (long_period / tSeconds)) * importanceFactor) /
        tSeconds,
      long,
    )
  }

  const [ramp, plateau, decay, long] =
    bogotaBranchDefinitions["damage-threshold"]
  if (tSeconds < transition_start) {
    return point(
      tSeconds,
      ground_peak +
        ((3 * hazard.baseAccelerations.Ad * fa - ground_peak) /
          transition_start) *
          tSeconds,
      ramp,
    )
  }
  const velocityScale = 1.5 * hazard.baseAccelerations.Ad * fv
  if (tSeconds <= transition_end) {
    return point(tSeconds, 3 * hazard.baseAccelerations.Ad * fa, plateau)
  }
  if (tSeconds <= long_period) {
    return point(
      tSeconds,
      velocityScale / tSeconds,
      decay,
    )
  }
  return point(
    tSeconds,
    (velocityScale * (long_period / tSeconds)) / tSeconds,
    long,
  )
}

function roundedPeriod(value: number) {
  return Number(value.toFixed(9))
}

export function bogotaSamplePeriods(row: BogotaCanonicalRow) {
  const maximumPeriod = Math.max(6, row.fields.long_period * 2)
  const periods = new Set<number>([
    0,
    row.fields.transition_start,
    row.fields.transition_end,
    row.fields.long_period,
    maximumPeriod,
  ])
  const sampleCount = Math.round(maximumPeriod / BOGOTA_SAMPLE_STEP_SECONDS)
  for (let index = 0; index <= sampleCount; index += 1) {
    periods.add(roundedPeriod(index * BOGOTA_SAMPLE_STEP_SECONDS))
  }
  return [...periods].sort((left, right) => left - right)
}

export function sampleBogotaSpectrum(
  row: BogotaCanonicalRow,
  hazard: BogotaHazard,
  importanceFactor: number,
) {
  return bogotaSamplePeriods(row).map((tSeconds) =>
    evaluateBogotaOrdinate(tSeconds, row, hazard, importanceFactor),
  )
}

export function preflightBogotaSpectrum(
  row: BogotaCanonicalRow,
  hazard: BogotaHazard,
  importanceFactor: number,
): BogotaSpectrumPreflight {
  try {
    const points = sampleBogotaSpectrum(row, hazard, importanceFactor)
    if (
      points.some(
        ({ tSeconds, saG }) =>
          !Number.isFinite(tSeconds) || !Number.isFinite(saG),
      )
    ) {
      throw new BogotaNumericalRepresentationError("spectrum-preflight")
    }
    return { status: "ok", points }
  } catch (error) {
    if (error instanceof BogotaNumericalRepresentationError) {
      return {
        status: "unsupported",
        reasonCode: error.code,
        message:
          "El espectro solicitado no puede representarse como números finitos.",
      }
    }
    throw error
  }
}
