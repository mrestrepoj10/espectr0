"use client";

import dynamic from "next/dynamic";
import {
	ExternalLinkIcon,
	FileWarningIcon,
	LandmarkIcon,
	ListTreeIcon,
	ShieldCheckIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	resolveSpectrumEvidence,
	type NormalizedSpectrumResultData,
	type ScenarioEvidenceKey,
	type SpectrumEvidenceCitation,
	type SpectrumEvidenceDocument,
	type SpectrumEvidenceView,
} from "@/lib/spectra";

import { PdfLoading } from "./pdf-loading";

const SourcePdfViewer = dynamic(
	() =>
		import("./source-pdf-viewer").then((module) => module.SourcePdfViewer),
	{
		loading: () => <PdfLoading />,
		ssr: false,
	},
);

const numberFormatter = new Intl.NumberFormat("es-CO", {
	maximumFractionDigits: 6,
	useGrouping: false,
});

function displayValue(value: unknown) {
	return typeof value === "number" ? numberFormatter.format(value) : String(value);
}

function StudyAndSelection({ evidence }: { evidence: SpectrumEvidenceView }) {
	const { selection, study } = evidence;
	return (
		<section aria-labelledby="active-study" className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="font-heading font-medium text-pretty" id="active-study">
					Estudio & escenario activos
				</h2>
				<Badge variant={evidence.status === "available" ? "default" : "outline"}>
					{evidence.status === "available"
						? "Evidencia disponible"
						: evidence.status === "partial"
							? "Evidencia parcial"
							: "Evidencia no disponible"}
				</Badge>
			</div>
			<Card size="sm">
				<CardHeader>
					<CardTitle>{study.label}</CardTitle>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						<div className="flex flex-col gap-1">
							<dt className="text-muted-foreground">Versión</dt>
							<dd translate="no">{study.version}</dd>
						</div>
						<div className="flex flex-col gap-1">
							<dt className="text-muted-foreground">Ubicación</dt>
							<dd>{selection.location ?? "No resuelta"}</dd>
						</div>
						<div className="flex flex-col gap-1">
							<dt className="text-muted-foreground">Zona</dt>
							<dd>{selection.zone ?? "No aplica o no está declarada"}</dd>
						</div>
						<div className="flex flex-col gap-1">
							<dt className="text-muted-foreground">Amenaza</dt>
							<dd>{selection.hazardLabel ?? selection.hazardId ?? "No resuelta"}</dd>
						</div>
					</dl>
				</CardContent>
			</Card>
		</section>
	);
}

function EvidenceNotices({ evidence }: { evidence: SpectrumEvidenceView }) {
	if (evidence.unavailableClaims.length === 0) return null;
	return (
		<Alert variant={evidence.status === "unavailable" ? "destructive" : "default"}>
			<FileWarningIcon />
			<AlertTitle>
				{evidence.status === "unavailable"
					? "Evidencia no disponible"
					: "Cobertura de evidencia parcial"}
			</AlertTitle>
			<AlertDescription>
				<ul className="flex list-disc flex-col gap-1 pl-4">
					{evidence.unavailableClaims.map((claim) => (
						<li key={claim.id}>{claim.reason}</li>
					))}
				</ul>
			</AlertDescription>
		</Alert>
	);
}

