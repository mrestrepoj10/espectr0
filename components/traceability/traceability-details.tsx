"use client";

import dynamic from "next/dynamic";
import {
	ExternalLinkIcon,
	FileWarningIcon,
	LandmarkIcon,
	ListTreeIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
	getMunicipalityTraceability,
	type MunicipalityTraceability,
} from "@/lib/nsr10/evidence";

import { PdfLoading } from "./pdf-loading";

const SourcePdfViewer = dynamic(
	() =>
		import("./source-pdf-viewer").then((module) => module.SourcePdfViewer),
	{
		loading: () => <PdfLoading />,
		ssr: false,
	},
);

function HighlightedValue({ value }: { value: number }) {
	return (
		<span className="inline-flex rounded-md bg-yellow-300/45 px-1.5 py-0.5 text-yellow-950 ring-1 ring-inset ring-yellow-600/40 dark:bg-yellow-300/80">
			{value.toFixed(2)}
		</span>
	);
}

function SourceValues({
	traceability,
}: {
	traceability: MunicipalityTraceability;
}) {
	const { municipality, source, values } = traceability;

	return (
		<section aria-labelledby="source-values" className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="font-heading font-medium" id="source-values">
					Valores de origen
				</h2>
				<Badge variant="outline">Dato normativo directo</Badge>
			</div>

			<Alert>
				<LandmarkIcon />
				<AlertTitle>
					{source.appendix} · municipio de {municipality.municipio}
				</AlertTitle>
				<AlertDescription>
					Estos coeficientes se transcriben de la norma; no resultan de una fórmula
					del motor.
				</AlertDescription>
			</Alert>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Municipio</TableHead>
						<TableHead>Código DANE</TableHead>
						<TableHead className="text-right">Aa</TableHead>
						<TableHead className="text-right">Av</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell className="font-medium">
							{municipality.municipio}
						</TableCell>
						<TableCell className="font-mono">{municipality.code}</TableCell>
						<TableCell className="text-right font-mono tabular-nums">
							<HighlightedValue value={values.aa.value} />
						</TableCell>
						<TableCell className="text-right font-mono tabular-nums">
							<HighlightedValue value={values.av.value} />
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</section>
	);
}

function CalculationUse() {
	return (
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
	);
}

function EvidenceDocument({
	traceability,
}: {
	traceability: MunicipalityTraceability;
}) {
	const { municipality, pageNumber, printedPage, source, values } = traceability;

	return (
		<section aria-labelledby="pdf-evidence" className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h2 className="font-heading font-medium" id="pdf-evidence">
						Evidencia en el documento
					</h2>
					<p className="text-muted-foreground text-xs">
						Página PDF {pageNumber} · página impresa {printedPage}
					</p>
				</div>
				<a
					className={buttonVariants({ size: "sm", variant: "outline" })}
					href={source.sourceUrl}
					rel="noreferrer"
					target="_blank"
				>
					Abrir PDF fuente
					<ExternalLinkIcon data-icon="inline-end" />
				</a>
			</div>

			<SourcePdfViewer
				key={`${municipality.code}-${pageNumber}`}
				traceability={traceability}
			/>

			<div
				aria-label="Leyenda del resaltado"
				className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-xs"
				role="group"
			>
				<span className="inline-flex items-center gap-2">
					<span
						aria-hidden="true"
						className="size-3 rounded-[3px] bg-yellow-300/25 ring-1 ring-inset ring-yellow-600/50"
					/>
					Fila normativa
				</span>
				<span className="inline-flex items-center gap-2">
					<span
						aria-hidden="true"
						className="size-3 rounded-[3px] bg-yellow-300/70 ring-1 ring-inset ring-yellow-600/50"
					/>
					Valores Aa y Av usados
				</span>
			</div>

			<p className="text-muted-foreground text-xs">
				Extracto accesible: {municipality.municipio}, {municipality.departamento},
				código DANE {municipality.code}: Aa {values.aa.value.toFixed(2)} y Av{" "}
				{values.av.value.toFixed(2)}, resaltados en la página impresa {printedPage}
				de {source.appendix}.
			</p>
		</section>
	);
}

function TraceabilityUnavailable({ municipalityCode }: { municipalityCode: string }) {
	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div className="p-4 sm:p-6">
				<Alert variant="destructive">
					<FileWarningIcon />
					<AlertTitle>Evidencia no disponible</AlertTitle>
					<AlertDescription>
						No existe una referencia normativa para el código DANE{" "}
						<span className="font-mono">{municipalityCode}</span>.
					</AlertDescription>
				</Alert>
			</div>
		</div>
	);
}

function TraceabilityContent({
	traceability,
}: {
	traceability: MunicipalityTraceability;
}) {
	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div className="flex flex-col gap-6 p-4 sm:p-6">
				<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
					<span>Fuente normativa</span>
					<Badge variant="secondary">{traceability.source.document}</Badge>
				</div>
				<SourceValues traceability={traceability} />
				<Separator />
				<CalculationUse />
				<Separator />
				<EvidenceDocument traceability={traceability} />
			</div>
		</div>
	);
}

export function TraceabilityDetails({
	municipalityCode,
}: {
	municipalityCode: string;
}) {
	const traceability = getMunicipalityTraceability(municipalityCode);

	return traceability ? (
		<TraceabilityContent traceability={traceability} />
	) : (
		<TraceabilityUnavailable municipalityCode={municipalityCode} />
	);
}
