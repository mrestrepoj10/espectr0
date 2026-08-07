"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
	ChevronDownIcon,
	CodeXmlIcon,
	DownloadIcon,
	ExternalLinkIcon,
	FileDownIcon,
	FileJsonIcon,
	FileTextIcon,
	ImageIcon,
	LandmarkIcon,
	LoaderCircleIcon,
	ShieldAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
	CalculatorNotices,
	CalculatorResultHeader,
	CalculatorShell,
	SpectrumPeriodLookup,
} from "@/components/calculator-shell";
import {
	BogotaParameterRail,
	CaliParameterRail,
	Ccp14ParameterRail,
	DosquebradasParameterRail,
	MedellinParameterRail,
} from "@/components/calculator/municipal-parameter-rail";
import {
	defaultMunicipio,
	getHazardNotice,
	getMunicipalityCoefficients,
	HazardLevelControl,
	ImportanceGroupControl,
	importanceValues,
	MunicipalityCombobox,
	SoilProfileControl,
} from "@/components/spectrum-controls";
import {
	SharedSpectrumChart,
	SharedSpectrumMetrics,
	SharedSpectrumNotices,
	SharedSpectrumTable,
} from "@/components/spectrum-result";
import { BogotaFigureEvidence } from "@/components/calculator/bogota-figure-evidence";
import { CaliFigureEvidence } from "@/components/calculator/cali-figure-evidence";
import { Ccp14FigureEvidence } from "@/components/calculator/ccp14-figure-evidence";
import { TraceabilitySheet } from "@/components/traceability/traceability-sheet";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldTitle,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import {
	copyChartPng,
	copyChartSvg,
	copyTextToClipboard,
} from "@/lib/chart-export";
import {
	adaptBogotaSpectrum,
	bogotaCanonical,
} from "@/lib/bogota";
import {
	adaptCaliSpectrum,
	caliCanonical,
} from "@/lib/cali";
import {
	adaptCcp14Spectrum,
	ccp14CityReading,
	ccp14CityValues,
	ccp14LegendValue,
} from "@/lib/ccp14";
import { adaptDosquebradasSpectrum } from "@/lib/dosquebradas/adapter";
import { dosquebradasRows } from "@/lib/dosquebradas/schema";
import {
	adaptMedellinSpectrum,
	medellinHazards,
	medellinOptions,
} from "@/lib/medellin";
import { capabilityUiState } from "@/lib/calculator-shell";
import {
	calculationModes,
	isSourceBlockedMode,
	sourceBlockedModes,
} from "@/lib/municipal-mode-catalog";
import { hazardLevelDetails } from "@/lib/nsr10";
import {
	adaptNsr10Spectrum,
	assertSpectrumExportCapability,
	formatSpectrumCsv,
	formatSpectrumEtabs,
	formatSpectrumJson,
	spectrumExportFilename,
} from "@/lib/spectra";

import type { CalculatorModeId } from "@/lib/municipal-mode-catalog";
import type { Ccp14Coefficient, Ccp14SoilClass } from "@/lib/ccp14";
import type {
	HazardLevel,
	ImportanceGroup,
	Municipio,
	SoilProfile,
	SpectrumBranch,
	SpectrumParams,
} from "@/lib/nsr10";
import type {
	NormalizedSpectrumResult,
	SpectrumCapabilities,
} from "@/lib/spectra";

type NormalizedSpectrumOk = Extract<NormalizedSpectrumResult, { status: "ok" }>;

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

const municipalBranchLabels: Readonly<Record<string, string>> = {
	plateau: "Meseta",
	inverse: "Descendente",
	"inverse-square": "Periodo largo",
	"bogota-design-plateau": "Meseta de diseño",
	"bogota-design-decay": "Descendente de diseño",
	"bogota-design-long": "Periodo largo de diseño",
	"bogota-limited-plateau": "Meseta de seguridad limitada",
	"bogota-limited-decay": "Descendente de seguridad limitada",
	"bogota-limited-long": "Periodo largo de seguridad limitada",
	"bogota-damage-ramp": "Ascendente de umbral de daño",
	"bogota-damage-plateau": "Meseta de umbral de daño",
	"bogota-damage-decay": "Descendente de umbral de daño",
	"bogota-damage-long": "Periodo largo de umbral de daño",
};

const activatedBranchLabels: Readonly<Record<string, string>> = {
	"initial-linear": "Ascendente CCP-14",
	"inverse-period": "Descendente CCP-14",
	"dosquebradas-plateau": "Meseta de Dosquebradas",
	"dosquebradas-inverse": "Descendente de Dosquebradas",
	"medellin-plateau": "Meseta de Medellín",
	"medellin-power-decay": "Descendente de Medellín",
};

const allBranchLabels: Readonly<Record<string, string>> = {
	...branchLabels,
	...municipalBranchLabels,
	...activatedBranchLabels,
};

