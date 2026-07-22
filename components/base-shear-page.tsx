"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangleIcon,
  Building2Icon,
  ClipboardPasteIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  InfoIcon,
  RotateCcwIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  defaultMunicipio,
  getMunicipalityCoefficients,
  HazardLevelControl,
  ImportanceGroupControl,
  MunicipalityCombobox,
  SoilProfileControl,
} from "@/components/spectrum-controls"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { downloadEtabsTxt } from "@/lib/chart-export"
import {
  convertWeight,
  createUniformStories,
  parseStoryRows,
  storyForceCsv,
  weightToKn,
  type EditableStory,
  type WeightUnit,
} from "@/lib/base-shear-ui"
import {
  approximatePeriod,
  approximatePeriodCoefficients,
  approximatePeriodSystems,
  baseShear,
  computeSpectrum,
  fheApplicability,
  forceDistribution,
  fv,
  hazardLevelDetails,
  normalizeSearchText,
  periodCeiling,
  saAt,
} from "@/lib/nsr10"

import type {
  ApproximatePeriodSystem,
  DynamicAnalysisIrregularity,
  HazardLevel,
  ImportanceGroup,
  Municipio,
  SeismicHazardZone,
  SoilProfile,
  SpectrumParams,
  StructuralRegularity,
  SupportedSoilProfile,
} from "@/lib/nsr10"

const chartConfig = {
  sa: { label: "Sa (g)", color: "var(--chart-1)" },
} satisfies ChartConfig

const structuralSystemLabels: Record<ApproximatePeriodSystem, string> = {
  "concrete-moment-frame": "Pórtico a momento de concreto",
  "steel-moment-frame": "Pórtico a momento de acero",
  "steel-eccentric-or-brb-braced": "Acero excéntrico o BRB",
  "all-other": "Otros sistemas (muros, mampostería o arriostrado concéntrico)",
}

const hazardZones = [
  { value: "low", label: "Baja" },
  { value: "intermediate", label: "Intermedia" },
  { value: "high", label: "Alta" },
] as const satisfies ReadonlyArray<{ value: SeismicHazardZone; label: string }>
const regularities = [
  { value: "regular", label: "Regular" },
  { value: "irregular", label: "Irregular" },
] as const satisfies ReadonlyArray<{
  value: StructuralRegularity
  label: string
}>
const dynamicAnalysisIrregularities = [
  { value: "none", label: "Ninguna de las listadas" },
  { value: "vertical-1aA", label: "Vertical 1aA" },
  { value: "vertical-1bA", label: "Vertical 1bA" },
  { value: "vertical-2A", label: "Vertical 2A" },
  { value: "vertical-3A", label: "Vertical 3A" },
  { value: "unclassified", label: "Irregularidad no clasificada" },
] as const satisfies ReadonlyArray<{
  value: DynamicAnalysisIrregularity
  label: string
}>
const unitLabels: Record<WeightUnit, string> = {
  kn: "kN",
  tonf: "tonf",
  kg: "kg (masa)",
}

