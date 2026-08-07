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
import {
  ccp14DirectMapValues,
  ccp14MapFigure,
  ccp14MapLocations,
  resolveCcp14MapLocation,
} from "@/lib/ccp14"

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

function ccp14FigureHint(coefficient: "PGA" | "Ss" | "S1") {
  const figure = ccp14MapFigure(coefficient)
  const regions = figure.regions
  const [firstRegion, firstValue] = regions[0]
  const [lastRegion, lastValue] = regions[regions.length - 1]
  const g = (value: number) => value.toFixed(2).replace(".", ",")
  return `${figure.id.replace("figura-", "Figura ")} (pág. impresa ${figure.printedPage}): ${regions.length} regiones, de ${g(firstValue)} g (región ${firstRegion}) a ${g(lastValue)} g (región ${lastRegion}). Interpola linealmente entre contornos.`
}

export function Ccp14ParameterRail({
  mapLocationId,
  onMapLocationChange,
  onPgaChange,
  onS1Change,
  onSoilClassChange,
  onSsChange,
  pgaG,
  s1G,
  soilClass,
  ssG,
}: {
  mapLocationId: string | null
  onMapLocationChange: (value: string) => void
  onPgaChange: (value: number | null) => void
  onS1Change: (value: number | null) => void
  onSoilClassChange: (value: string) => void
  onSsChange: (value: number | null) => void
  pgaG: number | null
  s1G: number | null
  soilClass: string | null
  ssG: number | null
}) {
  const location = mapLocationId
    ? resolveCcp14MapLocation(mapLocationId)
    : null
  const directValues = mapLocationId ? ccp14DirectMapValues(mapLocationId) : null

  return (
    <Card className="self-start" size="sm">
      <CardHeader>
        <CardTitle>Parámetros CCP-14</CardTitle>
        <CardDescription>
          Procedimiento General de 3.10.2.1: los tres coeficientes mapeados y el
          perfil de sitio. Todo lo demás lo deriva el motor de la publicación
          oficial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-5">
          <MunicipalSelect
            description="Los 32 lugares que rotulan las Figuras 3.10.2.1-1 a 3.10.2.1-3. Queda registrado en la memoria; salvo San Andrés y Providencia, no fija los coeficientes."
            id="ccp14-map-location-trigger"
            label="Lugar rotulado en los mapas"
            onValueChange={onMapLocationChange}
            options={ccp14MapLocations.map(({ id, label }) => ({ id, label }))}
            value={mapLocationId}
          />
          {directValues ? (
            <Alert data-slot="ccp14-direct-map-values">
              <ShieldAlertIcon />
              <AlertTitle>Región asignada por el mapa</AlertTitle>
              <AlertDescription>
                {location?.label}: el recuadro completo cae en la región 1 de las
                tres figuras, sin contornos que lo crucen, así que PGA ={" "}
                {directValues.pgaG} g, Ss = {directValues.ssG} g y S1 ={" "}
                {directValues.s1G} g se leen directamente de las leyendas.
              </AlertDescription>
            </Alert>
          ) : null}
          <NumericInput
            description={ccp14FigureHint("PGA")}
            id="ccp14-pga"
            label="PGA (g)"
            nullable
            onValueChange={onPgaChange}
            value={pgaG}
          />
          <NumericInput
            description={ccp14FigureHint("Ss")}
            id="ccp14-ss"
            label="Ss (g)"
            nullable
            onValueChange={onSsChange}
            value={ssG}
          />
          <NumericInput
            description={ccp14FigureHint("S1")}
            id="ccp14-s1"
            label="S1 (g)"
            nullable
            onValueChange={onS1Change}
            value={s1G}
          />
          <MunicipalSelect
            description="Tabla 3.10.3.1-1, confirmado con la información geotécnica del proyecto. Fpga, Fa y Fv salen de las Tablas 3.10.3.2-1 a 3.10.3.2-3."
            id="ccp14-soil-trigger"
            label="Perfil de sitio"
            onValueChange={onSoilClassChange}
            options={["A", "B", "C", "D", "E", "F"].map((id) => ({
              id,
              label: `Perfil ${id}`,
            }))}
            value={soilClass}
          />
          <Alert>
            <ShieldAlertIcon />
            <AlertTitle>Antes de usar el Procedimiento General</AlertTitle>
            <AlertDescription>
              3.10.2 obliga al Procedimiento Particular de Sitio si el puente
              está a menos de 10 km de una falla activa, si el perfil es tipo F,
              si se esperan sismos de larga duración en la región o si su
              importancia exige una probabilidad de excedencia menor. La
              calculadora no puede verificar esas cuatro condiciones por ti.
            </AlertDescription>
          </Alert>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <Separator />
        <p className="text-muted-foreground text-xs">
          Los mapas rotulan lugares, pero los números circulados marcan bandas
          entre contornos, no ciudades: la norma no publica una tabla de PGA, Ss
          y S1 por municipio, así que los tres valores se leen de las figuras y
          se declaran aquí.
        </p>
        <a
          className="text-muted-foreground text-xs underline underline-offset-4"
          href="https://www.invias.gov.co/loader.php?lServicio=Tools2&lTipo=descargas&lFuncion=descargar&idFile=29584"
          rel="noreferrer"
          target="_blank"
        >
          Descargar publicación oficial CCP-14 de INVÍAS
        </a>
        <a
          className="text-muted-foreground text-xs underline underline-offset-4"
          href="https://www.invias.gov.co/loader.php?lServicio=Tools2&lTipo=descargas&lFuncion=descargar&idFile=29585"
          rel="noreferrer"
          target="_blank"
        >
          Resolución 0000108 de 2015 que adopta la norma
        </a>
      </CardFooter>
    </Card>
  )
}

