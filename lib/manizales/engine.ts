import { findManizalesRow, type ManizalesZoneId } from "./schema"

export type ManizalesBranchId =
  | "manizales-entrance"
  | "manizales-plateau"
  | "manizales-inverse"
  | "manizales-floor"

export type ManizalesFormulaId =
  | "manizales-entrance-branch"
  | "manizales-plateau-branch"
  | "manizales-inverse-branch"
  | "manizales-floor-branch"

export const manizalesFormulaByBranch: Record<ManizalesBranchId, ManizalesFormulaId> = {
  "manizales-entrance": "manizales-entrance-branch",
  "manizales-plateau": "manizales-plateau-branch",
  "manizales-inverse": "manizales-inverse-branch",
  "manizales-floor": "manizales-floor-branch",
}

export type ManizalesOrdinate =
  | {
      status: "ok"
      point: {
        tSeconds: number
        saG: number
        branchId: ManizalesBranchId
        formulaId: ManizalesFormulaId
      }
    }
  | { status: "invalid-input"; message: string }

/**
 * The four branches printed on Figura 8.1, in the order the sheet draws them.
 * Every parameter they consume is tabulated on Figura 8.5, so unlike the other
 * municipal engines this one has no unsupported interval — the curve is defined
 * for every non-negative period.
 */
export function evaluateManizalesOrdinate(input: {
  zoneId: ManizalesZoneId
  tSeconds: number
  importanceFactor: number
}): ManizalesOrdinate {
  const { zoneId, tSeconds, importanceFactor } = input
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
  const row = findManizalesRow(zoneId)
  if (!row) {
    return { status: "invalid-input", message: "La zona manual no existe." }
  }
  const { to, tc, tl, am, an, fa } = row.fields
  const fv = row.fields.fv
  const amI = am * importanceFactor

  let branchId: ManizalesBranchId
  let saG: number
  if (tSeconds <= to) {
    branchId = "manizales-entrance"
    saG = amI + (amI / to) * (2.5 * fa - 1) * tSeconds
  } else if (tSeconds <= tc) {
    branchId = "manizales-plateau"
    saG = 2.5 * amI * fa
  } else if (tSeconds <= tl) {
    branchId = "manizales-inverse"
    saG = (an * fv * importanceFactor) / tSeconds
  } else {
    branchId = "manizales-floor"
    saG = amI / 2
  }
  if (!Number.isFinite(saG) || saG < 0) {
    return {
      status: "invalid-input",
      message: "La ordenada no puede representarse como un número finito.",
    }
  }
  return {
    status: "ok",
    point: {
      tSeconds,
      saG,
      branchId,
      formulaId: manizalesFormulaByBranch[branchId],
    },
  }
}
