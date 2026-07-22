"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
import {
	ClipboardIcon,
	DownloadIcon,
	ExternalLinkIcon,
	FileTextIcon,
	LandmarkIcon,
	ListTreeIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "@/components/ui/field";
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
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	computeSpectrum,
	lookupMunicipio,
	municipios,
	normalizeSearchText,
} from "@/lib/nsr10";

import type {
	ImportanceGroup,
	Municipio,
	SoilProfile,
	SpectrumBranch,
	SpectrumOk,
} from "@/lib/nsr10";

const standards = [
	{ label: "NSR-10", value: "nsr10", disabled: false },
	{ label: "CCP-14 · próximamente", value: "ccp14", disabled: true },
] as const;

const hazardLevels = [
	{ label: "Diseño · TR 475 años", value: "475", disabled: false },
	{ label: "Servicio · TR 43 años · próximamente", value: "43", disabled: true },
	{
		label: "Máximo considerado · TR 2.475 años · próximamente",
		value: "2475",
		disabled: true,
	},
] as const;

const soilProfiles = ["A", "B", "C", "D", "E", "F"] as const;
const importanceGroups = ["I", "II", "III", "IV"] as const;

const soilDescriptions: Record<SoilProfile, string> = {
	A: "Roca competente",
	B: "Roca de rigidez media",
	C: "Suelo muy denso o roca blanda",
	D: "Suelo rígido",
	E: "Suelo blando",
	F: "Requiere estudio específico",
};

const importanceDescriptions: Record<ImportanceGroup, string> = {
	I: "Ocupación normal",
	II: "Atención a la comunidad",
	III: "Edificación indispensable",
	IV: "Edificación esencial",
};

const importanceValues: Record<ImportanceGroup, string> = {
	I: "1.00",
	II: "1.10",
	III: "1.25",
	IV: "1.50",
};

const branchLabels: Record<SpectrumBranch, string> = {
	"rising-A.2.6-7": "Ascendente · A.2.6-7",
	"plateau-A.2.6-3": "Meseta · A.2.6-3",
	"inverse-T-A.2.6-1": "1/T · A.2.6-1",
	"inverse-T2-A.2.6-5": "1/T² · A.2.6-5",
};

