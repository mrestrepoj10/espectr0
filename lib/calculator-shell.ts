import type { CapabilityDecision } from "./spectra"

export type CalculationModeOption = {
  id: string
  label: string
  description: string
  disabled?: boolean
  unavailableReason?: string
}

export type CapabilityUiState = {
  enabled: boolean
  reason: string | null
}

export type ParsedPeriodInput =
  | { status: "valid"; periodSeconds: number }
  | { status: "invalid"; message: string }

export function capabilityUiState(
  decision: CapabilityDecision,
): CapabilityUiState {
  return decision.supported
    ? { enabled: true, reason: null }
    : { enabled: false, reason: decision.reason }
}

export function parsePeriodInput(rawValue: string): ParsedPeriodInput {
  if (rawValue.trim() === "") {
    return { status: "invalid", message: "Ingresa un periodo en segundos." }
  }

  const periodSeconds = Number(rawValue)
  if (!Number.isFinite(periodSeconds) || periodSeconds < 0) {
    return {
      status: "invalid",
      message: "El periodo debe ser un número finito mayor o igual que cero.",
    }
  }

  return { status: "valid", periodSeconds }
}
