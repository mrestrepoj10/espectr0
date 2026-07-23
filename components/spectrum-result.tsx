"use client"

import { forwardRef } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  CalculatorNotices,
  CalculatorResultHeader,
} from "@/components/calculator-shell"
import { Badge } from "@/components/ui/badge"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type {
  NormalizedSpectrumPoint,
  SpectrumMetric,
  SpectrumWarning,
} from "@/lib/spectra"

const chartConfig = {
  saG: {
    label: "Sa (g)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export type SharedSpectrumResult = {
  points: readonly NormalizedSpectrumPoint[]
  metrics: readonly SpectrumMetric[]
  warnings: readonly SpectrumWarning[]
  hazard: {
    label: string
    returnPeriodYears: number
    dampingRatio: number
  }
}

export type MetricPresentation = {
  label?: string
  digits?: number
}

function formatDecimal(value: number, digits: number) {
  const factor = 10 ** digits
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor
  return rounded.toFixed(digits)
}

function metricValue(
  metrics: readonly SpectrumMetric[],
  id: string,
): number | undefined {
  return metrics.find((metric) => metric.id === id)?.value
}

function formatMetric(
  metric: SpectrumMetric,
  presentation: MetricPresentation | undefined,
) {
  const digits = presentation?.digits ?? (metric.unit === "g" ? 3 : 2)
  const suffix = metric.unit === "g" ? " g" : metric.unit === "s" ? " s" : ""
  return `${formatDecimal(metric.value, digits)}${suffix}`
}

export const SharedSpectrumChart = forwardRef<
  HTMLDivElement,
  {
    result: SharedSpectrumResult
    title: string
    description: string
    actions?: React.ReactNode
    highlight?: string
    transitionMetrics?: readonly { id: string; label: string }[]
  }
>(function SharedSpectrumChart(
  {
    result,
    title,
    description,
    actions,
    highlight,
    transitionMetrics = [],
  },
  ref,
) {
  const plotEnd = result.points.at(-1)?.tSeconds ?? 4

  return (
    <Card variant="elevated">
      <CalculatorResultHeader
        actions={actions}
        applicability="applicable"
        description={description}
        highlight={highlight}
        title={title}
      />
      <CardContent>
        <ChartContainer
          aria-label={`${title} calculado`}
          className="h-80 w-full md:h-96"
          config={chartConfig}
          initialDimension={{ width: 960, height: 384 }}
          ref={ref}
        >
          <AreaChart
            accessibilityLayer
            data={result.points}
            margin={{ top: 12, right: 16, bottom: 24, left: 4 }}
          >
            <defs>
              <linearGradient id="spectrum-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-saG)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-saG)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid className="stroke-border" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="tSeconds"
              domain={[0, plotEnd]}
              label={{ value: "Periodo T (s)", position: "insideBottom", offset: -16 }}
              tickFormatter={(value) => formatDecimal(Number(value), 2)}
              tickLine={false}
              tickMargin={8}
              type="number"
            />
            <YAxis
              axisLine={false}
              domain={[0, "auto"]}
              label={{ value: "Sa (g)", angle: -90, position: "insideLeft" }}
              tickFormatter={(value) => Number(value).toFixed(2)}
              tickLine={false}
              tickMargin={8}
            />
            {transitionMetrics.map((transition) => {
              const value = metricValue(result.metrics, transition.id)
              return value === undefined ? null : (
                <ReferenceLine
                  key={transition.id}
                  label={{ value: transition.label, position: "insideTopRight" }}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  x={value}
                />
              )
            })}
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(_, payload) =>
                    `T = ${Number(payload[0]?.payload?.tSeconds ?? 0).toFixed(3)} s`
                  }
                />
              }
              cursor={false}
            />
            <Area
              activeDot={{ r: 5 }}
              dataKey="saG"
              fill="url(#spectrum-fill)"
              fillOpacity={1}
              isAnimationActive={false}
              stroke="var(--color-saG)"
              strokeWidth={2.5}
              type="linear"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <p className="text-muted-foreground text-xs">
          TR {result.hazard.returnPeriodYears} años · amortiguamiento crítico del{" "}
          {result.hazard.dampingRatio * 100} % · aceleraciones como fracción de g.
        </p>
      </CardFooter>
    </Card>
  )
})

export function SharedSpectrumMetrics({
  metrics,
  presentation = {},
}: {
  metrics: readonly SpectrumMetric[]
  presentation?: Readonly<Record<string, MetricPresentation>>
}) {
  return (
    <section aria-labelledby="derived-parameters" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading font-medium" id="derived-parameters">
          Parámetros calculados
        </h2>
        <Badge variant="outline">Resultado del motor activo</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((metric) => (
          <Card key={metric.id} size="sm" variant="metric">
            <CardHeader>
              <CardTitle className="font-normal text-muted-foreground text-xs">
                {presentation[metric.id]?.label ?? metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono font-semibold text-xl tabular-nums">
                {formatMetric(metric, presentation[metric.id])}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

export function SharedSpectrumTable({
  points,
  branchLabels = {},
}: {
  points: readonly NormalizedSpectrumPoint[]
  branchLabels?: Readonly<Record<string, string>>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del espectro</CardTitle>
        <CardDescription>{points.length} puntos calculados por el motor activo.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Tramo</TableHead>
                <TableHead className="text-right">T (s)</TableHead>
                <TableHead className="text-right">Sa (g)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point) => (
                <TableRow key={point.tSeconds}>
                  <TableCell className="font-medium">
                    {branchLabels[point.branchId] ?? point.branchId}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {point.tSeconds.toFixed(3)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {point.saG.toFixed(6)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export function SharedSpectrumNotices({ warnings }: { warnings: readonly SpectrumWarning[] }) {
  return (
    <CalculatorNotices
      applicability="applicable"
      notices={warnings.map((warning) => ({
        code: warning.code,
        severity: warning.severity,
        title: warning.severity === "error" ? "Error" : "Advertencia del motor",
        message: warning.message,
      }))}
    />
  )
}