const metricPresentation = {
	as: { label: "As", digits: 3 },
	sds: { label: "SDS", digits: 3 },
	sd1: { label: "SD1", digits: 3 },
	ts: { label: "Ts", digits: 3 },
	performanceZone: { label: "Zona de desempeño", digits: 0 },
	to: { label: "To", digits: 3 },
	importanceFactor: { label: "I", digits: 2 },
	avDerived: { label: "Av derivado", digits: 3 },
	aa: { digits: 2 },
	av: { digits: 2 },
	ae: { digits: 2 },
	ad: { digits: 2 },
	fa: { digits: 2 },
	fv: { digits: 2 },
	i: { digits: 2 },
	s: { digits: 2 },
	t0: { label: "T₀", digits: 3 },
	tc: { digits: 3 },
	tl: { digits: 2 },
	saMax: { label: "Sa máx", digits: 3 },
	pga: { digits: 3 },
	a: { digits: 3 },
	a0: { label: "A₀", digits: 3 },
	ground_peak: { label: "A₀", digits: 3 },
	transition_start: { label: "T₀", digits: 3 },
	transition_end: { label: "Tc", digits: 3 },
	long_period: { label: "TL", digits: 2 },
	"sa-plateau": { label: "Sa meseta", digits: 3 },
	plateau_start: { label: "T₀", digits: 3 },
	decay_start: { label: "Tc", digits: 3 },
	decay_exponent: { label: "α", digits: 2 },
	short_amplification: { label: "Fa", digits: 2 },
	plateau_per_importance: { label: "Samax/I publicado", digits: 3 },
	smax: { label: "Smax calculado", digits: 3 },
	faEffective: { label: "Fa efectivo", digits: 3 },
	fvEffective: { label: "Fv efectivo", digits: 3 },
} as const;

function damageMetricPresentation(hazardLevel: HazardLevel) {
	return hazardLevel === "damage-threshold"
		? {
				...metricPresentation,
				tc: { label: "TCd", digits: 3 },
				tl: { label: "TLd", digits: 2 },
				pga: { label: "Sad(0)", digits: 3 },
			}
		: metricPresentation;
}

function formatDecimal(value: number, digits: number) {
	const factor = 10 ** digits;
	const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
	return rounded.toFixed(digits);
}

