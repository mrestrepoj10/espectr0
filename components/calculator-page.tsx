"use client";

import { useMemo, useState } from "react";
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
	LandmarkIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TraceabilitySheet } from "@/components/traceability/traceability-sheet";
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
	hazardLevelDetails,
	lookupMunicipio,
	municipios,
	normalizeSearchText,
} from "@/lib/nsr10";

import type {
	ImportanceGroup,
	HazardLevel,
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
	{ label: "Diseño · TR 475 años", value: "design" },
	{
		label: "Seguridad limitada · TR 225 años",
		value: "limited-safety",
	},
	{
		label: "Umbral de daño · TR 31 años",
		value: "damage-threshold",
	},
] as const satisfies ReadonlyArray<{ label: string; value: HazardLevel }>;

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
	II: "Ocupación especial",
	III: "Atención a la comunidad",
	IV: "Edificación indispensable",
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
	"rising-A.12.3-2": "Ascendente · A.12.3-2",
	"plateau-A.12.3-4": "Meseta · A.12.3-4",
	"inverse-T-A.12.3-1": "1/T · A.12.3-1",
	"inverse-T2-A.12.3-6": "1/T² · A.12.3-6",
};

const chartConfig = {
	sa: {
		label: "Sa (g)",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

const defaultMunicipio = lookupMunicipio("Cali", "Valle del Cauca")[0];

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
			size="default"
			value={[value]}
			variant="contrast"
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
	hazardLevel,
	onTraceabilityOpen,
	onMunicipioChange,
	onSoilProfileChange,
	onImportanceGroupChange,
	onHazardLevelChange,
}: {
	municipio: Municipio;
	soilProfile: SoilProfile;
	importanceGroup: ImportanceGroup;
	hazardLevel: HazardLevel;
	onTraceabilityOpen: () => void;
	onMunicipioChange: (municipio: Municipio) => void;
	onSoilProfileChange: (profile: SoilProfile) => void;
	onImportanceGroupChange: (group: ImportanceGroup) => void;
	onHazardLevelChange: (level: HazardLevel) => void;
}) {
	const hazardDetails = hazardLevelDetails[hazardLevel];
	const municipalityCoefficients =
		hazardLevel === "design"
			? `Aa ${municipio.aa.toFixed(2)} · Av ${municipio.av.toFixed(2)}`
			: hazardLevel === "limited-safety"
				? `Ae ${municipio.ae.toFixed(2)}`
				: `Ad ${municipio.ad.toFixed(2)}`;
	const importanceDescription =
		hazardLevel === "damage-threshold"
			? `${importanceGroup} — ${importanceDescriptions[importanceGroup]} · I no modifica A.12.3`
			: `${importanceGroup} — ${importanceDescriptions[importanceGroup]} · I = ${importanceValues[importanceGroup]}`;
	const hazardNotice =
		hazardLevel === "limited-safety"
			? "Uso restringido a las edificaciones existentes permitidas por A.10.9."
			: hazardLevel === "damage-threshold"
				? importanceGroup === "III" || importanceGroup === "IV"
					? "Verificación especial de operatividad para las edificaciones cubiertas por A.12."
					: "A.12 aplica a las edificaciones cubiertas de los grupos III y IV; revisa el grupo de uso."
				: "Movimientos sísmicos de diseño para edificaciones nuevas y existentes.";

	return (
		<Card className="self-start" size="sm">
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
							{municipalityCoefficients} · Apéndice A-4
						</FieldDescription>
						<Button
							onClick={onTraceabilityOpen}
							size="lg"
							type="button"
							variant="outline"
						>
							<LandmarkIcon data-icon="inline-start" />
							Ver trazabilidad
						</Button>
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
							{importanceDescription}
						</FieldDescription>
					</FieldSet>

					<Field>
						<FieldTitle>Nivel de amenaza</FieldTitle>
						<Select
							items={hazardLevels}
							onValueChange={(value) => {
								if (value) onHazardLevelChange(value as HazardLevel);
							}}
							value={hazardLevel}
						>
							<SelectTrigger className="w-full" aria-label="Nivel de amenaza">
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
					</Field>
				</FieldGroup>
			</CardContent>
			<CardFooter className="flex-col items-stretch gap-3">
				<Separator />
				<p className="text-muted-foreground text-xs">
					{hazardDetails.section} · amortiguamiento crítico del{" "}
					{hazardDetails.dampingRatio * 100} %. {hazardNotice}
				</p>
			</CardFooter>
		</Card>
	);
}