const chartConfig = {
	sa: {
		label: "Sa (g)",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

const defaultMunicipio = lookupMunicipio("Cali", "Valle del Cauca")[0];

const sourceNsr10PdfUrl =
	"https://iisee.kenken.go.jp/worldlist/11_Colombia/Colombia%20Titulo%20A-NSR-10-Ver-2017.pdf";

const CaliSourcePdf = dynamic(
	() => import("@/components/cali-source-pdf").then((module) => module.CaliSourcePdf),
	{
		ssr: false,
		loading: () => <Skeleton className="aspect-[612/792] w-full" />,
	},
);

if (!defaultMunicipio) {
	throw new Error("El conjunto NSR-10 no contiene el municipio predeterminado de Cali");
}

function municipioLabel(municipio: Municipio) {
	return `${municipio.municipio}, ${municipio.departamento}`;
}

function formatDecimal(value: number, digits: number) {
	const factor = 10 ** digits;
	const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
	return rounded.toFixed(digits);
}

function municipioMatches(municipio: Municipio, query: string) {
	const normalizedQuery = normalizeSearchText(query);
	if (!normalizedQuery) return true;

	return normalizeSearchText(municipioLabel(municipio)).includes(normalizedQuery);
}

function MunicipalityCombobox({
	value,
	onValueChange,
}: {
	value: Municipio;
	onValueChange: (municipio: Municipio) => void;
}) {
	return (
		<Combobox
			autoHighlight
			filter={municipioMatches}
			isItemEqualToValue={(item, selected) =>
				item.departamento === selected.departamento &&
				item.municipio === selected.municipio
			}
			items={municipios}
			itemToStringLabel={municipioLabel}
			itemToStringValue={municipioLabel}
			onValueChange={(municipio) => {
				if (municipio) onValueChange(municipio);
			}}
			value={value}
		>
			<ComboboxInput
				aria-label="Buscar municipio"
				className="w-full"
				placeholder="Buscar municipio…"
			/>
			<ComboboxContent>
				<ComboboxEmpty>No se encontraron municipios.</ComboboxEmpty>
				<ComboboxList>
					{(municipio: Municipio) => (
						<ComboboxItem
							key={`${municipio.departamento}-${municipio.municipio}`}
							value={municipio}
						>
							<span className="flex min-w-0 flex-col">
								<span className="truncate">{municipio.municipio}</span>
								<span className="truncate font-normal text-muted-foreground text-xs">
									{municipio.departamento} · Aa {municipio.aa.toFixed(2)} · Av{" "}
									{municipio.av.toFixed(2)}
								</span>
							</span>
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

function SingleToggleGroup<T extends string>({
	ariaLabel,
	options,
	value,
	onValueChange,
}: {
	ariaLabel: string;
	options: readonly T[];
	value: T;
	onValueChange: (value: T) => void;
}) {
	return (
		<ToggleGroup
			aria-label={ariaLabel}
			className="w-full flex-wrap"
			onValueChange={(values) => {
				const nextValue = values[0] as T | undefined;
				if (nextValue) onValueChange(nextValue);
			}}
			size="sm"
			value={[value]}
			variant="outline"
		>
			{options.map((option) => (
				<ToggleGroupItem className="min-w-8 flex-1" key={option} value={option}>
					{option}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}

function ParameterRail({
	municipio,
	soilProfile,
	importanceGroup,
	onTraceabilityOpen,
	onMunicipioChange,
	onSoilProfileChange,
	onImportanceGroupChange,
}: {
	municipio: Municipio;
	soilProfile: SoilProfile;
	importanceGroup: ImportanceGroup;
	onTraceabilityOpen: () => void;
	onMunicipioChange: (municipio: Municipio) => void;
	onSoilProfileChange: (profile: SoilProfile) => void;
	onImportanceGroupChange: (group: ImportanceGroup) => void;
}) {
	const hasTraceability =
		municipio.municipio === "Cali" && municipio.departamento === "Valle del Cauca";

	return (
		<Card className="self-start shadow-none dark:ring-0" size="sm">
			<CardHeader>
				<CardTitle>Parámetros del sitio</CardTitle>
				<CardDescription>
					Entradas normativas para el espectro calculado en tiempo real.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup className="gap-5">
					<Field>
						<FieldTitle>Norma</FieldTitle>
						<Select defaultValue="nsr10" items={standards}>
							<SelectTrigger className="w-full" aria-label="Norma de diseño">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>Norma de diseño</SelectLabel>
									{standards.map((standard) => (
										<SelectItem
											disabled={standard.disabled}
											key={standard.value}
											value={standard.value}
										>
											{standard.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>

					<Field>
						<FieldTitle>Municipio</FieldTitle>
						<MunicipalityCombobox
							onValueChange={onMunicipioChange}
							value={municipio}
						/>
						<FieldDescription>
							Aa {municipio.aa.toFixed(2)} · Av {municipio.av.toFixed(2)} · Apéndice A-4
						</FieldDescription>
						<Button
							disabled={!hasTraceability}
							onClick={onTraceabilityOpen}
							size="sm"
							type="button"
							variant="outline"
						>
							<LandmarkIcon data-icon="inline-start" />
							Ver trazabilidad
						</Button>
						{!hasTraceability && (
							<FieldDescription>Este piloto solo está disponible para Cali.</FieldDescription>
						)}
					</Field>

					<FieldSet className="gap-2">
						<FieldLegend variant="label">Perfil de suelo</FieldLegend>
						<SingleToggleGroup
							ariaLabel="Perfil de suelo"
							onValueChange={onSoilProfileChange}
							options={soilProfiles}
							value={soilProfile}
						/>
						<FieldDescription>
							{soilProfile} — {soilDescriptions[soilProfile]}
						</FieldDescription>
					</FieldSet>

					<FieldSet className="gap-2">
						<FieldLegend variant="label">Grupo de uso</FieldLegend>
						<SingleToggleGroup
							ariaLabel="Grupo de uso"
							onValueChange={onImportanceGroupChange}
							options={importanceGroups}
							value={importanceGroup}
						/>
						<FieldDescription>
							{importanceGroup} — {importanceDescriptions[importanceGroup]} · I ={" "}
							{importanceValues[importanceGroup]}
						</FieldDescription>
					</FieldSet>

					<Field>
						<FieldTitle>Nivel de amenaza</FieldTitle>
						<Select defaultValue="475" items={hazardLevels}>
							<SelectTrigger className="w-full" aria-label="Nivel de amenaza">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>Periodo de retorno</SelectLabel>
									{hazardLevels.map((level) => (
										<SelectItem
											disabled={level.disabled}
											key={level.value}
											value={level.value}
										>
											{level.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
				</FieldGroup>
			</CardContent>
			<CardFooter className="flex-col items-stretch gap-3">
				<Separator />
				<p className="text-muted-foreground text-xs">
					Cálculo elástico NSR-10 con amortiguamiento crítico del 5 %.
				</p>
			</CardFooter>
		</Card>
	);
}

function TraceabilitySheet({
	municipio,
	open,
	onOpenChange,
}: {
	municipio: Municipio;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent
				className="h-dvh overflow-hidden border-0 data-[side=right]:w-screen data-[side=right]:max-w-none data-[side=right]:sm:w-[52vw] data-[side=right]:sm:min-w-[36rem] data-[side=right]:sm:max-w-none data-[side=right]:sm:border-l"
				side="right"
			>
				<SheetHeader className="border-b pr-16">
					<div className="flex flex-wrap items-center gap-2">
						<SheetTitle>Trazabilidad normativa</SheetTitle>
						<Badge variant="secondary">Piloto · Cali</Badge>
					</div>
					<SheetDescription>
						Origen de Aa y Av usados por el cálculo actual, con evidencia en la NSR-10.
					</SheetDescription>
				</SheetHeader>

				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className="flex flex-col gap-6 p-4 sm:p-6">
						<section aria-labelledby="source-values" className="flex flex-col gap-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<h2 className="font-heading font-medium" id="source-values">
									Valores de origen
								</h2>
								<Badge variant="outline">Dato normativo directo</Badge>
							</div>

							<Alert>
								<LandmarkIcon />
								<AlertTitle>Apéndice A-4 · municipio de Cali</AlertTitle>
								<AlertDescription>
									Estos coeficientes se transcriben de la norma; no resultan de una fórmula
									del motor.
								</AlertDescription>
							</Alert>

							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Municipio</TableHead>
										<TableHead>Código</TableHead>
										<TableHead className="text-right">Aa</TableHead>
										<TableHead className="text-right">Av</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									<TableRow>
										<TableCell className="font-medium">{municipio.municipio}</TableCell>
										<TableCell className="font-mono">76001</TableCell>
										<TableCell className="text-right font-mono tabular-nums">
											{municipio.aa.toFixed(2)}
										</TableCell>
										<TableCell className="text-right font-mono tabular-nums">
											{municipio.av.toFixed(2)}
										</TableCell>
									</TableRow>
								</TableBody>
							</Table>
						</section>

						<Separator />

						<section aria-labelledby="calculation-use" className="flex flex-col gap-3">
							<div className="flex items-center gap-2">
								<ListTreeIcon />
								<h2 className="font-heading font-medium" id="calculation-use">
									Uso en este cálculo
								</h2>
							</div>
							<p className="text-muted-foreground text-sm">
								Aa y Av entran al motor como valores directos. Fa, Fv, T₀, TC, TL y las
								ordenadas Sa son resultados derivados según las ecuaciones y tablas del
								Título A.
							</p>
						</section>

						<Separator />

						<section aria-labelledby="pdf-evidence" className="flex flex-col gap-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="flex flex-col gap-1">
									<h2 className="font-heading font-medium" id="pdf-evidence">
										Evidencia en el documento
									</h2>
									<p className="text-muted-foreground text-xs">
										Página PDF 191 · página impresa A-177
									</p>
								</div>
								<a
									className={buttonVariants({ size: "sm", variant: "outline" })}
									href={sourceNsr10PdfUrl}
									rel="noreferrer"
									target="_blank"
								>
									Abrir PDF fuente
									<ExternalLinkIcon data-icon="inline-end" />
								</a>
							</div>

							{open && <CaliSourcePdf />}

							<p className="text-muted-foreground text-xs">
								Extracto accesible: “Cali · código 76001 · Aa 0.25 · Av 0.25 · zona de
								amenaza sísmica alta”.
							</p>
						</section>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}

function SpectrumChart({ spectrum }: { spectrum: SpectrumOk }) {
	const { coefficients } = spectrum;
	const plotEnd = Math.max(4, coefficients.tl);

	return (
		<Card className="shadow-none dark:ring-0">
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex flex-col gap-1.5">
						<CardTitle>Espectro elástico de diseño (Sa vs. T)</CardTitle>
						<CardDescription>
							NSR-10 general: meseta desde T = 0 hasta TC, seguida por ramas 1/T y
							1/T².
						</CardDescription>
					</div>
					<Badge variant="secondary">
						Sa máx {formatDecimal(coefficients.saMax, 3)} g
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<ChartContainer
					aria-label="Espectro elástico de diseño NSR-10 calculado"
					className="h-80 w-full md:h-96"
					config={chartConfig}
					initialDimension={{ width: 960, height: 384 }}
				>
					<AreaChart
						accessibilityLayer
						data={spectrum.points}
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
							dataKey="t"
							domain={[0, plotEnd]}
							label={{ value: "Periodo T (s)", position: "insideBottom", offset: -16 }}
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
						<ReferenceLine
							label={{ value: "TC", position: "insideTopRight" }}
							stroke="var(--muted-foreground)"
							strokeDasharray="3 3"
							x={coefficients.tc}
						/>
						<ReferenceLine
							label={{ value: "TL", position: "insideTopRight" }}
							stroke="var(--muted-foreground)"
							strokeDasharray="3 3"
							x={coefficients.tl}
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
					Aceleraciones expresadas como fracción de g; periodos en segundos.
				</p>
			</CardFooter>
		</Card>
	);
}

function ParameterTiles({ spectrum }: { spectrum: SpectrumOk }) {
	const { coefficients } = spectrum;
	const parameters = [
		{ label: "Aa", value: formatDecimal(coefficients.aa, 2) },
		{ label: "Av", value: formatDecimal(coefficients.av, 2) },
		{ label: "Fa", value: formatDecimal(coefficients.fa, 2) },
		{ label: "Fv", value: formatDecimal(coefficients.fv, 2) },
		{ label: "I", value: formatDecimal(coefficients.i, 2) },
		{ label: "T₀", value: `${formatDecimal(coefficients.t0, 3)} s` },
		{ label: "TC", value: `${formatDecimal(coefficients.tc, 3)} s` },
		{ label: "TL", value: `${formatDecimal(coefficients.tl, 2)} s` },
		{ label: "Sa máx", value: `${formatDecimal(coefficients.saMax, 3)} g` },
		{ label: "PGA", value: `${formatDecimal(coefficients.pga, 3)} g` },
	] as const;

	return (
		<section aria-labelledby="derived-parameters" className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="font-heading font-medium" id="derived-parameters">
					Parámetros calculados
				</h2>
				<Badge variant="outline">NSR-10 · resultado en vivo</Badge>
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

function SpectrumTable({ spectrum }: { spectrum: SpectrumOk }) {
	return (
		<Card className="shadow-none dark:ring-0">
			<CardHeader>
				<CardTitle>Datos del espectro</CardTitle>
				<CardDescription>
					{spectrum.points.length} puntos calculados; TC y TL se incluyen exactamente.
				</CardDescription>
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
							{spectrum.points.map((point) => (
								<TableRow key={point.t}>
									<TableCell className="font-medium">
										{branchLabels[point.branch]}
									</TableCell>
									<TableCell className="text-right font-mono tabular-nums">
										{point.t.toFixed(3)}
									</TableCell>
									<TableCell className="text-right font-mono tabular-nums">
										{point.sa.toFixed(6)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}

function SiteSpecificStudyNotice() {
	return (
		<Card className="shadow-none dark:ring-0">
			<CardHeader>
				<CardTitle>Perfil F: análisis específico requerido</CardTitle>
				<CardDescription>
					La NSR-10 no define coeficientes tabulados Fa y Fv para este perfil.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Alert>
					<TriangleAlertIcon />
					<AlertTitle>Estudio de respuesta sísmica del sitio</AlertTitle>
					<AlertDescription>
						La sección A.2.10 exige una investigación geotécnica y un análisis de
						amplificación de ondas específicos. No se genera un espectro hasta contar con
						esos resultados.
					</AlertDescription>
				</Alert>
			</CardContent>
			<CardFooter>
				<p className="text-muted-foreground text-xs">
					Resultado tipado del motor: estudio específico requerido · A.2.10.
				</p>
			</CardFooter>
		</Card>
	);
}

function spectrumCsv(spectrum: SpectrumOk) {
	const rows = spectrum.points.map((point) => `${point.t},${point.sa}`);
	return ["T (s),Sa (g)", ...rows].join("\n");
}

function downloadCsv(spectrum: SpectrumOk, municipio: Municipio) {
	const blob = new Blob([`\uFEFF${spectrumCsv(spectrum)}`], {
		type: "text/csv;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	const slug = normalizeSearchText(municipio.municipio).replace(/\s+/g, "-");

	anchor.href = url;
	anchor.download = `espectr0-${slug}.csv`;
	anchor.click();
	URL.revokeObjectURL(url);
}

function ExportActions({
	spectrum,
	municipio,
}: {
	spectrum: SpectrumOk | null;
	municipio: Municipio;
}) {
	async function copyJson() {
		if (!spectrum) return;

		try {
			await navigator.clipboard.writeText(JSON.stringify(spectrum, null, 2));
			toast.success("JSON copiado al portapapeles.");
		} catch {
			toast.error("No fue posible copiar el JSON.");
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button disabled={!spectrum} onClick={copyJson} size="sm" type="button" variant="outline">
				<ClipboardIcon data-icon="inline-start" />
				Copiar JSON
			</Button>
			<Button
				disabled={!spectrum}
				onClick={() => {
					if (spectrum) downloadCsv(spectrum, municipio);
				}}
				size="sm"
				type="button"
				variant="outline"
			>
				<DownloadIcon data-icon="inline-start" />
				CSV (T, Sa)
			</Button>
			<Button disabled size="sm" type="button" variant="outline">
				<FileTextIcon data-icon="inline-start" />
				PDF · próximamente
			</Button>
		</div>
	);
}

export function CalculatorPage() {
	const [municipio, setMunicipio] = useState<Municipio>(defaultMunicipio);
	const [soilProfile, setSoilProfile] = useState<SoilProfile>("D");
	const [importanceGroup, setImportanceGroup] = useState<ImportanceGroup>("I");
	const [traceabilityOpen, setTraceabilityOpen] = useState(false);

	const result = useMemo(
		() =>
			computeSpectrum({
				aa: municipio.aa,
				av: municipio.av,
				soilProfile,
				importanceGroup,
				mode: "general",
			}),
		[importanceGroup, municipio.aa, municipio.av, soilProfile],
	);

	const spectrum = result.status === "ok" ? result : null;

	return (
		<div className="flex flex-col gap-5">
			<TraceabilitySheet
				municipio={municipio}
				onOpenChange={setTraceabilityOpen}
				open={traceabilityOpen}
			/>
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="font-heading font-semibold text-2xl tracking-tight">
						Calculadora de espectro
					</h1>
					<p className="text-muted-foreground text-sm">
						Espectro elástico NSR-10 calculado localmente, sin envío de datos.
					</p>
				</div>
				<div className="flex flex-col items-start gap-2 sm:items-end">
					<Badge variant="outline">Motor NSR-10 · cálculo en vivo</Badge>
					<ExportActions municipio={municipio} spectrum={spectrum} />
				</div>
			</header>

			<div className="grid items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
				<ParameterRail
					importanceGroup={importanceGroup}
					municipio={municipio}
					onImportanceGroupChange={setImportanceGroup}
					onMunicipioChange={setMunicipio}
					onSoilProfileChange={setSoilProfile}
					onTraceabilityOpen={() => setTraceabilityOpen(true)}
					soilProfile={soilProfile}
				/>
				<div className="flex min-w-0 flex-col gap-4">
					{spectrum ? (
						<>
							<SpectrumChart spectrum={spectrum} />
							<ParameterTiles spectrum={spectrum} />
							<SpectrumTable spectrum={spectrum} />
						</>
					) : (
						<SiteSpecificStudyNotice />
					)}
				</div>
			</div>
		</div>
	);
}
