"use client";

import { useMemo, useRef, useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
import {
	ChevronDownIcon,
	CodeXmlIcon,
	DownloadIcon,
	FileJsonIcon,
	FileTextIcon,
	ImageIcon,
	PlusIcon,
	Trash2Icon,
	TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
	defaultMunicipio,
	getMunicipalityCoefficients,
	HazardLevelControl,
	ImportanceGroupControl,
	MunicipalityCombobox,
	SoilProfileControl,
} from "@/components/spectrum-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldTitle } from "@/components/ui/field";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	copyChartPng,
	copyChartSvg,
	copyTextToClipboard,
	downloadEtabsTxt,
} from "@/lib/chart-export";
import { normalizeSearchText } from "@/lib/nsr10";
import {
	buildComparisonChartData,
	comparisonJson,
	computeComparisonScenarios,
	formatComparisonCsv,
	MAX_COMPARISON_SCENARIOS,
} from "@/lib/spectrum-comparison";

import type {
	ComparisonChartRow,
	ComparisonScenario,
	ComputedComparisonScenario,
} from "@/lib/spectrum-comparison";

const SERIES_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--chart-2)",
] as const;

const INITIAL_SCENARIOS: ComparisonScenario[] = [
	{
		id: "scenario-1",
		municipio: defaultMunicipio,
		soilProfile: "C",
		importanceGroup: "I",
		hazardLevel: "design",
	},
	{
		id: "scenario-2",
		municipio: defaultMunicipio,
		soilProfile: "D",
		importanceGroup: "I",
		hazardLevel: "design",
	},
	{
		id: "scenario-3",
		municipio: defaultMunicipio,
		soilProfile: "E",
		importanceGroup: "I",
		hazardLevel: "design",
	},
];