export function DosquebradasParameterRail({
  importanceFactor,
  onImportanceFactorChange,
  onZoneChange,
  zoneId,
  zoneOptions,
}: {
  importanceFactor: number
  onImportanceFactorChange: (value: number) => void
  onZoneChange: (value: string) => void
  zoneId: string | null
  zoneOptions: readonly SelectOption[]
}) {
  return (
    <Card className="self-start" size="sm">
      <CardHeader>
        <CardTitle>Parámetros de Dosquebradas</CardTitle>
        <CardDescription>
          Una zona manual y el único escenario de diseño soportado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-5">
          <MunicipalSelect
            description="Cinco zonas publicadas en la Tabla 27 del POT 2024."
            id="dosquebradas-zone-trigger"
            label="Zona de respuesta"
            onValueChange={onZoneChange}
            options={zoneOptions}
            value={zoneId}
          />
          <Field>
            <FieldLabel>Nivel de amenaza</FieldLabel>
            <Input disabled value="Diseño" />
            <FieldDescription>
              Escenario único; la tabla municipal no declara periodo de retorno.
            </FieldDescription>
          </Field>
          <NumericInput
            description="Factor declarado para el proyecto."
            id="dosquebradas-importance-factor"
            label="Factor de importancia I"
            min={0.01}
            onValueChange={(value) => onImportanceFactorChange(value ?? 0)}
            value={importanceFactor}
          />
          <ManualZoneWarning />
          <Alert>
            <ShieldAlertIcon />
            <AlertTitle>Intervalo publicado</AlertTitle>
            <AlertDescription>
              El cálculo y la gráfica cubren To ≤ T ≤ TL. Las consultas fuera
              de ese intervalo devuelven una advertencia localizada.
            </AlertDescription>
          </Alert>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <Separator />
        <p className="text-muted-foreground text-xs">
          Sin mapas, coordenadas ni detección automática de zona.
        </p>
        <a
          className="text-muted-foreground text-xs underline underline-offset-4"
          href="https://pot.dosquebradas.gov.co/repositorio/pot-2024-1/3.Diagnostico/3.1%20AMBIENTAL/3.1.2%20Diagnostico%20Amenazas%20origen%20natural%20e%20instrumentos%20de%20GRD.pdf"
          rel="noreferrer"
          target="_blank"
        >
          POT 2024 de Dosquebradas · Tabla 27
        </a>
      </CardFooter>
    </Card>
  )
}

export function MedellinParameterRail({
  hazardDescription,
  hazardId,
  hazardOptions,
  importanceFactor,
  onHazardChange,
  onImportanceFactorChange,
  onZoneChange,
  zoneId,
  zoneOptions,
}: {
  hazardDescription: string
  hazardId: string | null
  hazardOptions: readonly SelectOption[]
  importanceFactor: number
  onHazardChange: (value: string) => void
  onImportanceFactorChange: (value: number) => void
  onZoneChange: (value: string) => void
  zoneId: string | null
  zoneOptions: readonly SelectOption[]
}) {
  return (
    <Card className="self-start" size="sm">
      <CardHeader>
        <CardTitle>Parámetros de Medellín</CardTitle>
        <CardDescription>
          Zona y familia histórica declaradas manualmente; no se infieren por
          dirección ni coordenadas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-5">
          <MunicipalSelect
            description="Catorce zonas homogéneas publicadas en el soporte técnico DAP."
            id="medellin-zone-trigger"
            label="Zona homogénea"
            onValueChange={onZoneChange}
            options={zoneOptions}
            value={zoneId}
          />
          <MunicipalSelect
            description={hazardDescription}
            id="medellin-hazard-trigger"
            label="Familia de amenaza"
            onValueChange={onHazardChange}
            options={hazardOptions}
            value={hazardId}
          />
          <NumericInput
            description="Factor declarado para el proyecto."
            id="medellin-importance-factor"
            label="Factor de importancia I"
            min={0.01}
            onValueChange={(value) => onImportanceFactorChange(value ?? 0)}
            value={importanceFactor}
          />
          <ManualZoneWarning />
          <Alert>
            <ShieldAlertIcon />
            <AlertTitle>Intervalo técnico publicado</AlertTitle>
            <AlertDescription>
              La gráfica cubre T0 ≤ T ≤ 4 s. Para T &lt; T0 o T &gt; 4 s, la
              consulta puntual devuelve una advertencia localizada sin inventar
              la rama faltante.
            </AlertDescription>
          </Alert>
          <Alert>
            <ShieldAlertIcon />
            <AlertTitle>Contexto administrativo visible</AlertTitle>
            <AlertDescription>
              El historial de adopción se conserva como contexto y este cálculo
              no se presenta como sustituto del flujo nacional. No bloquea las
              ramas técnicas que la fuente publica explícitamente.
            </AlertDescription>
          </Alert>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <Separator />
        <p className="text-muted-foreground text-xs">
          Período de retorno municipal no declarado · sin mapas, GIS,
          coordenadas ni detección automática.
        </p>
        <a
          className="text-muted-foreground text-xs underline underline-offset-4"
          href="https://www.medellin.gov.co/irj/go/km/docs/wpccontent/Sites/Subportal%20del%20Ciudadano/Plan%20de%20Desarrollo/Secciones/Informaci%C3%B3n%20General/Documentos/POT/Recomendaciones%20Microzonificaci%C3%B3n%20S%C3%ADsmica/Microzonificaci%C3%B3n%20s%C3%ADsmica%20del%20%C3%A1rea%20urbana%20de%20Medell%C3%ADn.pdf"
          rel="noreferrer"
          target="_blank"
        >
          Soporte técnico oficial DAP · Medellín
        </a>
      </CardFooter>
    </Card>
  )
}