function downloadText(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function formatNumber(value: number, digits = 3) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

type CalculationOk = ReturnType<typeof calculateBaseShearWorkspace> & {
  status: "ok"
}

function calculateBaseShearWorkspace({
  municipio,
  soilProfile,
  importanceGroup,
  hazardLevel,
  structuralSystem,
  heightM,
  analyticalPeriod,
  weight,
  unit,
  stories,
  hazardZone,
  regularity,
  dynamicAnalysisIrregularity,
}: {
  municipio: Municipio
  soilProfile: SoilProfile
  importanceGroup: ImportanceGroup
  hazardLevel: HazardLevel
  structuralSystem: ApproximatePeriodSystem
  heightM: number
  analyticalPeriod?: number
  weight: number
  unit: WeightUnit
  stories: EditableStory[]
  hazardZone: SeismicHazardZone
  regularity: StructuralRegularity
  dynamicAnalysisIrregularity: DynamicAnalysisIrregularity
}) {
  if (analyticalPeriod !== undefined && (!Number.isFinite(analyticalPeriod) || analyticalPeriod <= 0)) {
    return {
      status: "invalid-input" as const,
      error: "El periodo analítico debe ser mayor que cero o dejarse vacío.",
    }
  }
  for (let index = 0; index < stories.length; index += 1) {
    const story = stories[index]
    if (!Number.isFinite(story.wx) || story.wx <= 0 || !Number.isFinite(story.hx) || story.hx <= 0) {
      return {
        status: "invalid-input" as const,
        error: "Todos los pesos y las alturas de nivel deben ser positivos.",
      }
    }
    if (index > 0 && story.hx <= stories[index - 1].hx) {
      return {
        status: "invalid-input" as const,
        error: "Las alturas de nivel deben aumentar estrictamente desde la base.",
      }
    }
  }

  const params: SpectrumParams = {
    aa: municipio.aa,
    av: municipio.av,
    ae: municipio.ae,
    ad: municipio.ad,
    hazardLevel,
    soilProfile,
    importanceGroup,
  }
  const approximate = approximatePeriod({ system: structuralSystem, hn: heightM })

  if (soilProfile === "F") {
    return {
      status: "site-specific-study-required" as const,
      result: saAt(approximate.ta, params),
      approximate,
    }
  }

  const siteFv = fv(municipio.av, soilProfile as SupportedSoilProfile)
  const period = periodCeiling({
    av: municipio.av,
    fv: siteFv,
    ta: approximate.ta,
    tAnalytical: analyticalPeriod,
  })
  const spectralAcceleration = saAt(period.t, params)
  const shear = baseShear({ saAtT: spectralAcceleration, weightKn: weightToKn(weight, unit) })
  if (shear.status !== "ok") {
    return { status: "site-specific-study-required" as const, result: shear, approximate }
  }

  const distribution = forceDistribution({
    stories: stories.map((story) => ({
      wx: weightToKn(story.wx, unit),
      hx: story.hx,
    })),
    t: period.t,
    vs: shear.vsKn,
  })
  const spectrum = computeSpectrum(params)
  if (spectrum.status !== "ok") {
    return { status: "site-specific-study-required" as const, result: spectrum, approximate }
  }

  const applicability = fheApplicability({
    hazardZone,
    importanceGroup,
    regularity,
    dynamicAnalysisIrregularity,
    stories: stories.length,
    heightM,
    soilProfile,
    t: period.t,
    tc: spectrum.coefficients.tc,
  })

  return {
    status: "ok" as const,
    params,
    approximate,
    period,
    spectralAcceleration,
    shear,
    distribution,
    spectrum,
    applicability,
  }
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <Card size="sm" variant="metric">
      <CardHeader>
        <CardTitle className="text-xs font-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="font-mono text-xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function SiteSpecificNotice() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil F: estudio específico requerido</CardTitle>
        <CardDescription>
          El motor detuvo el cálculo antes de producir fuerzas sísmicas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>No se genera un resultado tabulado</AlertTitle>
          <AlertDescription>
            La sección A.2.10 exige una investigación geotécnica y un análisis de
            respuesta sísmica específicos para el sitio.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

function SpectrumChart({ calculation }: { calculation: CalculationOk }) {
  const { spectrum, spectralAcceleration, period } = calculation
  if (spectralAcceleration.status !== "ok") return null

  return (
    <Card variant="elevated">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Espectro y punto evaluado</CardTitle>
            <CardDescription>
              {hazardLevelDetails[spectrum.hazardLevel].label} · Sa(T) proviene del motor
              NSR-10.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            T {formatNumber(period.t)} s · Sa {formatNumber(spectralAcceleration.sa)} g
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer
          aria-label="Espectro elástico con el periodo estructural evaluado"
          className="h-72 w-full md:h-88"
          config={chartConfig}
          initialDimension={{ width: 900, height: 352 }}
        >
          <AreaChart
            accessibilityLayer
            data={spectrum.points}
            margin={{ top: 20, right: 18, bottom: 24, left: 6 }}
          >
            <defs>
              <linearGradient id="base-shear-spectrum-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sa)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-sa)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid className="stroke-border" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="t"
              label={{ value: "Periodo T (s)", position: "insideBottom", offset: -16 }}
              tickFormatter={(value) => Number(value).toFixed(2)}
              tickLine={false}
              tickMargin={8}
              type="number"
            />
            <YAxis
              axisLine={false}
              label={{ value: "Sa (g)", angle: -90, position: "insideLeft" }}
              tickFormatter={(value) => Number(value).toFixed(2)}
              tickLine={false}
              tickMargin={8}
            />
            <ReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              x={period.t}
            />
            <ReferenceDot
              fill="var(--color-sa)"
              r={6}
              stroke="var(--background)"
              strokeWidth={3}
              x={period.t}
              y={spectralAcceleration.sa}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(_, payload) =>
                    `T = ${Number(payload[0]?.payload?.t ?? 0).toFixed(3)} s`
                  }
                />
              }
              cursor={false}
            />
            <Area
              dataKey="sa"
              fill="url(#base-shear-spectrum-fill)"
              fillOpacity={1}
              isAnimationActive={false}
              stroke="var(--color-sa)"
              strokeWidth={2.5}
              type="linear"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function BaseShearPage() {
  const [municipio, setMunicipio] = useState(defaultMunicipio)
  const [soilProfile, setSoilProfile] = useState<SoilProfile>("D")
  const [importanceGroup, setImportanceGroup] = useState<ImportanceGroup>("I")
  const [hazardLevel, setHazardLevel] = useState<HazardLevel>("design")
  const [structuralSystem, setStructuralSystem] =
    useState<ApproximatePeriodSystem>("all-other")
  const [heightM, setHeightM] = useState(15)
  const [storyCount, setStoryCount] = useState(5)
  const [weight, setWeight] = useState(10_000)
  const [unit, setUnit] = useState<WeightUnit>("kn")
  const [stories, setStories] = useState(() => createUniformStories(5, 10_000, 15))
  const [analyticalPeriod, setAnalyticalPeriod] = useState("")
  const [hazardZone, setHazardZone] = useState<SeismicHazardZone>("high")
  const [regularity, setRegularity] = useState<StructuralRegularity>("regular")
  const [dynamicAnalysisIrregularity, setDynamicAnalysisIrregularity] =
    useState<DynamicAnalysisIrregularity>("none")
  const [pasteValue, setPasteValue] = useState("")
  const [pasteError, setPasteError] = useState<string>()

  const calculation = useMemo(
    () =>
      calculateBaseShearWorkspace({
        municipio,
        soilProfile,
        importanceGroup,
        hazardLevel,
        structuralSystem,
        heightM,
        analyticalPeriod: analyticalPeriod ? Number(analyticalPeriod) : undefined,
        weight,
        unit,
        stories,
        hazardZone,
        regularity,
        dynamicAnalysisIrregularity,
      }),
    [
      municipio,
      soilProfile,
      importanceGroup,
      hazardLevel,
      structuralSystem,
      heightM,
      analyticalPeriod,
      weight,
      unit,
      stories,
      hazardZone,
      regularity,
      dynamicAnalysisIrregularity,
    ],
  )

  const storyWeightKn = stories.reduce(
    (sum, story) => sum + weightToKn(story.wx, unit),
    0,
  )
  const totalWeightKn = weightToKn(weight, unit)
  const weightMismatch = Math.abs(storyWeightKn - totalWeightKn) > totalWeightKn * 0.001

  function resetUniformStories(nextCount = storyCount) {
    setStories(createUniformStories(nextCount, weight, heightM))
  }

  function changeUnit(nextUnit: WeightUnit) {
    if (nextUnit === unit) return
    setWeight((current) => convertWeight(current, unit, nextUnit))
    setStories((current) =>
      current.map((story) => ({
        ...story,
        wx: convertWeight(story.wx, unit, nextUnit),
      })),
    )
    setUnit(nextUnit)
  }

  function updateStory(index: number, field: keyof EditableStory, value: number) {
    if (!Number.isFinite(value) || value <= 0) return
    setStories((current) =>
      current.map((story, storyIndex) =>
        storyIndex === index ? { ...story, [field]: value } : story,
      ),
    )
  }

  function applyPastedRows() {
    const parsed = parseStoryRows(pasteValue)
    if (!parsed.ok) {
      setPasteError(parsed.error)
      return
    }
    setStories(parsed.stories)
    setStoryCount(parsed.stories.length)
    setHeightM(parsed.stories.at(-1)?.hx ?? heightM)
    setPasteError(undefined)
    setPasteValue("")
    toast.success("Filas de niveles actualizadas.")
  }

  function exportForcesCsv() {
    if (calculation.status !== "ok") return
    downloadText(
      storyForceCsv(calculation.distribution.stories),
      `espectr0-cortante-${normalizeSearchText(municipio.municipio).replace(/\s+/g, "-")}.csv`,
      "text/csv;charset=utf-8",
    )
    toast.success("CSV de fuerzas descargado.")
  }

  function exportEtabs() {
    if (calculation.status !== "ok") return
    downloadEtabsTxt(
      calculation.spectrum.points,
      `espectr0-etabs-${normalizeSearchText(municipio.municipio).replace(/\s+/g, "-")}.txt`,
    )
    toast.success("TXT para ETABS descargado.")
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">NSR-10 · Capítulo A.4</Badge>
          <Badge variant="secondary">Una dirección</Badge>
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Cortante sísmico basal
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
          Configura el sitio y la estructura en un solo flujo. El motor calcula el periodo,
          evalúa Sa(T) y distribuye las fuerzas por nivel sin reconstruir ecuaciones en la
          interfaz.
        </p>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.45fr)]">
        <div className="flex flex-col gap-6">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Espectro del sitio</CardTitle>
              <CardDescription>Municipio, suelo, uso y nivel de evaluación.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-5">
                <Field>
                  <FieldTitle>Municipio</FieldTitle>
                  <MunicipalityCombobox onValueChange={setMunicipio} value={municipio} />
                  <FieldDescription>
                    {getMunicipalityCoefficients(municipio, hazardLevel)} · Apéndice A-4
                  </FieldDescription>
                </Field>
                <SoilProfileControl onValueChange={setSoilProfile} value={soilProfile} />
                <ImportanceGroupControl
                  hazardLevel={hazardLevel}
                  onValueChange={setImportanceGroup}
                  value={importanceGroup}
                />
                <HazardLevelControl onValueChange={setHazardLevel} value={hazardLevel} />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Sistema y periodo</CardTitle>
              <CardDescription>Entradas estructurales para la dirección estudiada.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-5">
                <Field>
                  <FieldTitle>Sistema estructural</FieldTitle>
                  <Select
                    items={approximatePeriodSystems.map((value) => ({
                      value,
                      label: structuralSystemLabels[value],
                    }))}
                    onValueChange={(value) =>
                      value && setStructuralSystem(value as ApproximatePeriodSystem)
                    }
                    value={structuralSystem}
                  >
                    <SelectTrigger aria-label="Sistema estructural" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {approximatePeriodSystems.map((system) => (
                        <SelectItem key={system} value={system}>
                          {structuralSystemLabels[system]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Ct {approximatePeriodCoefficients[structuralSystem].ct} · α{" "}
                    {approximatePeriodCoefficients[structuralSystem].alpha} · Tabla A.4.2-1
                  </FieldDescription>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldTitle>Altura hn (m)</FieldTitle>
                    <Input
                      aria-label="Altura total en metros"
                      min={0.1}
                      onChange={(event) => {
                        if (event.currentTarget.valueAsNumber > 0) {
                          setHeightM(event.currentTarget.valueAsNumber)
                        }
                      }}
                      step="0.1"
                      type="number"
                      value={heightM}
                    />
                  </Field>
                  <Field>
                    <FieldTitle>Niveles</FieldTitle>
                    <Input
                      aria-label="Número de niveles"
                      max={100}
                      min={1}
                      onChange={(event) => {
                        const next = Math.trunc(event.currentTarget.valueAsNumber)
                        if (next >= 1 && next <= 100) {
                          setStoryCount(next)
                          resetUniformStories(next)
                        }
                      }}
                      type="number"
                      value={storyCount}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldTitle>Periodo analítico T (opcional)</FieldTitle>
                  <Input
                    aria-label="Periodo analítico opcional"
                    min={0.001}
                    onChange={(event) => setAnalyticalPeriod(event.currentTarget.value)}
                    placeholder="Sin modelo analítico"
                    step="0.001"
                    type="number"
                    value={analyticalPeriod}
                  />
                  <FieldDescription>
                    Si se omite, el motor usa el periodo aproximado Ta.
                  </FieldDescription>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldTitle>Zona de amenaza sísmica</FieldTitle>
                    <Select
                      items={hazardZones}
                      onValueChange={(value) =>
                        value && setHazardZone(value as SeismicHazardZone)
                      }
                      value={hazardZone}
                    >
                      <SelectTrigger aria-label="Zona de amenaza sísmica" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {hazardZones.map((zone) => (
                          <SelectItem key={zone.value} value={zone.value}>
                            {zone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldTitle>Regularidad</FieldTitle>
                    <Select
                      items={regularities}
                      onValueChange={(value) => {
                        if (!value) return
                        const nextRegularity = value as StructuralRegularity
                        setRegularity(nextRegularity)
                        if (nextRegularity === "regular") {
                          setDynamicAnalysisIrregularity("none")
                        }
                      }}
                      value={regularity}
                    >
                      <SelectTrigger aria-label="Regularidad estructural" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {regularities.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <FieldTitle>Irregularidad que exige análisis dinámico</FieldTitle>
                  <Select
                    items={dynamicAnalysisIrregularities}
                    onValueChange={(value) => {
                      if (!value) return
                      const nextIrregularity = value as DynamicAnalysisIrregularity
                      setDynamicAnalysisIrregularity(nextIrregularity)
                      if (nextIrregularity !== "none") setRegularity("irregular")
                    }}
                    value={dynamicAnalysisIrregularity}
                  >
                    <SelectTrigger
                      aria-label="Irregularidad que exige análisis dinámico"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dynamicAnalysisIrregularities.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Tipos 1aA, 1bA, 2A y 3A, o irregularidades no clasificadas, requieren
                    análisis dinámico según A.3.4.2.2.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Peso y distribución vertical</CardTitle>
              <CardDescription>
                wi usa la unidad seleccionada; hi es la altura acumulada desde la base.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
                <Field>
                  <FieldTitle>Peso total</FieldTitle>
                  <Input
                    aria-label="Peso total"
                    min={0.001}
                    onChange={(event) => {
                      if (event.currentTarget.valueAsNumber > 0) {
                        setWeight(event.currentTarget.valueAsNumber)
                      }
                    }}
                    step="any"
                    type="number"
                    value={weight}
                  />
                </Field>
                <Field>
                  <FieldTitle>Unidad</FieldTitle>
                  <Select
                    items={Object.entries(unitLabels).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    onValueChange={(value) => value && changeUnit(value as WeightUnit)}
                    value={unit}
                  >
                    <SelectTrigger aria-label="Unidad del peso" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(unitLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Σwi {formatNumber(storyWeightKn, 2)} kN · W {formatNumber(totalWeightKn, 2)} kN
                </p>
                <Button onClick={() => resetUniformStories()} size="lg" type="button" variant="outline">
                  <RotateCcwIcon data-icon="inline-start" />
                  Distribuir uniforme
                </Button>
              </div>

              {weightMismatch ? (
                <Alert>
                  <InfoIcon />
                  <AlertTitle>La suma de wi difiere del peso total</AlertTitle>
                  <AlertDescription>
                    El peso total gobierna Vs; los wi editados gobiernan únicamente las
                    proporciones de distribución por nivel.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="max-h-84 overflow-auto rounded-2xl shadow-[var(--shadow-surface-subtle)]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Nivel</TableHead>
                      <TableHead>wi ({unitLabels[unit]})</TableHead>
                      <TableHead>hi (m)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stories.map((story, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <Input
                            aria-label={`Peso del nivel ${index + 1}`}
                            className="min-w-28 font-mono tabular-nums"
                            min={0.001}
                            onChange={(event) =>
                              updateStory(index, "wx", event.currentTarget.valueAsNumber)
                            }
                            step="any"
                            type="number"
                            value={story.wx}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`Altura del nivel ${index + 1}`}
                            className="min-w-24 font-mono tabular-nums"
                            min={0.001}
                            onChange={(event) =>
                              updateStory(index, "hx", event.currentTarget.valueAsNumber)
                            }
                            step="any"
                            type="number"
                            value={story.hx}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <details className="rounded-2xl bg-muted/35 p-4">
                <summary className="min-h-10 cursor-pointer content-center text-sm font-medium">
                  Pegar filas desde CSV
                </summary>
                <div className="mt-3 space-y-3">
                  <Textarea
                    aria-label="Filas CSV de pesos y alturas"
                    onChange={(event) => setPasteValue(event.currentTarget.value)}
                    placeholder={"wi,hi\n2000,3\n2000,6"}
                    rows={5}
                    value={pasteValue}
                  />
                  <p className="text-xs text-muted-foreground">
                    Dos columnas, wi y hi. Se aceptan coma, punto y coma, tabulación o
                    espacio; usa punto para decimales.
                  </p>
                  {pasteError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {pasteError}
                    </p>
                  ) : null}
                  <Button onClick={applyPastedRows} size="lg" type="button">
                    <ClipboardPasteIcon data-icon="inline-start" />
                    Aplicar filas
                  </Button>
                </div>
              </details>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {calculation.status === "invalid-input" ? (
            <Card>
              <CardHeader>
                <CardTitle>Revisa la distribución de niveles</CardTitle>
                <CardDescription>
                  El motor no se ejecuta hasta que las entradas sean válidas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive">
                  <AlertTriangleIcon />
                  <AlertTitle>Entrada no válida</AlertTitle>
                  <AlertDescription>{calculation.error}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : calculation.status === "site-specific-study-required" ? (
            <SiteSpecificNotice />
          ) : (
            <>
              <section aria-labelledby="base-shear-results" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-lg font-medium" id="base-shear-results">
                      Resultado del motor
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Referencias A.4.2 y A.4.3 de la NSR-10.
                    </p>
                  </div>
                  {calculation.period.governedBy === "cu-times-ta" ? (
                    <Badge variant="destructive">Gobernado por Cu·Ta</Badge>
                  ) : calculation.period.governedBy === "approximate-period" ? (
                    <Badge variant="secondary">Gobierna Ta</Badge>
                  ) : (
                    <Badge variant="secondary">Gobierna T analítico</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  <MetricCard
                    detail={`${calculation.approximate.reference}`}
                    label="Ta"
                    value={`${formatNumber(calculation.approximate.ta)} s`}
                  />
                  <MetricCard
                    detail={`Cu ${formatNumber(calculation.period.cu, 2)}`}
                    label="Cu·Ta"
                    value={`${formatNumber(calculation.period.maximumPeriod)} s`}
                  />
                  <MetricCard
                    detail={calculation.period.reference}
                    label="T"
                    value={`${formatNumber(calculation.period.t)} s`}
                  />
                  <MetricCard
                    detail={calculation.distribution.reference}
                    label="k"
                    value={formatNumber(calculation.distribution.k, 3)}
                  />
                  <MetricCard
                    detail={`${formatNumber(calculation.shear.vsOverWeight * 100, 2)} % W`}
                    label="Vs"
                    value={`${formatNumber(calculation.shear.vsKn, 2)} kN`}
                  />
                </div>
              </section>

              <SpectrumChart calculation={calculation} />

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>Fuerzas por nivel</CardTitle>
                      <CardDescription>
                        Fx y cortante acumulado calculados por el motor desde la base.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={exportForcesCsv} size="lg" type="button" variant="outline">
                        <FileSpreadsheetIcon data-icon="inline-start" />
                        CSV
                      </Button>
                      <Button onClick={exportEtabs} size="lg" type="button" variant="outline">
                        <DownloadIcon data-icon="inline-start" />
                        TXT ETABS
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead>Nivel</TableHead>
                          <TableHead className="text-right">wi (kN)</TableHead>
                          <TableHead className="text-right">hi (m)</TableHead>
                          <TableHead className="text-right">Cvx</TableHead>
                          <TableHead className="text-right">Fx (kN)</TableHead>
                          <TableHead className="text-right">V nivel (kN)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...calculation.distribution.stories].reverse().map((story) => (
                          <TableRow key={story.index}>
                            <TableCell className="font-medium">{story.index + 1}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatNumber(story.wx, 2)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatNumber(story.hx, 2)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatNumber(story.cvx, 4)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatNumber(story.fx, 2)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatNumber(story.storyShear, 2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-muted-foreground">
                    El TXT para ETABS contiene dos columnas sin encabezado: T y Sa.
                  </p>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building2Icon className="size-5 text-muted-foreground" />
                    <CardTitle>Aplicabilidad del método FHE</CardTitle>
                  </div>
                  <CardDescription>
                    Verificación estructurada de A.3.4.2 para las entradas seleccionadas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {calculation.applicability.applicable ? (
                    <Alert>
                      <InfoIcon />
                      <AlertTitle>El método FHE está dentro de los límites evaluados</AlertTitle>
                      <AlertDescription>
                        Regla aplicable: {calculation.applicability.qualifyingRule}.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {calculation.applicability.warnings.map((warning) => (
                    <Alert key={warning.code} variant="destructive">
                      <AlertTriangleIcon />
                      <AlertTitle>{warning.reference}</AlertTitle>
                      <AlertDescription>{warning.message}</AlertDescription>
                    </Alert>
                  ))}
                  {calculation.applicability.notes.map((note) => (
                    <Alert key={note.code}>
                      <InfoIcon />
                      <AlertTitle>Nota para análisis dinámico · {note.reference}</AlertTitle>
                      <AlertDescription>{note.message}</AlertDescription>
                    </Alert>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <Separator />
      <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
        Esta herramienta apoya la trazabilidad del cálculo y no reemplaza la revisión
        profesional, el modelo estructural ni la aplicación integral de la NSR-10. Verifica
        las hipótesis, la regularidad, la dirección de análisis y las condiciones particulares
        del proyecto antes de usar los resultados.
      </p>
    </main>
  )
}