function SpectrumChart({
	spectrum,
	municipio,
}: {
	spectrum: SpectrumOk;
	municipio: Municipio;
}) {
	const { coefficients } = spectrum;
	const details = hazardLevelDetails[spectrum.hazardLevel];
	const plotEnd = spectrum.points.at(-1)?.t ?? Math.max(4, coefficients.tl);
	const transitionLabels =
		spectrum.hazardLevel === "damage-threshold"
			? { tc: "TCd", tl: "TLd" }
			: { tc: "TC", tl: "TL" };
	const description =
		spectrum.hazardLevel === "damage-threshold"
			? "A.12.3: rama ascendente hasta 0,25 s, meseta y ramas 1/T y 1/T²."
			: spectrum.hazardLevel === "limited-safety"
				? "A.10.3: forma A.2.6 calculada con Ae en reemplazo de Aa y Av."
				: "A.2.6 general: meseta desde T = 0 hasta TC, seguida por ramas 1/T y 1/T².";

	return (
		<Card variant="elevated">
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex min-w-0 flex-col gap-1.5">
						<div className="flex flex-wrap items-center gap-2">
							<CardTitle>Espectro elástico · {details.label} (Sa vs. T)</CardTitle>
							<Badge variant="secondary">
								Sa máx {formatDecimal(coefficients.saMax, 3)} g
							</Badge>
						</div>
						<CardDescription>{description}</CardDescription>
					</div>
					<ExportActions municipio={municipio} spectrum={spectrum} />
				</div>
			</CardHeader>
			<CardContent>
				<ChartContainer
					aria-label={`Espectro elástico de ${details.label.toLocaleLowerCase("es-CO")} NSR-10 calculado`}
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
						<ReferenceLine
							label={{ value: transitionLabels.tc, position: "insideTopRight" }}
							stroke="var(--muted-foreground)"
							strokeDasharray="3 3"
							x={coefficients.tc}
						/>
						<ReferenceLine
							label={{ value: transitionLabels.tl, position: "insideTopRight" }}
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
					TR {spectrum.returnPeriodYears} años · amortiguamiento crítico del{" "}
					{spectrum.dampingRatio * 100} % · aceleraciones como fracción de g.
				</p>
			</CardFooter>
		</Card>
	);
}

