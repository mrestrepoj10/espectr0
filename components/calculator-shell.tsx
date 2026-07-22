"use client"

import { useMemo, useState } from "react"
import { TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type CalculationModeOption,
  parsePeriodInput,
} from "@/lib/calculator-shell"

export type CalculatorApplicability =
  | "applicable"
  | "invalid-input"
  | "unsupported"
  | "not-applicable"
  | "site-specific-study-required"

export type CalculatorNotice = {
  code: string
  severity: "info" | "warning" | "error"
  title: string
  message: string
}

export type PeriodLookupValue =
  | { status: "ok"; saG: number; branchLabel?: string }
  | { status: "unavailable"; message: string }

const applicabilityLabels: Record<CalculatorApplicability, string> = {
  applicable: "Aplicable",
  "invalid-input": "Entrada inválida",
  unsupported: "No soportado",
  "not-applicable": "No aplicable",
  "site-specific-study-required": "Estudio específico requerido",
}

export function CalculatorShell({
  modes,
  value,
  onValueChange,
  inputPanel,
  children,
}: {
  modes: readonly CalculationModeOption[]
  value: string
  onValueChange: (value: string) => void
  inputPanel: React.ReactNode
  children: React.ReactNode
}) {
  const selectedMode = modes.find((mode) => mode.id === value)

  return (
    <section
      aria-labelledby="calculation-mode-heading"
      className="flex min-w-0 flex-col gap-5"
      data-calculation-mode={value}
      data-slot="calculator-shell"
    >
      <Card size="sm">
        <CardHeader>
          <CardTitle id="calculation-mode-heading">Modo de cálculo</CardTitle>
          <CardDescription>
            Selecciona el reglamento o estudio que gobierna el espectro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="calculation-mode-trigger">
                Reglamento o estudio
              </FieldLabel>
              <Select
                items={modes.map((mode) => ({
                  label: mode.label,
                  value: mode.id,
                }))}
                onValueChange={(nextValue) => {
                  if (nextValue) onValueChange(nextValue)
                }}
                value={value}
              >
                <SelectTrigger
                  aria-describedby="calculation-mode-description"
                  className="w-full sm:max-w-md"
                  id="calculation-mode-trigger"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} side="bottom">
                  <SelectGroup>
                    <SelectLabel>Modos disponibles</SelectLabel>
                    {modes.map((mode) => (
                      <SelectItem
                        disabled={mode.disabled}
                        key={mode.id}
                        value={mode.id}
                      >
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription id="calculation-mode-description">
                {selectedMode?.description ?? "Modo no disponible."}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside aria-label="Entradas del modo seleccionado" data-slot="mode-input-panel">
          {inputPanel}
        </aside>
        <div
          aria-label="Resultado del cálculo"
          className="flex min-w-0 flex-col gap-4"
          data-slot="calculator-results"
        >
          {children}
        </div>
      </div>
    </section>
  )
}

export function CalculatorResultHeader({
  title,
  description,
  applicability,
  highlight,
  actions,
}: {
  title: string
  description: string
  applicability: CalculatorApplicability
  highlight?: string
  actions?: React.ReactNode
}) {
  return (
    <CardHeader data-slot="calculator-result-header">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle aria-level={2} role="heading">
              {title}
            </CardTitle>
            <Badge
              variant={applicability === "applicable" ? "secondary" : "outline"}
            >
              {applicabilityLabels[applicability]}
            </Badge>
            {highlight ? <Badge variant="outline">{highlight}</Badge> : null}
          </div>
          <CardDescription>{description}</CardDescription>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2" data-slot="result-actions">
            {actions}
          </div>
        ) : null}
      </div>
    </CardHeader>
  )
}

export function CalculatorNotices({
  applicability,
  notices,
}: {
  applicability: CalculatorApplicability
  notices: readonly CalculatorNotice[]
}) {
  if (applicability === "applicable" && notices.length === 0) return null

  return (
    <section
      aria-label="Advertencias y aplicabilidad"
      className="flex flex-col gap-3"
      data-applicability={applicability}
      data-slot="calculator-notices"
    >
      {notices.map((notice) => (
        <Alert key={notice.code} variant={notice.severity === "error" ? "destructive" : "default"}>
          <TriangleAlertIcon />
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ))}
    </section>
  )
}

export function SpectrumPeriodLookup({
  evaluate,
  initialPeriod="1.000",
}: {
  evaluate: (periodSeconds: number) => PeriodLookupValue
  initialPeriod?: string
}) {
  const [rawPeriod, setRawPeriod] = useState(initialPeriod)
  const parsedPeriod = useMemo(() => parsePeriodInput(rawPeriod), [rawPeriod])
  const lookup = useMemo(
    () =>
      parsedPeriod.status === "valid"
        ? evaluate(parsedPeriod.periodSeconds)
        : null,
    [evaluate, parsedPeriod],
  )
  const isInvalid = parsedPeriod.status === "invalid"

  return (
    <Card size="sm" data-slot="period-lookup">
      <CardHeader>
        <CardTitle>Consulta puntual Sa(T)</CardTitle>
        <CardDescription>
          Evalúa el motor directamente en cualquier periodo no negativo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <Field data-invalid={isInvalid || undefined}>
            <FieldLabel htmlFor="period-lookup-input">Periodo T (s)</FieldLabel>
            <Input
              aria-describedby="period-lookup-help"
              aria-invalid={isInvalid || undefined}
              id="period-lookup-input"
              inputMode="decimal"
              min="0"
              onChange={(event) => setRawPeriod(event.currentTarget.value)}
              step="any"
              type="number"
              value={rawPeriod}
            />
            <FieldDescription id="period-lookup-help">
              Se consulta con la función Sa(T) del motor activo.
            </FieldDescription>
            {isInvalid ? <FieldError>{parsedPeriod.message}</FieldError> : null}
          </Field>

          <output
            aria-live="polite"
            className="flex min-h-20 flex-col justify-center gap-1 rounded-2xl bg-muted/50 px-4 py-3 shadow-[var(--shadow-surface-subtle)]"
            htmlFor="period-lookup-input"
          >
            {lookup?.status === "ok" ? (
              <>
                <span className="text-muted-foreground text-xs">Aceleración espectral</span>
                <span className="font-mono font-semibold text-2xl tabular-nums">
                  {lookup.saG.toFixed(6)} g
                </span>
                {lookup.branchLabel ? (
                  <span className="text-muted-foreground text-xs">
                    {lookup.branchLabel}
                  </span>
                ) : null}
              </>
            ) : lookup?.status === "unavailable" ? (
              <span className="text-muted-foreground text-sm">{lookup.message}</span>
            ) : (
              <span className="text-muted-foreground text-sm">
                Corrige el periodo para consultar Sa(T).
              </span>
            )}
          </output>
        </div>
      </CardContent>
    </Card>
  )
}