function ParameterRail({
	municipio,
	soilProfile,
	importanceGroup,
	hazardLevel,
	onMunicipioChange,
	onSoilProfileChange,
	onImportanceGroupChange,
	onHazardLevelChange,
}: {
	municipio: Municipio;
	soilProfile: SoilProfile;
	importanceGroup: ImportanceGroup;
	hazardLevel: HazardLevel;
	onMunicipioChange: (municipio: Municipio) => void;
	onSoilProfileChange: (profile: SoilProfile) => void;
	onImportanceGroupChange: (group: ImportanceGroup) => void;
	onHazardLevelChange: (level: HazardLevel) => void;
}) {
	const hazardDetails = hazardLevelDetails[hazardLevel];
	const municipalityCoefficients = getMunicipalityCoefficients(
		municipio,
		hazardLevel,
	);
	const hazardNotice = getHazardNotice(hazardLevel, importanceGroup);

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
						<FieldTitle>Municipio</FieldTitle>
						<MunicipalityCombobox
							onValueChange={onMunicipioChange}
							value={municipio}
						/>
						<FieldDescription>
							{municipalityCoefficients} · Apéndice A-4
						</FieldDescription>
					</Field>

					<SoilProfileControl
						onValueChange={onSoilProfileChange}
						value={soilProfile}
					/>
					<ImportanceGroupControl
						hazardLevel={hazardLevel}
						onValueChange={onImportanceGroupChange}
						value={importanceGroup}
					/>
					<HazardLevelControl
						onValueChange={onHazardLevelChange}
						value={hazardLevel}
					/>
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

function SourceBlockedRail({ modeId }: { modeId: keyof typeof sourceBlockedModes }) {
	const mode = sourceBlockedModes[modeId];
	return (
		<Card className="self-start" size="sm">
			<CardHeader>
				<CardTitle>Estado de la fuente</CardTitle>
				<CardDescription>{mode.status}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-xl border bg-muted/30 p-3">
					<p className="text-muted-foreground text-xs">Fuente rectora auditada</p>
					<p className="mt-1 text-sm font-medium">{mode.sourceTitle}</p>
				</div>
				<Button render={<a href={mode.sourceUrl} rel="noreferrer" target="_blank" />} variant="outline">
					<ExternalLinkIcon data-icon="inline-start" />
					Abrir publicación oficial
				</Button>
			</CardContent>
		</Card>
	);
}

function SourceBlockedResult({ modeId }: { modeId: keyof typeof sourceBlockedModes }) {
	const mode = sourceBlockedModes[modeId];
	return (
		<Card variant="elevated">
			<CalculatorResultHeader
				applicability="unsupported"
				description={mode.description}
				highlight="Fuente bloqueada"
				title={`${mode.label} · sin cálculo`}
			/>
			<CardContent>
				<div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
					<div className="flex items-start gap-3">
						<ShieldAlertIcon className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
						<div>
							<p className="font-medium">No se completan vacíos por analogía</p>
							<ul className="mt-3 space-y-2 text-muted-foreground text-sm">
								{mode.blockers.map((blocker) => <li key={blocker}>— {blocker}</li>)}
							</ul>
						</div>
					</div>
				</div>
			</CardContent>
			<CardFooter>
				<p className="text-muted-foreground text-xs">
					Mientras estos bloqueos sigan abiertos, usa NSR-10 Nacional cuando sea el flujo aplicable y documenta la revisión profesional.
				</p>
			</CardFooter>
		</Card>
	);
}

function SiteSpecificStudyNotice({
	result,
	onTraceabilityOpen,
}: {
	result: Exclude<NormalizedSpectrumResult, { status: "ok" }>;
	onTraceabilityOpen: () => void;
}) {
	const traceability = capabilityUiState(
		result.capabilities.traceabilityViewer,
	);
	const title =
		result.status === "site-specific-study-required"
			? result.study.id === "nsr10-national"
				? "Perfil F: análisis específico requerido"
				: "Estudio de respuesta sísmica particular requerido"
			: "Resultado no disponible";

	return (
		<Card>
			<CalculatorResultHeader
				actions={
					<Button
						disabled={!traceability.enabled}
						onClick={onTraceabilityOpen}
						title={traceability.reason ?? undefined}
						type="button"
						variant="outline"
					>
						<LandmarkIcon data-icon="inline-start" />
						Ver trazabilidad
					</Button>
				}
				applicability={result.applicability.status}
				description={result.applicability.message}
				title={title}
			/>
			<CardContent>
				<CalculatorNotices
					applicability={result.applicability.status}
					notices={result.warnings}
				/>
			</CardContent>
			<CardFooter>
				<p className="text-muted-foreground text-xs">
					Resultado tipado del motor · {result.applicability.reasonCode}
				</p>
			</CardFooter>
		</Card>
	);
}

function downloadTextFile(content: string, filename: string, mediaType: string) {
	const blob = new Blob([content], { type: mediaType });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

function ExportActions({
	chartContainerRef,
	result,
	capabilities,
}: {
	chartContainerRef: React.RefObject<HTMLDivElement | null>;
	result: NormalizedSpectrumOk;
	capabilities: SpectrumCapabilities;
}) {
	const [isPdfExporting, setIsPdfExporting] = useState(false);

	function copyJson() {
		void copyTextToClipboard(formatSpectrumJson(result))
			.then(() => toast.success("JSON copiado al portapapeles."))
			.catch(() => toast.error("No fue posible copiar el JSON."));
	}

	function chartSvg() {
		const svg = chartContainerRef.current?.querySelector<SVGSVGElement>(
			"svg.recharts-surface",
		);
		if (!svg) throw new Error("No se encontró el gráfico para exportar.");
		return svg;
	}

	function copyPng() {
		try {
			assertSpectrumExportCapability(result, "svgPngExport");
			void copyChartPng(chartSvg(), chartContainerRef.current)
				.then(() => toast.success("PNG copiado al portapapeles."))
				.catch(() => toast.error("No fue posible copiar el PNG."));
		} catch {
			toast.error("No fue posible copiar el PNG.");
		}
	}

	function copySvg() {
		try {
			assertSpectrumExportCapability(result, "svgPngExport");
			void copyChartSvg(chartSvg())
				.then(() => toast.success("SVG copiado al portapapeles."))
				.catch(() => toast.error("No fue posible copiar el SVG."));
		} catch {
			toast.error("No fue posible copiar el SVG.");
		}
	}

	function exportCsv() {
		try {
			downloadTextFile(
				`\uFEFF${formatSpectrumCsv(result)}`,
				spectrumExportFilename(result, "csv"),
				"text/csv;charset=utf-8",
			);
			toast.success("CSV descargado.");
		} catch {
			toast.error("No fue posible descargar el CSV.");
		}
	}

	function exportEtabs() {
		try {
			downloadTextFile(
				formatSpectrumEtabs(result),
				spectrumExportFilename(result, "etabs.txt"),
				"text/plain;charset=utf-8",
			);
			toast.success("TXT para ETABS descargado.");
		} catch {
			toast.error("No fue posible descargar el TXT para ETABS.");
		}
	}

	async function exportMemoriaPdf() {
		if (isPdfExporting) return;
		setIsPdfExporting(true);

		try {
			const { downloadNormalizedSpectrumMemoriaPdf } = await import(
				"@/lib/memoria-pdf-renderer"
			);
			await downloadNormalizedSpectrumMemoriaPdf(result);
			toast.success("Memoria PDF descargada.");
		} catch {
			toast.error("No fue posible generar la memoria PDF.");
		} finally {
			setIsPdfExporting(false);
		}
	}

	const jsonCapability = capabilityUiState(capabilities.jsonExport);
	const imageCapability = capabilityUiState(capabilities.svgPngExport);
	const csvCapability = capabilityUiState(capabilities.csvExport);
	const etabsCapability = capabilityUiState(capabilities.etabsExport);
	const pdfCapability = capabilityUiState(capabilities.contextualPdf);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button className="h-10" type="button" variant="outline" />}
			>
				<DownloadIcon data-icon="inline-start" />
				Exportar
				<ChevronDownIcon data-icon="inline-end" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" aria-label="Exportar resultados">
				<DropdownMenuGroup>
					<DropdownMenuItem
						disabled={!jsonCapability.enabled}
						onClick={copyJson}
						title={jsonCapability.reason ?? undefined}
					>
						<FileJsonIcon />
						Copiar JSON
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={!imageCapability.enabled}
						onClick={copyPng}
						title={imageCapability.reason ?? undefined}
					>
						<ImageIcon />
						Copiar PNG
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={!imageCapability.enabled}
						onClick={copySvg}
						title={imageCapability.reason ?? undefined}
					>
						<CodeXmlIcon />
						Copiar SVG
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={!csvCapability.enabled}
						onClick={exportCsv}
						title={csvCapability.reason ?? undefined}
					>
						<DownloadIcon />
						Descargar CSV
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={!etabsCapability.enabled}
						onClick={exportEtabs}
						title={etabsCapability.reason ?? undefined}
					>
						<FileTextIcon />
						Descargar TXT (ETABS)
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={isPdfExporting || !pdfCapability.enabled}
						onClick={() => void exportMemoriaPdf()}
						title={pdfCapability.reason ?? undefined}
					>
						{isPdfExporting ? (
							<LoaderCircleIcon className="animate-spin" />
						) : (
							<FileDownIcon />
						)}
						{isPdfExporting ? "Generando memoria…" : "Descargar memoria PDF"}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function chartDescription(hazardLevel: HazardLevel) {
	if (hazardLevel === "damage-threshold") {
		return "A.12.3: rama ascendente hasta 0,25 s, meseta y ramas 1/T y 1/T².";
	}
	if (hazardLevel === "limited-safety") {
		return "A.10.3: forma A.2.6 calculada con Ae en reemplazo de Aa y Av.";
	}
	return "A.2.6 general: meseta desde T = 0 hasta TC, seguida por ramas 1/T y 1/T².";
}

function ManualSelectionNotice({
	description,
	title,
}: {
	description: string;
	title: string;
}) {
	return (
		<Card>
			<CalculatorResultHeader
				applicability="invalid-input"
				description={description}
				title={title}
			/>
			<CardContent>
				<p className="text-muted-foreground text-sm">
					No se calcula ni exporta ningún espectro hasta completar la selección
					 manual.
				</p>
			</CardContent>
		</Card>
	);
}

/**
 * The Bogotá spectra are scaled by the NSR-10 A.2.5 importance coefficient, so
 * the group the engineer picks is what supplies I.
 */
function importanceCoefficient(group: ImportanceGroup) {
	return Number(importanceValues[group]);
}

const bogotaZoneOptions = bogotaCanonical.options.map((option) => ({
	id: option.id,
	label: option.sourceLabel,
}));
const bogotaHazardOptions = bogotaCanonical.hazards.map((hazard) => ({
	id: hazard.id,
	label: hazard.label,
}));
const caliZoneOptions = [
	...new Map(
		caliCanonical.curveComponents.map((option) => {
			const id = option.concurrentGroup ?? option.id;
			return [
				id,
				{
					id,
					label: option.label.split(" — ")[0],
				},
			] as const;
		}),
	).values(),
];
const caliHazardLabels: Readonly<Record<string, string>> = {
	design: "Diseño",
	"safety-limited": "Seguridad limitada",
	"damage-threshold": "Umbral de daño",
};
const caliHazardOptions = caliCanonical.hazards.map((hazard) => ({
	id: hazard.id,
	label: caliHazardLabels[hazard.id] ?? hazard.id,
}));
const dosquebradasZoneOptions = dosquebradasRows.map(({ optionId }) => ({
	id: optionId,
	label: `Zona ${optionId.at(-1)}`,
}));
const medellinZoneOptions = medellinOptions.map((option) => ({
	id: option.id,
	label: `${option.sourceLabel} — ${option.description}`,
}));
const medellinHazardOptions = medellinHazards.map((hazard) => ({
	id: hazard.id,
	label: hazard.label,
}));

function medellinHazardDescription(hazardId: string | null) {
	const hazard = medellinHazards.find(({ id }) => id === hazardId);
	if (!hazard) {
		return "Selecciona explícitamente diseño (5 %) o control de daños/servicio (2 %).";
	}
	return `Período de retorno no declarado · amortiguamiento crítico del ${hazard.dampingRatio * 100} % según la familia publicada.`;
}

function municipalHazardDescription(
	hazard:
		| (typeof bogotaCanonical.hazards)[number]
		| (typeof caliCanonical.hazards)[number]
		| undefined,
) {
	if (!hazard) return "Nivel no disponible en la fuente canónica.";
	const returnPeriodYears = "returnPeriodYears" in hazard
		? hazard.returnPeriodYears
		: hazard.averageReturnPeriodYears;
	return `TR ${returnPeriodYears} años · amortiguamiento crítico del ${hazard.dampingRatio * 100} %.`;
}

function caliComponentOptions(zoneId: string | null) {
	if (!zoneId) return [];
	return caliCanonical.curveComponents
		.filter(({ concurrentGroup }) => concurrentGroup === zoneId)
		.map((component) => ({
			id: component.id,
			label: component.label.split(" — ")[1] ?? component.label,
		}));
}

function resolvedCaliOptionId(
	zoneId: string | null,
	componentId: string | null,
) {
	if (!zoneId) return null;
	const direct = caliCanonical.curveComponents.find(
		(component) => component.id === zoneId && component.concurrentGroup === null,
	);
	if (direct) return direct.id;
	return caliCanonical.curveComponents.some(
		(component) =>
			component.concurrentGroup === zoneId && component.id === componentId,
	)
		? componentId
		: null;
}

function activeChartDescription(
	mode: CalculatorModeId,
	nsrHazardLevel: HazardLevel,
) {
	if (mode === "ccp14") {
		return "Curva CCP-14 del Procedimiento General 3.10.2.1, emitida con los coeficientes mapeados y el perfil de sitio declarados para el proyecto.";
	}
	if (mode === "dosquebradas-microzonation") {
		return "Curva municipal emitida solo en el intervalo soportado To ≤ T ≤ TL para la zona manual.";
	}
	if (mode === "medellin-microzonation") {
		return "Curva técnica histórica emitida solo en el dominio publicado T0 ≤ T ≤ 4 s para la zona y familia seleccionadas manualmente.";
	}
	if (mode === "nsr10-national") return chartDescription(nsrHazardLevel);
	if (mode === "bogota-microzonation") {
		return "Curva emitida por el motor distrital para la zona y amenaza seleccionadas manualmente.";
	}
	return "Curva mínima emitida por el motor municipal para el componente y amenaza seleccionados manualmente.";
}

function transitionMetrics(mode: CalculatorModeId, hazardId: string) {
	if (mode === "ccp14") {
		return [
			{ id: "t0", label: "T0" },
			{ id: "ts", label: "Ts" },
		];
	}
	if (mode === "dosquebradas-microzonation") {
		return [
			{ id: "to", label: "To" },
			{ id: "tc", label: "Tc" },
			{ id: "tl", label: "TL" },
		];
	}
	if (mode === "medellin-microzonation") {
		return [
			{ id: "plateau_start", label: "T0" },
			{ id: "decay_start", label: "Tc" },
		];
	}
	if (mode === "bogota-microzonation") {
		if (hazardId === "damage-threshold") {
			return [
				{ id: "transition_start", label: "T0d" },
				{ id: "transition_end", label: "TCd" },
				{ id: "long_period", label: "TLd" },
			];
		}
		return [
			{ id: "transition_end", label: "Tc" },
			{ id: "long_period", label: "TL" },
		];
	}
	if (mode === "nsr10-national" && hazardId === "damage-threshold") {
		return [
			{ id: "tc", label: "TCd" },
			{ id: "tl", label: "TLd" },
		];
	}
	return [
		{ id: "tc", label: "TC" },
		{ id: "tl", label: "TL" },
	];
}

export function CalculatorPage() {
	const [calculationMode, setCalculationMode] =
		useState<CalculatorModeId>("nsr10-national");
	const [ccp14Values, setCcp14Values] = useState<
		Record<Ccp14Coefficient, number | null>
	>({ PGA: null, Ss: null, S1: null });
	const [ccp14Regions, setCcp14Regions] = useState<
		Record<Ccp14Coefficient, number | null>
	>({ PGA: null, Ss: null, S1: null });
	const [ccp14SoilClass, setCcp14SoilClass] =
		useState<Ccp14SoilClass | null>(null);
	const [ccp14MapLocationId, setCcp14MapLocationId] =
		useState<string | null>(null);
	const [municipio, setMunicipio] = useState<Municipio>(defaultMunicipio);
	const [soilProfile, setSoilProfile] = useState<SoilProfile>("D");
	const [importanceGroup, setImportanceGroup] = useState<ImportanceGroup>("I");
	const [hazardLevel, setHazardLevel] = useState<HazardLevel>("design");
	const [bogotaZoneId, setBogotaZoneId] = useState<string | null>(null);
	const [bogotaHazardId, setBogotaHazardId] = useState(
		bogotaHazardOptions[0].id,
	);
	const [bogotaImportanceGroup, setBogotaImportanceGroup] =
		useState<ImportanceGroup>("I");
	const [medellinZoneId, setMedellinZoneId] = useState<string | null>(null);
	const [medellinHazardId, setMedellinHazardId] = useState<string | null>(null);
	const [medellinImportanceGroup, setMedellinImportanceGroup] =
		useState<ImportanceGroup>("I");
	const [caliZoneId, setCaliZoneId] = useState<string | null>(null);
	const [caliComponentId, setCaliComponentId] = useState<string | null>(null);
	const [caliHazardId, setCaliHazardId] = useState(caliHazardOptions[0].id);
	const [caliImportanceGroup, setCaliImportanceGroup] =
		useState<ImportanceGroup>("I");
	const [caliFillThickness, setCaliFillThickness] = useState<number | null>(null);
	const [caliColluvialDeposit, setCaliColluvialDeposit] = useState(false);
	const [dosquebradasZoneId, setDosquebradasZoneId] =
		useState<string | null>(null);
	const [dosquebradasImportanceGroup, setDosquebradasImportanceGroup] =
		useState<ImportanceGroup>("I");
	const [traceabilityOpen, setTraceabilityOpen] = useState(false);
	const chartContainerRef = useRef<HTMLDivElement>(null);

	const spectrumParams = useMemo<SpectrumParams>(
		() => ({
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
	const nsr10Result = useMemo(
		() => adaptNsr10Spectrum(spectrumParams, { municipality: municipio }),
		[spectrumParams, municipio],
	);
	const ccp14Result = useMemo(() => {
		if (
			calculationMode !== "ccp14" ||
			ccp14Values.PGA === null ||
			ccp14Values.Ss === null ||
			ccp14Values.S1 === null ||
			ccp14SoilClass === null
		) return null;
		return adaptCcp14Spectrum({
			pgaG: ccp14Values.PGA,
			ssG: ccp14Values.Ss,
			s1G: ccp14Values.S1,
			soilClass: ccp14SoilClass,
			mapLocationId: ccp14MapLocationId,
			pgaRegion: ccp14Regions.PGA,
			ssRegion: ccp14Regions.Ss,
			s1Region: ccp14Regions.S1,
		});
	}, [
		calculationMode,
		ccp14MapLocationId,
		ccp14Regions,
		ccp14SoilClass,
		ccp14Values,
	]);
	const bogotaResult = useMemo(
		() => {
			if (
				calculationMode !== "bogota-microzonation" ||
				bogotaZoneId === null
			) return null;
			return adaptBogotaSpectrum({
				zoneId: bogotaZoneId,
				hazardId: bogotaHazardId,
				importanceFactor: importanceCoefficient(bogotaImportanceGroup),
				fillThicknessMeters: null,
				rigidBasePeriodSeconds: null,
			});
		},
		[calculationMode, bogotaHazardId, bogotaImportanceGroup, bogotaZoneId],
	);
	const activeCaliComponentOptions = useMemo(
		() => caliComponentOptions(caliZoneId),
		[caliZoneId],
	);
	const medellinResult = useMemo(() => {
		if (
			calculationMode !== "medellin-microzonation" ||
			medellinZoneId === null ||
			medellinHazardId === null
		) return null;
		return adaptMedellinSpectrum({
			zoneId: medellinZoneId,
			hazardId: medellinHazardId,
			importanceFactor: importanceCoefficient(medellinImportanceGroup),
		});
	}, [
		calculationMode,
		medellinHazardId,
		medellinImportanceGroup,
		medellinZoneId,
	]);
	const caliOptionId = resolvedCaliOptionId(caliZoneId, caliComponentId);
	const caliResult = useMemo(
		() => {
			if (
				calculationMode !== "cali-microzonation" ||
				caliOptionId === null
			) return null;
			return adaptCaliSpectrum({
				optionId: caliOptionId,
				hazardId: caliHazardId,
				importanceFactor: importanceCoefficient(caliImportanceGroup),
				uncontrolledFillThicknessMeters: caliFillThickness,
				colluvialDeposit: caliColluvialDeposit,
			});
		},
		[
			calculationMode,

			caliHazardId,
			caliColluvialDeposit,
			caliFillThickness,
			caliImportanceGroup,
			caliOptionId,
		],
	);
	const dosquebradasResult = useMemo(() => {
		if (
			calculationMode !== "dosquebradas-microzonation" ||
			dosquebradasZoneId === null
		) return null;
		return adaptDosquebradasSpectrum({
			zoneId: dosquebradasZoneId,
			hazardId: "design",
			importanceFactor: importanceCoefficient(dosquebradasImportanceGroup),
		});
	}, [
		calculationMode,
		dosquebradasImportanceGroup,
		dosquebradasZoneId,
	]);
	const result =
		calculationMode === "nsr10-national"
			? nsr10Result
			: calculationMode === "ccp14"
				? ccp14Result
			: calculationMode === "bogota-microzonation"
				? bogotaResult
				: calculationMode === "medellin-microzonation"
					? medellinResult
				: calculationMode === "cali-microzonation"
					? caliResult
					: calculationMode === "dosquebradas-microzonation"
						? dosquebradasResult
					: null;
	const evaluatePeriod = useCallback(
		(periodSeconds: number) => {
			if (!result) {
				return { status: "unavailable" as const, message: "Este modo no tiene un motor activo." };
			}
			const ordinate = result.saAt(periodSeconds);
			return ordinate.status === "ok"
				? {
						status: "ok" as const,
						saG: ordinate.point.saG,
						branchLabel:
							allBranchLabels[ordinate.point.branchId] ??
							ordinate.point.branchId,
					}
				: {
						status: "unavailable" as const,
						message: ordinate.applicability.message,
					};
		},
		[result],
	);

	/**
	 * A blocked scenario still has evidence worth reading — the sources and the
	 * warning that blocks it — so the drawer shows whatever the study can
	 * resolve, and only a study that declares nothing resolvable drops out.
	 */
	const traceableResult =
		result && result.evidenceAvailability.status !== "unavailable"
			? result
			: null;
	const traceability = result
		? capabilityUiState(result.capabilities.traceabilityViewer)
		: { enabled: false, reason: "Este modo no tiene un resultado trazable activo." };
	const resultActions =
		result?.status === "ok" ? (
			<>
				<Button
					disabled={!traceability.enabled}
					onClick={() => setTraceabilityOpen(true)}
					title={traceability.reason ?? undefined}
					type="button"
					variant="outline"
				>
					<LandmarkIcon data-icon="inline-start" />
					Ver trazabilidad
				</Button>
				<ExportActions
					capabilities={result.capabilities}
					chartContainerRef={chartContainerRef}
					result={result}
				/>
			</>
		) : null;
	const inputPanel =
		calculationMode === "nsr10-national" ? (
			<ParameterRail
				hazardLevel={hazardLevel}
				importanceGroup={importanceGroup}
				municipio={municipio}
				onHazardLevelChange={setHazardLevel}
				onImportanceGroupChange={setImportanceGroup}
				onMunicipioChange={setMunicipio}
				onSoilProfileChange={setSoilProfile}
				soilProfile={soilProfile}
			/>
		) : calculationMode === "ccp14" ? (
			<Ccp14ParameterRail
				mapLocationId={ccp14MapLocationId}
				onMapLocationChange={(value) => {
					setCcp14MapLocationId(value);
					const reading = ccp14CityReading(value);
					const values = ccp14CityValues(value);
					if (reading && values) {
						setCcp14Regions({ ...reading.regions });
						setCcp14Values(values);
					}
				}}
				onTraceabilityOpen={() => setTraceabilityOpen(true)}
				onRegionChange={(coefficient, region) => {
					setCcp14Regions((current) => ({
						...current,
						[coefficient]: region,
					}));
					setCcp14Values((current) => ({
						...current,
						[coefficient]:
							region === null
								? null
								: ccp14LegendValue(coefficient, region),
					}));
				}}
				onSoilClassChange={(value) =>
					setCcp14SoilClass(value as Ccp14SoilClass)
				}
				onValueChange={(coefficient, value) =>
					setCcp14Values((current) => ({ ...current, [coefficient]: value }))
				}
				regions={ccp14Regions}
				soilClass={ccp14SoilClass}
				values={ccp14Values}
			/>
		) : calculationMode === "bogota-microzonation" ? (
			<BogotaParameterRail
				hazardDescription={municipalHazardDescription(
					bogotaCanonical.hazards.find(({ id }) => id === bogotaHazardId),
				)}
				hazardId={bogotaHazardId}
				hazardOptions={bogotaHazardOptions}
				importanceGroup={bogotaImportanceGroup}
				onHazardChange={(value) =>
					setBogotaHazardId(value as typeof bogotaHazardId)
				}
				onImportanceGroupChange={setBogotaImportanceGroup}
				onTraceabilityOpen={() => setTraceabilityOpen(true)}
				onZoneChange={setBogotaZoneId}
				zoneId={bogotaZoneId}
				zoneOptions={bogotaZoneOptions}
			/>
		) : calculationMode === "medellin-microzonation" ? (
			<MedellinParameterRail
				hazardDescription={medellinHazardDescription(medellinHazardId)}
				hazardId={medellinHazardId}
				hazardOptions={medellinHazardOptions}
				importanceGroup={medellinImportanceGroup}
				onHazardChange={setMedellinHazardId}
				onImportanceGroupChange={setMedellinImportanceGroup}
				onZoneChange={setMedellinZoneId}
				zoneId={medellinZoneId}
				zoneOptions={medellinZoneOptions}
			/>
		) : calculationMode === "cali-microzonation" ? (
			<CaliParameterRail
				onTraceabilityOpen={() => setTraceabilityOpen(true)}
				colluvialDeposit={caliColluvialDeposit}
				fillThicknessMeters={caliFillThickness}
				onColluvialDepositChange={setCaliColluvialDeposit}
				onFillThicknessChange={setCaliFillThickness}
				componentId={caliComponentId}
				componentOptions={activeCaliComponentOptions}
				hazardDescription={municipalHazardDescription(
					caliCanonical.hazards.find(({ id }) => id === caliHazardId),
				)}
				hazardId={caliHazardId}
				hazardOptions={caliHazardOptions}
				importanceGroup={caliImportanceGroup}
				onHazardChange={setCaliHazardId}
				onImportanceGroupChange={setCaliImportanceGroup}
				onComponentChange={setCaliComponentId}
				onZoneChange={(value) => {
					setCaliZoneId(value);
					setCaliComponentId(null);
				}}
				zoneId={caliZoneId}
				zoneOptions={caliZoneOptions}
			/>
		) : calculationMode === "dosquebradas-microzonation" ? (
			<DosquebradasParameterRail
				importanceGroup={dosquebradasImportanceGroup}
				onImportanceGroupChange={setDosquebradasImportanceGroup}
				onZoneChange={setDosquebradasZoneId}
				zoneId={dosquebradasZoneId}
				zoneOptions={dosquebradasZoneOptions}
			/>
		) : isSourceBlockedMode(calculationMode) ? (
			<SourceBlockedRail modeId={calculationMode} />
		) : null;
	const activeHazardLabel = result?.hazard?.label ?? "";
	const maximumMetric = result?.status === "ok"
		? result.metrics.find((metric) => metric.id === "saMax")?.value ??
			result.metrics.find((metric) => metric.id === "sa-plateau")?.value ??
			result.metrics.find((metric) => metric.id === "smax")?.value ??
			Math.max(...result.points.map(({ saG }) => saG))
		: 0;
	const manualSelectionNotice =
		calculationMode === "ccp14" && ccp14Result === null ? (
			<ManualSelectionNotice
				description="Selecciona la región que leas para PGA, Ss y S1 en las Figuras 3.10.2.1-1 a 3.10.2.1-3, y el perfil de sitio del proyecto."
				title="Completa los datos de CCP-14"
			/>
		) : calculationMode === "dosquebradas-microzonation" &&
			dosquebradasZoneId === null ? (
			<ManualSelectionNotice
				description="Elige manualmente una de las cinco zonas publicadas en la Tabla 27."
				title="Selecciona la zona de Dosquebradas"
			/>
		) : calculationMode === "bogota-microzonation" && bogotaZoneId === null ? (
			<ManualSelectionNotice
				description="Elige una zona de respuesta de la publicación oficial."
				title="Selecciona la zona de Bogotá"
			/>
		) : calculationMode === "medellin-microzonation" &&
			medellinZoneId === null ? (
			<ManualSelectionNotice
				description="Elige manualmente una de las 14 zonas homogéneas publicadas."
				title="Selecciona la zona de Medellín"
			/>
		) : calculationMode === "medellin-microzonation" &&
			medellinHazardId === null ? (
			<ManualSelectionNotice
				description="Elige explícitamente la familia de diseño (5 %) o control de daños/servicio (2 %)."
				title="Selecciona la familia de amenaza de Medellín"
			/>
		) : calculationMode === "cali-microzonation" && caliZoneId === null ? (
			<ManualSelectionNotice
				description="Elige una de las diez zonas geográficas publicadas."
				title="Selecciona la zona de Cali"
			/>
		) : calculationMode === "cali-microzonation" && caliOptionId === null ? (
			<ManualSelectionNotice
				description="Esta zona tiene dos curvas concurrentes; selecciona Tc o TL y verifica ambas por separado."
				title="Selecciona el componente de curva"
			/>
		) : null;

	return (
		<div className="flex flex-col gap-5">
			{result ||
			(calculationMode === "ccp14" && ccp14MapLocationId) ||
			(calculationMode === "bogota-microzonation" && bogotaZoneId) ||
			(calculationMode === "cali-microzonation" && caliZoneId) ? (
				<TraceabilitySheet
					onOpenChange={setTraceabilityOpen}
					open={traceabilityOpen}
					result={traceableResult}
					scenarioEvidenceKey={traceableResult?.scenarioEvidenceKey ?? null}
					sourceEvidence={
						calculationMode === "ccp14" ? (
							<Ccp14FigureEvidence locationId={ccp14MapLocationId} />
						) : calculationMode === "bogota-microzonation" ? (
							<BogotaFigureEvidence zoneId={bogotaZoneId} />
						) : calculationMode === "cali-microzonation" ? (
							<CaliFigureEvidence componentId={caliOptionId ?? caliZoneId} />
						) : null
					}
				/>
			) : null}
			<p className="text-muted-foreground text-sm">
				Calculadora unificada con selección manual y trazabilidad de fuente;
				 no usa mapas, coordenadas, GIS ni envía datos.
			</p>

			<CalculatorShell
				inputPanel={inputPanel}
				modes={calculationModes}
				onValueChange={(nextMode) => {
					setTraceabilityOpen(false);
					setCalculationMode(nextMode as CalculatorModeId);
				}}
				value={calculationMode}
			>
				{result?.status === "ok" ? (
					<>
						<SharedSpectrumChart
							actions={resultActions}
							description={activeChartDescription(
								calculationMode,
								hazardLevel,
							)}
							highlight={`Sa máx ${formatDecimal(
								maximumMetric,
								3,
							)} g`}
							ref={chartContainerRef}
							result={result}
							title={`Espectro elástico · ${activeHazardLabel} (Sa vs. T)`}
							transitionMetrics={transitionMetrics(
								calculationMode,
								result.hazard.id,
							)}
						/>
						<SharedSpectrumNotices warnings={result.warnings} />
						<SpectrumPeriodLookup evaluate={evaluatePeriod} />
						<SharedSpectrumMetrics
							metrics={result.metrics}
							presentation={
								calculationMode === "nsr10-national"
									? damageMetricPresentation(hazardLevel)
									: metricPresentation
							}
						/>
						<SharedSpectrumTable
							branchLabels={allBranchLabels}
							points={result.points}
						/>
					</>
				) : result ? (
					<SiteSpecificStudyNotice
						onTraceabilityOpen={() => setTraceabilityOpen(true)}
						result={result}
					/>
				) : isSourceBlockedMode(calculationMode) ? (
					<SourceBlockedResult modeId={calculationMode} />
				) : manualSelectionNotice}
			</CalculatorShell>
		</div>
	);
}
