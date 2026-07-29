import { findDosquebradasRow, type DosquebradasZoneId } from "./schema"

export type DosquebradasBranchId =
  | "dosquebradas-plateau"
  | "dosquebradas-inverse"
  | "dosquebradas-inverse-square"

export type DosquebradasFormulaId =
  | "dosquebradas-nsr10-a.2.6-3"
  | "dosquebradas-nsr10-a.2.6-1"
  | "dosquebradas-nsr10-a.2.6-5"

export const dosquebradasFormulaByBranch: Record<
  DosquebradasBranchId,
  DosquebradasFormulaId
> = {
  "dosquebradas-plateau": "dosquebradas-nsr10-a.2.6-3",
  "dosquebradas-inverse": "dosquebradas-nsr10-a.2.6-1",
  "dosquebradas-inverse-square": "dosquebradas-nsr10-a.2.6-5",
}

export type DosquebradasOrdinate =
  | {
      status: "ok"
      point: {
        tSeconds: number
        saG: number
        branchId: DosquebradasBranchId
        formulaId: DosquebradasFormulaId
      }
    }
  | { status: "invalid-input"; message: string }
  | { status: "unsupported"; message: string }

export function deriveDosquebradasAv(
  zoneId: DosquebradasZoneId,
): number {
  const row = findDosquebradasRow(zoneId)
  if (!row) throw new Error(`Unknown Dosquebradas zone: ${zoneId}`)
  const { tc, aa, fa, fv } = row.fields
  return (tc * aa * fa) / (0.48 * fv)
}

export function evaluateDosquebradasOrdinate(input: {
  zoneId: DosquebradasZoneId
  tSeconds: number
  importanceFactor: number
}): DosquebradasOrdinate {
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
  const row = findDosquebradasRow(zoneId)
  if (!row) {
    return { status: "invalid-input", message: "La zona manual no existe." }
  }
  const { to, tc, tl, aa, fa, fv } = row.fields
  if (tSeconds < to) {
    return {
      status: "unsupported",
      message: `La Tabla 27 fija To=${to} s, pero el paquete oficial no publica una rama de entrada verificable para T < To.`,
    }
  }

  const av = deriveDosquebradasAv(zoneId)
  let branchId: DosquebradasBranchId
  let saG: number
  if (tSeconds <= tc) {
    branchId = "dosquebradas-plateau"
    saG = 2.5 * aa * fa * importanceFactor
  } else if (tSeconds <= tl) {
    branchId = "dosquebradas-inverse"
    saG = (1.2 * av * fv * importanceFactor) / tSeconds
  } else {
    branchId = "dosquebradas-inverse-square"
    saG = (1.2 * av * fv * tl * importanceFactor) / tSeconds ** 2
  }
  if (!Number.isFinite(saG) || saG < 0) {
    return {
      status: "unsupported",
      message: "La ordenada no puede representarse como un número finito.",
    }
  }
  return {
    status: "ok",
    point: {
      tSeconds,
      saG,
      branchId,
      formulaId: dosquebradasFormulaByBranch[branchId],
    },
  }
}