function downloadText(content: string, type: string, filename: string) {
	const blob = new Blob([content], { type });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

function scenarioFilename(scenario: ComputedComparisonScenario) {
	return normalizeSearchText(
		`${scenario.municipio.municipio}-${scenario.soilProfile}-${scenario.importanceGroup}-${scenario.hazardLevel}`,
	).replace(/\s+/g, "-");
}

function ScenarioCard({
	scenario,
	index,
	canRemove,
	onChange,
	onRemove,
}: {
	scenario: ComputedComparisonScenario;
	index: number;
	canRemove: boolean;
	onChange: (changes: Partial<ComparisonScenario>) => void;
	onRemove: () => void;
}) {
	return (
		<Card className="min-w-0" size="sm" variant="metric">
			<CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
				<div className="min-w-0">
					<div className="mb-1.5 flex items-center gap-2">
						<Badge variant="outline">Escenario {index + 1}</Badge>
						{scenario.result.status !== "ok" ? (
							<Badge variant="secondary">Sin línea</Badge>
						) : null}
					</div>
					<CardTitle className="truncate text-sm" title={scenario.label}>
						{scenario.label}
					</CardTitle>
				</div>
				<Button
					aria-label={`Eliminar escenario ${index + 1}`}
					disabled={!canRemove}
					onClick={onRemove}
					size="icon-lg"
					title={canRemove ? "Eliminar escenario" : "Debe conservarse al menos un escenario"}
					type="button"
					variant="ghost"
				>
					<Trash2Icon />
				</Button>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<Field>
					<FieldTitle>Municipio</FieldTitle>
					<MunicipalityCombobox
						onValueChange={(municipio) => onChange({ municipio })}
						value={scenario.municipio}
					/>
					<FieldDescription>
						{getMunicipalityCoefficients(
							scenario.municipio,
							scenario.hazardLevel,
						)}{" "}
						· Apéndice A-4
					</FieldDescription>
				</Field>
				<SoilProfileControl
					onValueChange={(soilProfile) => onChange({ soilProfile })}
					value={scenario.soilProfile}
				/>
				<ImportanceGroupControl
					hazardLevel={scenario.hazardLevel}
					onValueChange={(importanceGroup) => onChange({ importanceGroup })}
					value={scenario.importanceGroup}
				/>
				<HazardLevelControl
					onValueChange={(hazardLevel) => onChange({ hazardLevel })}
					value={scenario.hazardLevel}
				/>

				{scenario.result.status === "site-specific-study-required" ? (
					<Alert>
						<TriangleAlertIcon />
						<AlertTitle>Perfil F: estudio específico</AlertTitle>
						<AlertDescription>
							A.2.10 requiere una investigación geotécnica y un análisis de
							respuesta del sitio. Este escenario no genera una línea.
						</AlertDescription>
					</Alert>
				) : null}
			</CardContent>
		</Card>
	);
}

function ComparisonExportActions({
	chartContainerRef,
	scenarios,
	chartData,
}: {
	chartContainerRef: React.RefObject<HTMLDivElement | null>;
	scenarios: readonly ComputedComparisonScenario[];
	chartData: readonly ComparisonChartRow[];
}) {
	const successful = scenarios.filter(
		(scenario) => scenario.result.status === "ok",
	);

	function chartSvg() {
		const svg = chartContainerRef.current?.querySelector<SVGSVGElement>(
			"svg.recharts-surface",
		);
		if (!svg) throw new Error("No se encontró el gráfico para exportar.");
		return svg;
	}

	function copyJson() {
		void copyTextToClipboard(JSON.stringify(comparisonJson(scenarios), null, 2))
			.then(() => toast.success("Comparación JSON copiada."))
			.catch(() => toast.error("No fue posible copiar la comparación JSON."));
	}

	function copyPng() {
		try {
			void copyChartPng(chartSvg(), chartContainerRef.current)
				.then(() => toast.success("Gráfico PNG copiado."))
				.catch(() => toast.error("No fue posible copiar el gráfico PNG."));
		} catch {
			toast.error("No fue posible copiar el gráfico PNG.");
		}
	}

	function copySvg() {
		try {
			void copyChartSvg(chartSvg())
				.then(() => toast.success("Gráfico SVG copiado."))
				.catch(() => toast.error("No fue posible copiar el gráfico SVG."));
		} catch {
			toast.error("No fue posible copiar el gráfico SVG.");
		}
	}

	function exportCsv() {
		try {
			downloadText(
				`\uFEFF${formatComparisonCsv(scenarios, chartData)}`,
				"text/csv;charset=utf-8",
				"espectr0-comparacion.csv",
			);
			toast.success("Comparación CSV descargada.");
		} catch {
			toast.error("No fue posible descargar la comparación CSV.");
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button className="h-10" type="button" variant="outline" />}
			>
				<DownloadIcon data-icon="inline-start" />
				Exportar
				<ChevronDownIcon data-icon="inline-end" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" aria-label="Exportar comparación">
				<DropdownMenuGroup>
					<DropdownMenuItem onClick={copyJson}>
						<FileJsonIcon />
						Copiar JSON
					</DropdownMenuItem>
					<DropdownMenuItem disabled={!successful.length} onClick={copyPng}>
						<ImageIcon />
						Copiar PNG
					</DropdownMenuItem>
					<DropdownMenuItem disabled={!successful.length} onClick={copySvg}>
						<CodeXmlIcon />
						Copiar SVG
					</DropdownMenuItem>
					<DropdownMenuItem disabled={!successful.length} onClick={exportCsv}>
						<DownloadIcon />
						Descargar CSV
					</DropdownMenuItem>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger disabled={!successful.length}>
							<FileTextIcon />
							TXT para ETABS
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							{successful.map((scenario) => {
								if (scenario.result.status !== "ok") return null;
								const points = scenario.result.points;
								return (
									<DropdownMenuItem
										key={scenario.id}
										onClick={() => {
											try {
												downloadEtabsTxt(
													points,
													`espectr0-${scenarioFilename(scenario)}-etabs.txt`,
												);
												toast.success("TXT para ETABS descargado.");
											} catch {
												toast.error("No fue posible descargar el TXT para ETABS.");
											}
										}}
										title={scenario.label}
									>
										<span className="max-w-64 truncate">{scenario.label}</span>
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ComparisonChart({
	scenarios,
	chartData,
}: {
	scenarios: readonly ComputedComparisonScenario[];
	chartData: readonly ComparisonChartRow[];
}) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const successful = scenarios.filter(
		(scenario) => scenario.result.status === "ok",
	);
	const chartConfig = useMemo(
		() =>
			Object.fromEntries(
				scenarios.map((scenario, index) => [
					scenario.seriesKey,
					{
						label: scenario.label,
						color: SERIES_COLORS[index] ?? SERIES_COLORS[0],
					},
				]),
			) as ChartConfig,
		[scenarios],
	);

	return (
		<Card variant="elevated">
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex min-w-0 flex-col gap-1.5">
						<CardTitle>Espectros elásticos superpuestos (Sa vs. T)</CardTitle>
						<CardDescription>
							Ordenadas calculadas por el motor NSR-10 sobre un eje común.
						</CardDescription>
					</div>
					<ComparisonExportActions
						chartContainerRef={chartContainerRef}
						chartData={chartData}
						scenarios={scenarios}
					/>
				</div>
			</CardHeader>
			<CardContent>
				{successful.length ? (
					<ChartContainer
						aria-label="Comparación de espectros elásticos NSR-10"
						className="h-[24rem] min-h-80 w-full sm:h-[30rem]"
						config={chartConfig}
						initialDimension={{ width: 960, height: 480 }}
						ref={chartContainerRef}
					>
						<LineChart
							accessibilityLayer
							data={chartData}
							margin={{ top: 12, right: 16, bottom: 24, left: 4 }}
						>
							<CartesianGrid className="stroke-border" vertical={false} />
							<XAxis
								axisLine={false}
								dataKey="t"
								domain={[0, "dataMax"]}
								label={{ value: "Periodo T (s)", position: "insideBottom", offset: -16 }}
								tickFormatter={(value) => Number(value).toFixed(2)}
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
							<ChartTooltip
								content={
									<ChartTooltipContent
										className="max-w-sm"
										indicator="line"
										labelFormatter={(_, payload) =>
											`T = ${Number(payload[0]?.payload?.t ?? 0).toFixed(3)} s`
										}
										formatter={(value, name) => (
											<div className="flex w-full items-center justify-between gap-4">
												<span className="line-clamp-2 text-muted-foreground">
													{chartConfig[String(name)]?.label}
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
							{successful.map((scenario) => {
								const index = scenarios.findIndex(({ id }) => id === scenario.id);
								return (
									<Line
										activeDot={{ r: 4 }}
										dataKey={scenario.seriesKey}
										dot={false}
										isAnimationActive={false}
										key={scenario.id}
										stroke={`var(--color-${scenario.seriesKey})`}
										strokeDasharray={index === 5 ? "7 4" : undefined}
										strokeWidth={index === 5 ? 2.5 : 2}
										type="linear"
									/>
								);
							})}
						</LineChart>
					</ChartContainer>
				) : (
					<Alert>
						<TriangleAlertIcon />
						<AlertTitle>No hay espectros para superponer</AlertTitle>
						<AlertDescription>
							Todos los escenarios usan perfil F. Cambia al menos uno a un perfil
							A–E para generar el gráfico.
						</AlertDescription>
					</Alert>
				)}
			</CardContent>
			<CardFooter>
				<p className="text-xs text-muted-foreground">
					JSON conserva entradas y resultados de todos los escenarios; CSV alinea
					las series válidas; cada TXT de ETABS mantiene dos columnas T–Sa.
					{scenarios.length === MAX_COMPARISON_SCENARIOS
						? " La sexta serie reutiliza el segundo tono con trazo discontinuo."
						: ""}
				</p>
			</CardFooter>
		</Card>
	);
}

function ComparisonTable({
	scenarios,
}: {
	scenarios: readonly ComputedComparisonScenario[];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Resumen comparativo</CardTitle>
				<CardDescription>
					Parámetros derivados directamente de cada resultado del motor.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Escenario</TableHead>
							<TableHead className="text-right">Sa máx</TableHead>
							<TableHead className="text-right">TC</TableHead>
							<TableHead className="text-right">TL</TableHead>
							<TableHead className="text-right">PGA</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{scenarios.map((scenario) => {
							const coefficients =
								scenario.result.status === "ok"
									? scenario.result.coefficients
									: null;
							return (
								<TableRow key={scenario.id}>
									<TableCell className="max-w-72 whitespace-normal font-medium">
										{scenario.label}
									</TableCell>
									{coefficients ? (
										<>
											<TableCell className="text-right font-mono tabular-nums">
												{coefficients.saMax.toFixed(3)} g
											</TableCell>
											<TableCell className="text-right font-mono tabular-nums">
												{coefficients.tc.toFixed(3)} s
											</TableCell>
											<TableCell className="text-right font-mono tabular-nums">
												{coefficients.tl.toFixed(3)} s
											</TableCell>
											<TableCell className="text-right font-mono tabular-nums">
												{coefficients.pga.toFixed(3)} g
											</TableCell>
										</>
									) : (
										<TableCell className="whitespace-normal text-muted-foreground" colSpan={4}>
											Perfil F · estudio específico requerido
										</TableCell>
									)}
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

export function ComparatorPage() {
	const [scenarios, setScenarios] = useState<ComparisonScenario[]>(INITIAL_SCENARIOS);
	const nextScenarioId = useRef(INITIAL_SCENARIOS.length + 1);
	const computedScenarios = useMemo(
		() => computeComparisonScenarios(scenarios),
		[scenarios],
	);
	const chartData = useMemo(
		() => buildComparisonChartData(computedScenarios),
		[computedScenarios],
	);

	function updateScenario(id: string, changes: Partial<ComparisonScenario>) {
		setScenarios((current) =>
			current.map((scenario) =>
				scenario.id === id ? { ...scenario, ...changes, id: scenario.id } : scenario,
			),
		);
	}

	function addScenario() {
		setScenarios((current) => {
			if (current.length >= MAX_COMPARISON_SCENARIOS) return current;
			const source = current.at(-1) ?? INITIAL_SCENARIOS[0];
			if (!source) return current;
			return [
				...current,
				{
					...source,
					id: `scenario-${nextScenarioId.current++}`,
				},
			];
		});
	}

	return (
		<section className="flex flex-col gap-5">
			<header className="flex flex-col gap-1">
				<p className="text-sm font-medium text-muted-foreground">Análisis paralelo</p>
				<h1 className="text-2xl font-semibold tracking-tight">Comparador de espectros</h1>
				<p className="max-w-3xl text-sm text-muted-foreground">
					Superpone hasta seis municipios, perfiles de suelo, grupos de uso o niveles
					de amenaza calculados localmente con el motor NSR-10.
				</p>
			</header>

			<Card>
				<CardHeader>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="flex min-w-0 flex-col gap-1.5">
							<div className="flex flex-wrap items-center gap-2">
								<CardTitle>Escenarios</CardTitle>
								<Badge variant="secondary">
									{scenarios.length} de {MAX_COMPARISON_SCENARIOS}
								</Badge>
							</div>
							<CardDescription>
								Edita cada conjunto de entradas; los resultados se actualizan en tiempo real.
							</CardDescription>
						</div>
						<Button
							disabled={scenarios.length >= MAX_COMPARISON_SCENARIOS}
							onClick={addScenario}
							size="lg"
							type="button"
						>
							<PlusIcon data-icon="inline-start" />
							Agregar escenario
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
						{computedScenarios.map((scenario, index) => (
							<ScenarioCard
								canRemove={scenarios.length > 1}
								index={index}
								key={scenario.id}
								onChange={(changes) => updateScenario(scenario.id, changes)}
								onRemove={() =>
									setScenarios((current) =>
										current.filter(({ id }) => id !== scenario.id),
									)
								}
								scenario={scenario}
							/>
						))}
					</div>
				</CardContent>
			</Card>

			<ComparisonChart chartData={chartData} scenarios={computedScenarios} />
			<ComparisonTable scenarios={computedScenarios} />
		</section>
	);
}
