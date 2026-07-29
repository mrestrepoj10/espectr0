"use client"

import { ShieldAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

type SelectOption = {
  id: string
  label: string
}

function MunicipalSelect({
  description,
  id,
  label,
  onValueChange,
  options,
  placeholder = "Seleccione…",
  value,
}: {
  description?: string
  id: string
  label: string
  onValueChange: (value: string) => void
  options: readonly SelectOption[]
  placeholder?: string
  value: string | null
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={options.map((option) => ({
          label: option.label,
          value: option.id,
        }))}
        onValueChange={(nextValue) => {
          if (nextValue) onValueChange(nextValue)
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} side="bottom">
          <SelectGroup>
            <SelectLabel>{label}</SelectLabel>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  )
}

function NumericInput({
  description,
  id,
  label,
  min = 0,
  nullable = false,
  onValueChange,
  value,
}: {
  description: string
  id: string
  label: string
  min?: number
  nullable?: boolean
  onValueChange: (value: number | null) => void
  value: number | null
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        min={min}
        onChange={(event) => {
          const raw = event.currentTarget.value
          onValueChange(raw === "" && nullable ? null : Number(raw))
        }}
        step="any"
        type="number"
        value={value ?? ""}
      />
      <FieldDescription>{description}</FieldDescription>
    </Field>
  )
}

function ManualZoneWarning() {
  return (
    <Alert data-slot="manual-zone-warning">
      <ShieldAlertIcon />
      <AlertTitle>Validación profesional obligatoria</AlertTitle>
      <AlertDescription>
        La zona se selecciona manualmente. El profesional responsable debe
        verificarla en la publicación oficial y con la información geotécnica
        del proyecto.
      </AlertDescription>
    </Alert>
  )
}

export function BogotaParameterRail({
  fillThicknessMeters,
  hazardDescription,
  hazardId,
  hazardOptions,
  importanceFactor,
  onFillThicknessChange,
  onHazardChange,
  onImportanceFactorChange,
  onRigidBasePeriodChange,
  onZoneChange,
  rigidBasePeriodSeconds,
  zoneId,
  zoneOptions,
}: {
  fillThicknessMeters: number | null
  hazardDescription: string
  hazardId: string
  hazardOptions: readonly SelectOption[]
  importanceFactor: number
  onFillThicknessChange: (value: number | null) => void
  onHazardChange: (value: string) => void
  onImportanceFactorChange: (value: number) => void
  onRigidBasePeriodChange: (value: number | null) => void
  onZoneChange: (value: string) => void
  rigidBasePeriodSeconds: number | null
  zoneId: string | null
  zoneOptions: readonly SelectOption[]
}) {
  return (
    <Card className="self-start" size="sm">
      <CardHeader>
        <CardTitle>Parámetros de Bogotá</CardTitle>
        <CardDescription>
          Selección manual según las opciones publicadas por el estudio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-5">
          <MunicipalSelect
            description="Zona de respuesta sísmica elegida manualmente."
            id="bogota-zone-trigger"
            label="Zona de respuesta"
            onValueChange={onZoneChange}
            options={zoneOptions}
            value={zoneId}
          />
          <MunicipalSelect
            description={hazardDescription}
            id="bogota-hazard-trigger"
            label="Nivel de amenaza"
            onValueChange={onHazardChange}
            options={hazardOptions}
            value={hazardId}
          />
          <NumericInput
            description="Factor declarado para el proyecto."
            id="bogota-importance-factor"
            label="Factor de importancia I"
            min={0.01}
            onValueChange={(value) => onImportanceFactorChange(value ?? 0)}
            value={importanceFactor}
          />
          <NumericInput
            description="Opcional; deja el campo vacío si no corresponde."
            id="bogota-fill-thickness"
            label="Espesor de relleno (m)"
            nullable
            onValueChange={onFillThicknessChange}
            value={fillThicknessMeters}
          />
          <NumericInput
            description="Opcional; periodo fundamental sobre base rígida."
            id="bogota-rigid-base-period"
            label="Periodo en base rígida (s)"
            nullable
            onValueChange={onRigidBasePeriodChange}
            value={rigidBasePeriodSeconds}
          />
          <ManualZoneWarning />
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <Separator />
        <p className="text-muted-foreground text-xs">
          Sin mapas, coordenadas ni detección automática de zona.
        </p>
      </CardFooter>
    </Card>
  )
}

export function CaliParameterRail({
  colluvialDeposit,
  fillThicknessMeters,
  hazardDescription,
  hazardId,
  hazardOptions,
  importanceFactor,
  onColluvialDepositChange,
  onFillThicknessChange,
  onHazardChange,
  onImportanceFactorChange,
  onComponentChange,
  onZoneChange,
  componentId,
  componentOptions,
  zoneId,
  zoneOptions,
}: {
  colluvialDeposit: boolean
  fillThicknessMeters: number | null
  hazardDescription: string
  hazardId: string
  hazardOptions: readonly SelectOption[]
  importanceFactor: number
  onColluvialDepositChange: (value: boolean) => void
  onFillThicknessChange: (value: number | null) => void
  onHazardChange: (value: string) => void
  onImportanceFactorChange: (value: number) => void
  onComponentChange: (value: string) => void
  onZoneChange: (value: string) => void
  componentId: string | null
  componentOptions: readonly SelectOption[]
  zoneId: string | null
  zoneOptions: readonly SelectOption[]
}) {
  return (
    <Card className="self-start" size="sm">
      <CardHeader>
        <CardTitle>Parámetros de Cali</CardTitle>
        <CardDescription>
          Curva y condición del sitio declaradas manualmente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-5">
          <MunicipalSelect
            description="Diez zonas geográficas publicadas por el estudio."
            id="cali-zone-trigger"
            label="Zona geográfica"
            onValueChange={onZoneChange}
            options={zoneOptions}
            value={zoneId}
          />
          {componentOptions.length > 0 ? (
            <>
              <MunicipalSelect
                description="Selecciona una curva para calcularla; después verifica también la otra."
                id="cali-component-trigger"
                label="Componente de curva"
                onValueChange={onComponentChange}
                options={componentOptions}
                value={componentId}
              />
              <Alert>
                <ShieldAlertIcon />
                <AlertTitle>Comprobación concurrente</AlertTitle>
                <AlertDescription>
                  La publicación exige verificar independientemente las curvas
                  Tc y TL de esta zona. Este cálculo presenta una a la vez y no
                  sustituye la comprobación de ambas.
                </AlertDescription>
              </Alert>
            </>
          ) : null}
          <MunicipalSelect
            description={hazardDescription}
            id="cali-hazard-trigger"
            label="Nivel de amenaza"
            onValueChange={onHazardChange}
            options={hazardOptions}
            value={hazardId}
          />
          <NumericInput
            description="Factor declarado para el proyecto."
            id="cali-importance-factor"
            label="Factor de importancia I"
            min={0.01}
            onValueChange={(value) => onImportanceFactorChange(value ?? 0)}
            value={importanceFactor}
          />
          <NumericInput
            description="Opcional; espesor declarado para el proyecto."
            id="cali-fill-thickness"
            label="Relleno no controlado (m)"
            nullable
            onValueChange={onFillThicknessChange}
            value={fillThicknessMeters}
          />
          <Field orientation="horizontal">
            <FieldLabel htmlFor="cali-colluvial-deposit">
              Depósito coluvial
            </FieldLabel>
            <Switch
              checked={colluvialDeposit}
              id="cali-colluvial-deposit"
              onCheckedChange={onColluvialDepositChange}
            />
          </Field>
          <ManualZoneWarning />
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <Separator />
        <p className="text-muted-foreground text-xs">
          Sin mapas, coordenadas ni detección automática de zona.
        </p>
      </CardFooter>
    </Card>
  )
}
