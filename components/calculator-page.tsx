"use client";

import {
	Area,
	AreaChart,
	CartesianGrid,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

const locations = [
	{ label: "Cali, Valle del Cauca", value: "cali" },
	{ label: "Bogotá, D. C.", value: "bogota" },
	{ label: "Medellín, Antioquia", value: "medellin" },
] as const;

const hazardLevels = [
	{ label: "Diseño · Tᴿ 475 años", value: "475" },
	{ label: "Servicio · Tᴿ 43 años", value: "43" },
	{ label: "Máximo considerado · Tᴿ 2.475 años", value: "2475" },
] as const;

const spectrumData = [
	{ period: 0, sa: 0.325 },
	{ period: 0.073, sa: 0.569 },
	{ period: 0.146, sa: 0.813 },
	{ period: 0.4, sa: 0.813 },
	{ period: 0.702, sa: 0.813 },
	{ period: 1, sa: 0.57 },
	{ period: 1.5, sa: 0.38 },
	{ period: 2, sa: 0.285 },
	{ period: 3, sa: 0.19 },
	{ period: 4, sa: 0.143 },
	{ period: 4.56, sa: 0.125 },
	{ period: 6, sa: 0.072 },
	{ period: 8, sa: 0.041 },
] as const;

const chartConfig = {
	sa: {
		label: "Sa (g)",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

const parameters = [
	{ label: "Aa", value: "0.25" },
	{ label: "Av", value: "0.25" },
	{ label: "Fa", value: "1.30" },
	{ label: "Fv", value: "1.90" },
	{ label: "I", value: "1.00" },
	{ label: "T₀", value: "0.146 s" },
	{ label: "Tc", value: "0.702 s" },
	{ label: "TL", value: "4.56 s" },
	{ label: "Sa máx", value: "0.813 g" },
	{ label: "PGA", value: "0.325 g" },
] as const;

const previewRows = [
	{ branch: "T₀", period: "0.146", sa: "0.813" },
	{ branch: "Meseta", period: "0.400", sa: "0.813" },
	{ branch: "Tc", period: "0.702", sa: "0.813" },
	{ branch: "Descendente", period: "1.000", sa: "0.570" },
] as const;

function SegmentedOptions({
	active,
	ariaLabel,
	options,
}: {
	active: string;
	ariaLabel: string;
	options: readonly string[];
}) {
	return (
		<div aria-label={ariaLabel} className="flex flex-wrap gap-1" role="group">
			{options.map((option) => (
				<Button
					aria-pressed={option === active}
					className="min-w-8 flex-1"
					key={option}
					size="sm"
					type="button"
					variant={option === active ? "default" : "outline"}
				>
					{option}
				</Button>
			))}
		</div>
	);
}

function ParameterRail() {
	return (
		<Card className="self-start shadow-none dark:ring-0" size="sm">
			<CardHeader>
				<CardTitle>Parámetros del sitio</CardTitle>
				<CardDescription>
					Entradas de referencia para esta vista preliminar.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="flex flex-col gap-5">
					<fieldset className="flex flex-col gap-2">
						<legend className="mb-2 text-sm font-medium">Norma</legend>
						<SegmentedOptions
							active="NSR-10"
							ariaLabel="Norma de diseño"
							options={["NSR-10", "CCP-14"]}
						/>
					</fieldset>

					<label className="flex flex-col gap-2 text-sm font-medium">
						Ubicación
						<Select defaultValue="cali" items={locations}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>Municipio</SelectLabel>
									{locations.map((location) => (
										<SelectItem key={location.value} value={location.value}>
											{location.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
						<span className="font-normal text-muted-foreground text-xs">
							Zona de amenaza sísmica alta
						</span>
					</label>

					<fieldset className="flex flex-col gap-2">
						<legend className="mb-2 text-sm font-medium">
							Perfil de suelo
						</legend>
						<SegmentedOptions
							active="D"
							ariaLabel="Perfil de suelo"
							options={["A", "B", "C", "D", "E", "F"]}
						/>
						<p className="text-muted-foreground text-xs">
							D — Perfil de suelo rígido
						</p>
					</fieldset>

					<fieldset className="flex flex-col gap-2">
						<legend className="mb-2 text-sm font-medium">Grupo de uso</legend>
						<SegmentedOptions
							active="I"
							ariaLabel="Grupo de uso"
							options={["I", "II", "III", "IV"]}
						/>
						<p className="text-muted-foreground text-xs">
							I — Coeficiente de importancia I = 1.00
						</p>
					</fieldset>

					<label className="flex flex-col gap-2 text-sm font-medium">
						Nivel de amenaza
						<Select defaultValue="475" items={hazardLevels}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>Periodo de retorno</SelectLabel>
									{hazardLevels.map((level) => (
										<SelectItem key={level.value} value={level.value}>
											{level.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</label>
				</form>
			</CardContent>
			<CardFooter className="flex-col items-stretch gap-3">
				<Separator />
				<p className="text-muted-foreground text-xs">
					Controles ilustrativos; no ejecutan cálculos en este prototipo.
				</p>
			</CardFooter>
		</Card>
	);
}

function SpectrumChart() {
	return (
		<Card className="shadow-none dark:ring-0">
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex flex-col gap-1.5">
						<CardTitle>Espectro elástico de diseño (Sa vs. T)</CardTitle>
						<CardDescription>
							Forma estática de referencia: ascenso, meseta y ramas
							decrecientes.
						</CardDescription>
					</div>
					<Badge variant="secondary">Sa máx 0.813 g</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<ChartContainer
					aria-label="Espectro elástico de diseño NSR-10 ilustrativo"
					className="h-80 w-full md:h-96"
					config={chartConfig}
					initialDimension={{ width: 960, height: 384 }}
				>
					<AreaChart
						accessibilityLayer
						data={spectrumData}
						margin={{ top: 12, right: 16, bottom: 24, left: 4 }}
					>
						<defs>
							<linearGradient id="spectrum-fill" x1="0" x2="0" y1="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-sa)"
									stopOpacity={0.35}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-sa)"
									stopOpacity={0.02}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid className="stroke-border" vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="period"
							domain={[0, 8]}
							label={{ value: "Periodo T (s)", position: "insideBottom", offset: -16 }}
							tickLine={false}
							tickMargin={8}
							ticks={[0, 1, 2, 3, 4, 6, 8]}
							type="number"
						/>
						<YAxis
							axisLine={false}
							domain={[0, 0.9]}
							label={{ value: "Sa (g)", angle: -90, position: "insideLeft" }}
							tickFormatter={(value) => Number(value).toFixed(1)}
							tickLine={false}
							tickMargin={8}
							ticks={[0, 0.2, 0.4, 0.6, 0.8]}
						/>
						<ReferenceLine
							label={{ value: "T₀", position: "insideTopRight" }}
							stroke="var(--muted-foreground)"
							strokeDasharray="3 3"
							x={0.146}
						/>
						<ReferenceLine
							label={{ value: "Tc", position: "insideTopRight" }}
							stroke="var(--muted-foreground)"
							strokeDasharray="3 3"
							x={0.702}
						/>
						<ReferenceLine
							label={{ value: "TL", position: "insideTopRight" }}
							stroke="var(--muted-foreground)"
							strokeDasharray="3 3"
							x={4.56}
						/>
						<ChartTooltip
							content={<ChartTooltipContent indicator="line" />}
							cursor={false}
						/>
						<Area
							activeDot={{ r: 5 }}
							dataKey="sa"
							fill="url(#spectrum-fill)"
							fillOpacity={1}
							isAnimationActive={false}
							stroke="var(--color-sa)"
							strokeWidth={2.5}
							type="linear"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
			<CardFooter>
				<p className="text-muted-foreground text-xs">
					Valores estáticos e ilustrativos; no aptos para diseño estructural.
				</p>
			</CardFooter>
		</Card>
	);
}

function ParameterTiles() {
	return (
		<section aria-labelledby="derived-parameters" className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="font-heading font-medium" id="derived-parameters">
					Parámetros de referencia
				</h2>
				<Badge variant="outline">Valores ilustrativos</Badge>
			</div>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
				{parameters.map((parameter) => (
					<Card className="shadow-none dark:ring-0" key={parameter.label} size="sm">
						<CardHeader>
							<CardTitle className="font-normal text-muted-foreground text-xs">
								{parameter.label}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-mono font-semibold text-xl tabular-nums">
								{parameter.value}
							</p>
						</CardContent>
					</Card>
				))}
			</div>
		</section>
	);
}

function SpectrumPreview() {
	return (
		<Card className="shadow-none dark:ring-0">
			<CardHeader>
				<CardTitle>Vista previa de datos</CardTitle>
				<CardDescription>
					Puntos representativos de cada tramo del espectro ilustrativo.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Tramo</TableHead>
							<TableHead className="text-right">T (s)</TableHead>
							<TableHead className="text-right">Sa (g)</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{previewRows.map((row) => (
							<TableRow key={row.branch}>
								<TableCell className="font-medium">{row.branch}</TableCell>
								<TableCell className="text-right font-mono tabular-nums">
									{row.period}
								</TableCell>
								<TableCell className="text-right font-mono tabular-nums">
									{row.sa}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

export function CalculatorPage() {
	return (
		<div className="flex flex-col gap-5">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="font-heading font-semibold text-2xl tracking-tight">
						Calculadora de espectro
					</h1>
					<p className="text-muted-foreground text-sm">
						Prototipo visual para espectros de diseño NSR-10 / CCP-14.
					</p>
				</div>
				<Badge variant="outline">Prototipo · datos estáticos</Badge>
			</header>

			<div className="grid items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
				<ParameterRail />
				<div className="flex min-w-0 flex-col gap-4">
					<SpectrumChart />
					<ParameterTiles />
					<SpectrumPreview />
				</div>
			</div>
		</div>
	);
}