function DirectValues({ evidence }: { evidence: SpectrumEvidenceView }) {
	if (evidence.directValues.length === 0) return null;
	return (
		<section aria-labelledby="direct-values" className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<LandmarkIcon aria-hidden="true" />
					<h2 className="font-heading font-medium" id="direct-values">
						Valores directos de fuente
					</h2>
				</div>
				<Badge variant="outline">direct-source</Badge>
			</div>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Campo</TableHead>
						<TableHead className="text-right">Valor</TableHead>
						<TableHead>Evidencia</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{evidence.directValues.map((value) => (
						<TableRow key={value.id}>
							<TableCell className="font-medium">{value.label}</TableCell>
							<TableCell className="text-right font-mono tabular-nums">
								{displayValue(value.value)} {value.unit ?? ""}
							</TableCell>
							<TableCell>
								<Badge variant="secondary" translate="no">
									{value.citationId}
								</Badge>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</section>
	);
}

function Lineage({ evidence }: { evidence: SpectrumEvidenceView }) {
	if (evidence.metricLineage.length === 0 && evidence.branchLineage.length === 0) {
		return null;
	}
	return (
		<section aria-labelledby="calculation-lineage" className="flex flex-col gap-4">
			<div className="flex items-center gap-2">
				<ListTreeIcon aria-hidden="true" />
				<h2 className="font-heading font-medium" id="calculation-lineage">
					Linaje del resultado
				</h2>
			</div>
			<div className="flex flex-col gap-3">
				<h3 className="text-sm font-medium">Métricas derivadas</h3>
				{evidence.metricLineage.map((metric) => (
					<Card key={metric.id} size="sm">
						<CardHeader>
							<CardTitle>
								{metric.label}: {numberFormatter.format(metric.value)} {metric.unit}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid gap-2 text-xs sm:grid-cols-2">
								<div className="flex flex-col gap-1">
									<dt className="text-muted-foreground">Fórmula & referencia</dt>
									<dd>{metric.formula ?? "Valor directo o fórmula no disponible"}</dd>
									<dd className="text-muted-foreground">{metric.reference ?? "Sin referencia regional"}</dd>
								</div>
								<div className="flex flex-col gap-1">
									<dt className="text-muted-foreground">Sustitución & dependencias</dt>
									<dd>{metric.substitution ?? "No aplica"}</dd>
									<dd className="break-words font-mono" translate="no">
										{metric.dependencyIds.join(" → ") || "Sin dependencias"}
									</dd>
								</div>
							</dl>
						</CardContent>
					</Card>
				))}
			</div>
			<div className="flex flex-col gap-3">
				<h3 className="text-sm font-medium">Sa(T) por rama</h3>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Rama</TableHead>
							<TableHead>Intervalo T</TableHead>
							<TableHead>Fórmula & referencia</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{evidence.branchLineage.map((branch) => (
							<TableRow key={branch.branchId}>
								<TableCell className="font-mono text-xs" translate="no">
									{branch.branchId}
								</TableCell>
								<TableCell className="font-mono tabular-nums">
									{numberFormatter.format(branch.periodRangeSeconds.from)}–
									{numberFormatter.format(branch.periodRangeSeconds.to)} s
								</TableCell>
								<TableCell>
									<p>{branch.formula ?? branch.formulaId}</p>
									<p className="text-muted-foreground text-xs">
										{branch.condition ?? "Condición regional no disponible"}
									</p>
									<p className="text-muted-foreground text-xs">
										{branch.reference ?? "Referencia regional no disponible"}
									</p>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}

function citationPageLabel(citation: SpectrumEvidenceCitation) {
	return `Página PDF ${citation.physicalPage}${
		citation.printedPage ? ` · impresa ${citation.printedPage}` : ""
	}`;
}

export function groupCitationsByPhysicalPage(
	citations: SpectrumEvidenceCitation[],
) {
	const groups = new Map<number, SpectrumEvidenceCitation[]>();
	for (const citation of citations) {
		const page = groups.get(citation.physicalPage) ?? [];
		page.push(citation);
		groups.set(citation.physicalPage, page);
	}
	return [...groups.entries()]
		.sort(([left], [right]) => left - right)
		.map(([, pageCitations]) => pageCitations);
}

export function EvidenceDocument({
	document,
	citations,
}: {
	document: SpectrumEvidenceDocument;
	citations: SpectrumEvidenceCitation[];
}) {
	const rowAndCells = citations.filter(
		(citation) => citation.kind === "row" || citation.kind === "cell",
	);
	const citedPages = groupCitationsByPhysicalPage(rowAndCells);
	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>{document.title}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<dl className="grid gap-3 text-sm sm:grid-cols-2">
					<div className="flex flex-col gap-1">
						<dt className="text-muted-foreground">Autoridad</dt>
						<dd>{document.issuingAuthority ?? "No registrada en la evidencia instalada"}</dd>
					</div>
					<div className="flex flex-col gap-1">
						<dt className="text-muted-foreground">Edición</dt>
						<dd>{document.edition}</dd>
					</div>
					<div className="flex flex-col gap-1">
						<dt className="text-muted-foreground">Instrumento de adopción</dt>
						<dd>{document.adoptionInstrument ?? "No registrado en la evidencia instalada"}</dd>
					</div>
					<div className="flex min-w-0 flex-col gap-1">
						<dt className="text-muted-foreground">SHA-256</dt>
						<dd className="break-all font-mono text-xs" translate="no">
							{document.sha256}
						</dd>
					</div>
				</dl>
				<div className="flex flex-wrap gap-2">
					{document.officialUrl ? (
						<Button
							nativeButton={false}
							render={<a href={document.officialUrl} rel="noreferrer" target="_blank" />}
							size="sm"
							variant="outline"
						>
							Abrir enlace oficial
							<ExternalLinkIcon data-icon="inline-end" />
						</Button>
					) : (
						<Badge variant="outline">Enlace oficial no disponible</Badge>
					)}
					<Button
						nativeButton={false}
						render={<a href={document.sourceUrl} rel="noreferrer" target="_blank" />}
						size="sm"
						variant="outline"
					>
						Abrir fuente disponible
						<ExternalLinkIcon data-icon="inline-end" />
					</Button>
				</div>
				{document.localPath
					? citedPages.map((pageCitations) => (
						<section
							aria-label={`Vista de evidencia · ${citationPageLabel(pageCitations[0])}`}
							key={pageCitations[0].physicalPage}
						>
							<SourcePdfViewer citations={pageCitations} document={document} />
						</section>
					))
					: null}
				<div className="flex flex-col gap-2">
					<h3 className="text-sm font-medium">Transcripción accesible</h3>
					{citations.map((citation) => (
						<div className="flex flex-col gap-1 text-xs" key={citation.id}>
							<p className="font-medium">
								{citation.reference} · {citationPageLabel(citation)}
							</p>
							<dl className="grid gap-1 sm:grid-cols-3">
								<div className="flex gap-1">
									<dt className="text-muted-foreground">Tabla:</dt>
									<dd>{citation.table ?? "No aplica"}</dd>
								</div>
								<div className="flex gap-1">
									<dt className="text-muted-foreground">Fila:</dt>
									<dd>{citation.row ?? "No aplica"}</dd>
								</div>
								<div className="flex gap-1">
									<dt className="text-muted-foreground">Celda:</dt>
									<dd>{citation.cell ?? "No aplica"}</dd>
								</div>
							</dl>
							<p className="text-muted-foreground">{citation.transcription}</p>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function Documents({ evidence }: { evidence: SpectrumEvidenceView }) {
	if (evidence.documents.length === 0) return null;
	return (
		<section aria-labelledby="evidence-documents" className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<ShieldCheckIcon aria-hidden="true" />
				<h2 className="font-heading font-medium" id="evidence-documents">
					Documentos & regiones de evidencia
				</h2>
			</div>
			{evidence.documents.map((document) => (
				<EvidenceDocument
					citations={evidence.citations.filter(
						(citation) => citation.sourceId === document.sourceId,
					)}
					document={document}
					key={document.sourceId}
				/>
			))}
		</section>
	);
}

export function TraceabilityDetails({
	result,
	scenarioEvidenceKey,
}: {
	result: NormalizedSpectrumResultData;
	scenarioEvidenceKey: ScenarioEvidenceKey;
}) {
	const evidence = resolveSpectrumEvidence(result, scenarioEvidenceKey);
	return (
		<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
			<div className="flex flex-col gap-6 p-4 sm:p-6">
				<StudyAndSelection evidence={evidence} />
				<EvidenceNotices evidence={evidence} />
				<DirectValues evidence={evidence} />
				<Separator />
				<Lineage evidence={evidence} />
				<Separator />
				<Documents evidence={evidence} />
			</div>
		</div>
	);
}
