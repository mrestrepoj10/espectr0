"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { FileWarningIcon } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
	caliSourceEvidence,
	type NormalizedPdfRect,
} from "@/lib/nsr10/source-evidence";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

const pdfPath = "/nsr10-titulo-a-2017.pdf";

function rectStyle(rect: NormalizedPdfRect): CSSProperties {
	return {
		left: `${rect.left * 100}%`,
		top: `${rect.top * 100}%`,
		width: `${rect.width * 100}%`,
		height: `${rect.height * 100}%`,
	};
}

function PdfLoading() {
	return (
		<div className="flex aspect-[612/792] w-full flex-col gap-3 p-4">
			<Skeleton className="h-5 w-2/5" />
			<Skeleton className="h-3 w-3/4" />
			<Skeleton className="flex-1" />
		</div>
	);
}

function PdfError() {
	return (
		<div className="p-4">
			<Alert variant="destructive">
				<FileWarningIcon />
				<AlertTitle>No fue posible mostrar la página</AlertTitle>
				<AlertDescription>
					La referencia textual sigue disponible abajo. También puedes abrir el PDF
					de consulta con el enlace de la fuente.
				</AlertDescription>
			</Alert>
		</div>
	);
}

export function CaliSourcePdf() {
	const [pageRendered, setPageRendered] = useState(false);

	return (
		<div className="overflow-hidden rounded-2xl bg-muted shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_24px_rgb(0_0_0/0.08)] ring-1 ring-black/10 dark:ring-white/10">
			<Document error={<PdfError />} file={pdfPath} loading={<PdfLoading />}>
				<div className="relative w-full bg-white">
					<Page
						className="w-full [&_canvas]:!h-auto [&_canvas]:!w-full"
						loading={<PdfLoading />}
						onRenderSuccess={() => setPageRendered(true)}
						pageNumber={caliSourceEvidence.pageNumber}
						renderAnnotationLayer={false}
						renderTextLayer={false}
						width={900}
					/>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute rounded-[2px] bg-yellow-300/25 opacity-0 ring-1 ring-inset ring-yellow-600/50 transition-opacity duration-200 motion-reduce:transition-none data-[visible=true]:opacity-100"
						data-visible={pageRendered}
						style={rectStyle(caliSourceEvidence.row)}
					/>
					{caliSourceEvidence.values.map((evidenceValue) => (
						<div
							aria-hidden="true"
							className="pointer-events-none absolute rounded-[2px] bg-yellow-300/60 opacity-0 ring-1 ring-inset ring-yellow-700/70 transition-opacity delay-75 duration-200 motion-reduce:transition-none data-[visible=true]:opacity-100"
							data-visible={pageRendered}
							key={evidenceValue.key}
							style={rectStyle(evidenceValue.rect)}
						/>
					))}
				</div>
			</Document>
		</div>
	);
}