function ParameterTiles({ spectrum }: { spectrum: SpectrumOk }) {
	const { coefficients } = spectrum;
	const commonParameters = [
		{
			label: coefficients.hazardLevel === "damage-threshold" ? "TCd" : "TC",
			value: `${formatDecimal(coefficients.tc, 3)} s`,
		},
		{
			label: coefficients.hazardLevel === "damage-threshold" ? "TLd" : "TL",
			value: `${formatDecimal(coefficients.tl, 2)} s`,
		},
		{ label: "Sa máx", value: `${formatDecimal(coefficients.saMax, 3)} g` },
		{
			label: coefficients.hazardLevel === "damage-threshold" ? "Sad(0)" : "PGA",
			value: `${formatDecimal(coefficients.pga, 3)} g`,
		},
	];
	const parameters =
		coefficients.hazardLevel === "design"
			? [
					{ label: "Aa", value: formatDecimal(coefficients.aa, 2) },
					{ label: "Av", value: formatDecimal(coefficients.av, 2) },
					{ label: "Fa", value: formatDecimal(coefficients.fa, 2) },
					{ label: "Fv", value: formatDecimal(coefficients.fv, 2) },
					{ label: "I", value: formatDecimal(coefficients.i, 2) },
					{ label: "T₀", value: `${formatDecimal(coefficients.t0, 3)} s` },
					...commonParameters,
				]
			: coefficients.hazardLevel === "limited-safety"
				? [
						{ label: "Ae", value: formatDecimal(coefficients.ae, 2) },
						{ label: "Fa", value: formatDecimal(coefficients.fa, 2) },
						{ label: "Fv", value: formatDecimal(coefficients.fv, 2) },
						{ label: "I", value: formatDecimal(coefficients.i, 2) },
						{ label: "T₀", value: `${formatDecimal(coefficients.t0, 3)} s` },
						...commonParameters,
					]
				: [
						{ label: "Ad", value: formatDecimal(coefficients.ad, 2) },
						{ label: "Fv", value: formatDecimal(coefficients.fv, 2) },
						{ label: "S", value: formatDecimal(coefficients.s, 2) },
						...commonParameters,
					];

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
					<Card key={parameter.label} size="sm" variant="metric">
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
	const transitionNames =
		spectrum.hazardLevel === "damage-threshold" ? "TCd y TLd" : "TC y TL";

	return (
		<Card>
			<CardHeader>
				<CardTitle>Datos del espectro</CardTitle>
				<CardDescription>
					{spectrum.points.length} puntos calculados; {transitionNames} se incluyen
					exactamente.
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

function SiteSpecificStudyNotice({ hazardLevel }: { hazardLevel: HazardLevel }) {
	const coefficientNames =
		hazardLevel === "damage-threshold" ? "Fv" : "Fa y Fv";

	return (
		<Card>
			<CardHeader>
				<CardTitle>Perfil F: análisis específico requerido</CardTitle>
				<CardDescription>
					La NSR-10 no define {coefficientNames} tabulados para este perfil.
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
	anchor.download = `espectr0-${slug}-${spectrum.hazardLevel}.csv`;
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
		<div aria-label="Exportar resultados" className="flex flex-wrap items-center gap-2">
			<Button
				className="h-10"
				disabled={!spectrum}
				onClick={copyJson}
				type="button"
				variant="outline"
			>
				<ClipboardIcon data-icon="inline-start" />
				Copiar JSON
			</Button>
			<Button
				disabled={!spectrum}
				onClick={() => {
					if (spectrum) downloadCsv(spectrum, municipio);
				}}
				className="h-10"
				type="button"
				variant="outline"
			>
				<DownloadIcon data-icon="inline-start" />
				CSV (T, Sa)
			</Button>
		</div>
	);
}

export function CalculatorPage() {
	const [municipio, setMunicipio] = useState<Municipio>(defaultMunicipio);
	const [soilProfile, setSoilProfile] = useState<SoilProfile>("D");
	const [importanceGroup, setImportanceGroup] = useState<ImportanceGroup>("I");
	const [hazardLevel, setHazardLevel] = useState<HazardLevel>("design");
	const [traceabilityOpen, setTraceabilityOpen] = useState(false);

	const result = useMemo(
		() =>
			computeSpectrum({
				aa: municipio.aa,
				av: municipio.av,
				ae: municipio.ae,
				ad: municipio.ad,
				hazardLevel,
				soilProfile,
				importanceGroup,
				mode: "general",
			}),
		[
			hazardLevel,
			importanceGroup,
			municipio.aa,
			municipio.ad,
			municipio.ae,
			municipio.av,
			soilProfile,
		],
	);

	const spectrum = result.status === "ok" ? result : null;

	return (
		<div className="flex flex-col gap-5">
			<TraceabilitySheet
				municipalityCode={municipio.code}
				onOpenChange={setTraceabilityOpen}
				open={traceabilityOpen}
			/>
			<p className="text-muted-foreground text-sm">
				Espectro elástico NSR-10 calculado localmente, sin envío de datos.
			</p>

			<div className="grid items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
				<ParameterRail
					hazardLevel={hazardLevel}
					importanceGroup={importanceGroup}
					municipio={municipio}
					onImportanceGroupChange={setImportanceGroup}
					onHazardLevelChange={setHazardLevel}
					onMunicipioChange={setMunicipio}
					onSoilProfileChange={setSoilProfile}
					onTraceabilityOpen={() => setTraceabilityOpen(true)}
					soilProfile={soilProfile}
				/>
				<div className="flex min-w-0 flex-col gap-4">
					{spectrum ? (
						<>
							<SpectrumChart municipio={municipio} spectrum={spectrum} />
							<ParameterTiles spectrum={spectrum} />
							<SpectrumTable spectrum={spectrum} />
						</>
					) : (
						<SiteSpecificStudyNotice hazardLevel={hazardLevel} />
					)}
				</div>
			</div>
		</div>
	);
}
