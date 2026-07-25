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
    throw new Error(`Bogotá formula ${definition.formulaId} produced invalid Sa`)
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
    if (tSeconds <= transition_end) {
      return point(
        tSeconds,
        2.5 * hazard.baseAccelerations.Aa * fa * importanceFactor,
        plateau,
      )
    }
    if (tSeconds <= long_period) {
      return point(
        tSeconds,
        (1.2 * hazard.baseAccelerations.Av * fv * importanceFactor) / tSeconds,
        decay,
      )
    }
    return point(
      tSeconds,
      (1.2 *
        hazard.baseAccelerations.Av *
        fv *
        long_period *
        importanceFactor) /
        (tSeconds * tSeconds),
      long,
    )
  }

  if (hazard.id === "limited-safety") {
    const [plateau, decay, long] = bogotaBranchDefinitions["limited-safety"]
    if (tSeconds <= transition_end) {
      return point(
        tSeconds,
        2.5 * hazard.baseAccelerations.Ae * fa * importanceFactor,
        plateau,
      )
    }
    if (tSeconds <= long_period) {
      return point(
        tSeconds,
        (1.2 * hazard.baseAccelerations.Ae * fv * importanceFactor) / tSeconds,
        decay,
      )
    }
    return point(
      tSeconds,
      (1.2 *
        hazard.baseAccelerations.Ae *
        fv *
        long_period *
        importanceFactor) /
        (tSeconds * tSeconds),
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
  if (tSeconds <= transition_end) {
    return point(tSeconds, 3 * hazard.baseAccelerations.Ad * fa, plateau)
  }
  if (tSeconds <= long_period) {
    return point(
      tSeconds,
      (1.5 * hazard.baseAccelerations.Ad * fv) / tSeconds,
      decay,
    )
  }
  return point(
    tSeconds,
    (1.5 * hazard.baseAccelerations.Ad * fv * long_period) /
      (tSeconds * tSeconds),
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
