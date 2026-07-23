"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
	ChevronDownIcon,
	CodeXmlIcon,
	DownloadIcon,
	FileDownIcon,
	FileJsonIcon,
	FileTextIcon,
	ImageIcon,
	LandmarkIcon,
	LoaderCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
	CalculatorNotices,
	CalculatorResultHeader,
	CalculatorShell,
	SpectrumPeriodLookup,
} from "@/components/calculator-shell";
import {
	defaultMunicipio,
	getHazardNotice,
	getMunicipalityCoefficients,
	HazardLevelControl,
	ImportanceGroupControl,
	MunicipalityCombobox,
	SoilProfileControl,
} from "@/components/spectrum-controls";
import {
	SharedSpectrumChart,
	SharedSpectrumMetrics,
	SharedSpectrumNotices,
	SharedSpectrumTable,
} from "@/components/spectrum-result";
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
	downloadEtabsTxt,
} from "@/lib/chart-export";
import { capabilityUiState } from "@/lib/calculator-shell";
import { hazardLevelDetails, normalizeSearchText } from "@/lib/nsr10";
import {
	adaptNsr10Spectrum,
	parseNsr10TraceEnvelope,
} from "@/lib/spectra";

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

const calculationModes = [
	{
		id: "nsr10-national",
		label: "NSR-10 Nacional",
		description:
			"Espectro elástico nacional para edificaciones, con los tres niveles de amenaza ya soportados.",
	},
] as const;

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

const metricPresentation = {
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
			? "Perfil F: análisis específico requerido"
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

function spectrumCsv(result: NormalizedSpectrumOk) {
	const rows = result.points.map((point) => `${point.tSeconds},${point.saG}`);
	return ["T (s),Sa (g)", ...rows].join("\n");
}

function downloadCsv(result: NormalizedSpectrumOk, municipio: Municipio) {
	const blob = new Blob([`\uFEFF${spectrumCsv(result)}`], {
		type: "text/csv;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	const slug = normalizeSearchText(municipio.municipio).replace(/\s+/g, "-");

	anchor.href = url;
	anchor.download = `espectr0-${slug}-${result.hazard.id}.csv`;
	anchor.click();
	URL.revokeObjectURL(url);
}

function ExportActions({
	chartContainerRef,
	result,
	municipio,
	capabilities,
}: {
	chartContainerRef: React.RefObject<HTMLDivElement | null>;
	result: NormalizedSpectrumOk;
	municipio: Municipio;
	capabilities: SpectrumCapabilities;
}) {
	const [isPdfExporting, setIsPdfExporting] = useState(false);

	function copyJson() {
		void copyTextToClipboard(JSON.stringify(result.trace.data, null, 2))
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
			void copyChartPng(chartSvg(), chartContainerRef.current)
				.then(() => toast.success("PNG copiado al portapapeles."))
				.catch(() => toast.error("No fue posible copiar el PNG."));
		} catch {
			toast.error("No fue posible copiar el PNG.");
		}
	}

	function copySvg() {
		try {
			void copyChartSvg(chartSvg())
				.then(() => toast.success("SVG copiado al portapapeles."))
				.catch(() => toast.error("No fue posible copiar el SVG."));
		} catch {
			toast.error("No fue posible copiar el SVG.");
		}
	}

	function exportCsv() {
		try {
			downloadCsv(result, municipio);
			toast.success("CSV descargado.");
		} catch {
			toast.error("No fue posible descargar el CSV.");
		}
	}

	function exportEtabs() {
		try {
			const slug = normalizeSearchText(municipio.municipio).replace(/\s+/g, "-");
			downloadEtabsTxt(
				result.points.map((point) => ({ t: point.tSeconds, sa: point.saG })),
				`espectr0-${slug}-${result.hazard.id}-etabs.txt`,
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
			const trace = parseNsr10TraceEnvelope(result.trace);
			const { downloadCalculationMemoriaPdf } = await import(
				"@/lib/memoria-pdf-renderer"
			);
			await downloadCalculationMemoriaPdf(trace);
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

export function CalculatorPage() {
	const [calculationMode, setCalculationMode] =
		useState<(typeof calculationModes)[number]["id"]>("nsr10-national");
	const [municipio, setMunicipio] = useState<Municipio>(defaultMunicipio);
	const [soilProfile, setSoilProfile] = useState<SoilProfile>("D");
	const [importanceGroup, setImportanceGroup] = useState<ImportanceGroup>("I");
	const [hazardLevel, setHazardLevel] = useState<HazardLevel>("design");
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
	const result = useMemo(
		() => adaptNsr10Spectrum(spectrumParams, { municipality: municipio }),
		[spectrumParams, municipio],
	);
	const evaluatePeriod = useCallback(
		(periodSeconds: number) => {
			const ordinate = result.saAt(periodSeconds);
			return ordinate.status === "ok"
				? {
						status: "ok" as const,
						saG: ordinate.point.saG,
						branchLabel:
							branchLabels[ordinate.point.branchId as SpectrumBranch] ??
							ordinate.point.branchId,
					}
				: {
						status: "unavailable" as const,
						message: ordinate.applicability.message,
					};
		},
		[result],
	);

	const traceability = capabilityUiState(result.capabilities.traceabilityViewer);
	const resultActions =
		result.status === "ok" ? (
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
					municipio={municipio}
					result={result}
				/>
			</>
		) : null;

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

			<CalculatorShell
				inputPanel={
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
				}
				modes={calculationModes}
				onValueChange={(nextMode) => {
					if (nextMode === "nsr10-national") setCalculationMode(nextMode);
				}}
				value={calculationMode}
			>
				{result.status === "ok" ? (
					<>
						<SharedSpectrumChart
							actions={resultActions}
							description={chartDescription(hazardLevel)}
							highlight={`Sa máx ${formatDecimal(
								result.metrics.find((metric) => metric.id === "saMax")?.value ?? 0,
								3,
							)} g`}
							ref={chartContainerRef}
							result={result}
							title={`Espectro elástico · ${result.hazard.label} (Sa vs. T)`}
							transitionMetrics={[
								{
									id: "tc",
									label: hazardLevel === "damage-threshold" ? "TCd" : "TC",
								},
								{
									id: "tl",
									label: hazardLevel === "damage-threshold" ? "TLd" : "TL",
								},
							]}
						/>
						<SharedSpectrumNotices warnings={result.warnings} />
						<SpectrumPeriodLookup evaluate={evaluatePeriod} />
						<SharedSpectrumMetrics
							metrics={result.metrics}
							presentation={damageMetricPresentation(hazardLevel)}
						/>
						<SharedSpectrumTable
							branchLabels={branchLabels}
							points={result.points}
						/>
					</>
				) : (
					<SiteSpecificStudyNotice
						onTraceabilityOpen={() => setTraceabilityOpen(true)}
						result={result}
					/>
				)}
			</CalculatorShell>
		</div>
	);
}
