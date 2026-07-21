"use client";

import {
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";

import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";

const spectra = [
	{ period: 0, soilC: 0.27, soilD: 0.33, soilE: 0.37 },
	{ period: 0.1, soilC: 0.51, soilD: 0.62, soilE: 0.65 },
	{ period: 0.2, soilC: 0.72, soilD: 0.81, soilE: 0.91 },
	{ period: 0.4, soilC: 0.72, soilD: 0.81, soilE: 0.91 },
	{ period: 0.6, soilC: 0.72, soilD: 0.81, soilE: 0.91 },
	{ period: 0.8, soilC: 0.68, soilD: 0.76, soilE: 0.91 },
	{ period: 1, soilC: 0.54, soilD: 0.61, soilE: 0.82 },
	{ period: 1.5, soilC: 0.36, soilD: 0.41, soilE: 0.61 },
	{ period: 2, soilC: 0.27, soilD: 0.3, soilE: 0.46 },
	{ period: 2.5, soilC: 0.22, soilD: 0.24, soilE: 0.36 },
	{ period: 3, soilC: 0.18, soilD: 0.2, soilE: 0.3 },
	{ period: 3.5, soilC: 0.15, soilD: 0.17, soilE: 0.26 },
	{ period: 4, soilC: 0.14, soilD: 0.15, soilE: 0.23 },
] as const;

const chartConfig = {
	soilC: {
		label: "Suelo C · Sa máx 0.72 g",
		color: "var(--chart-2)",
	},
	soilD: {
		label: "Suelo D · Sa máx 0.81 g",
		color: "var(--chart-1)",
	},
	soilE: {
		label: "Suelo E · Sa máx 0.91 g",
		color: "var(--chart-4)",
	},
} satisfies ChartConfig;

export function ComparatorPage() {
	return (
		<section className="flex flex-col gap-4">
			<header className="flex flex-col gap-1">
				<p className="text-sm font-medium text-muted-foreground">
					Vista secundaria
				</p>
				<h1 className="text-2xl font-semibold tracking-tight">
					Comparador de espectros
				</h1>
				<p className="max-w-3xl text-sm text-muted-foreground">
					Superpone perfiles de suelo, ciudades o niveles de amenaza sobre un
					mismo eje para facilitar su lectura simultánea.
				</p>
			</header>

			<Card>
				<CardHeader>
				<CardTitle>Cali · Grupo I · perfiles de suelo</CardTitle>
				<CardDescription>
					Espectros elásticos de diseño superpuestos (Sa vs. T)
				</CardDescription>
				</CardHeader>
				<CardContent>
				<ChartContainer
					config={chartConfig}
					className="h-[22rem] min-h-80 w-full sm:h-[28rem]"
					initialDimension={{ width: 720, height: 448 }}
				>
					<LineChart
						accessibilityLayer
						data={spectra}
						margin={{ top: 12, right: 12, bottom: 8, left: 0 }}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="period"
							domain={[0, 4]}
							label={{ value: "Periodo T (s)", position: "insideBottom", offset: -4 }}
							tickLine={false}
							tickMargin={10}
							type="number"
						/>
						<YAxis
							axisLine={false}
							domain={[0, 1]}
							label={{ value: "Sa (g)", angle: -90, position: "insideLeft" }}
							tickFormatter={(value: number) => value.toFixed(1)}
							tickLine={false}
							tickMargin={8}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									indicator="line"
									labelFormatter={(_, payload) =>
										`T = ${Number(payload[0]?.payload?.period ?? 0).toFixed(2)} s`
									}
									formatter={(value, name) => (
										<div className="flex w-full items-center justify-between gap-4">
											<span className="text-muted-foreground">
												{chartConfig[name as keyof typeof chartConfig]?.label}
											</span>
											<span className="font-mono font-medium tabular-nums">
												{Number(value).toFixed(3)} g
											</span>
										</div>
									)}
								/>
							}
						/>
						<ChartLegend
							content={<ChartLegendContent className="flex-wrap" />}
						/>
						<Line
							dataKey="soilC"
							dot={false}
							isAnimationActive={false}
							stroke="var(--color-soilC)"
							strokeWidth={2}
							type="linear"
						/>
						<Line
							dataKey="soilD"
							dot={false}
							isAnimationActive={false}
							stroke="var(--color-soilD)"
							strokeWidth={2.5}
							type="linear"
						/>
						<Line
							dataKey="soilE"
							dot={false}
							isAnimationActive={false}
							stroke="var(--color-soilE)"
							strokeWidth={2}
							type="linear"
						/>
					</LineChart>
				</ChartContainer>
				</CardContent>
				<CardFooter>
				<p className="text-xs text-muted-foreground">
					Datos estáticos e ilustrativos para el prototipo; no representan un
					cálculo normativo.
				</p>
				</CardFooter>
			</Card>
		</section>
	);
}
