"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { FileWarningIcon } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MunicipalityTraceability } from "@/lib/nsr10/evidence";

import { PdfLoading } from "./pdf-loading";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

function rectStyle(rect: MunicipalityTraceability["row"]): CSSProperties {
	return {
		left: `${rect.left * 100}%`,
		top: `${rect.top * 100}%`,
		width: `${rect.width * 100}%`,
		height: `${rect.height * 100}%`,
	};
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

export function SourcePdfViewer({
	traceability,
}: {
	traceability: MunicipalityTraceability;
}) {
	const [pageRendered, setPageRendered] = useState(false);
	const { pageNumber, row, source, values } = traceability;

	return (
		<div className="overflow-hidden rounded-2xl bg-muted shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_24px_rgb(0_0_0/0.08)] ring-1 ring-black/10 dark:ring-white/10">
			<Document
				error={<PdfError />}
				file={source.pdfPath}
				loading={<PdfLoading />}
				onLoadError={() => setPageRendered(false)}
			>
				<div className="relative w-full bg-white">
					<Page
						className="w-full [&_canvas]:!h-auto [&_canvas]:!w-full"
						error={<PdfError />}
						loading={<PdfLoading />}
						onRenderError={() => setPageRendered(false)}
						onRenderSuccess={() => setPageRendered(true)}
						pageNumber={pageNumber}
						renderAnnotationLayer={false}
						renderTextLayer={false}
						width={900}
					/>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute rounded-[2px] bg-yellow-300/25 opacity-0 ring-1 ring-inset ring-yellow-600/50 transition-opacity duration-200 motion-reduce:transition-none data-[visible=true]:opacity-100"
						data-visible={pageRendered}
						style={rectStyle(row)}
					/>
					{Object.entries(values).map(([key, value]) => (
						<div
							aria-hidden="true"
							className="pointer-events-none absolute rounded-[2px] bg-yellow-300/60 opacity-0 ring-1 ring-inset ring-yellow-700/70 transition-opacity delay-75 duration-200 motion-reduce:transition-none data-[visible=true]:opacity-100"
							data-visible={pageRendered}
							key={key}
							style={rectStyle(value.rect)}
						/>
					))}
				</div>
			</Document>
		</div>
	);
}
