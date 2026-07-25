"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { FileWarningIcon } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
	SpectrumEvidenceCitation,
	SpectrumEvidenceDocument,
	SpectrumEvidenceRect,
} from "@/lib/spectra";
import { cn } from "@/lib/utils";

import { PdfLoading } from "./pdf-loading";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

function rectStyle(rect: SpectrumEvidenceRect): CSSProperties {
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
	document,
	citations,
}: {
	document: SpectrumEvidenceDocument;
	citations: SpectrumEvidenceCitation[];
}) {
	const [pageRendered, setPageRendered] = useState(false);
	const pageNumber = citations[0]?.physicalPage;
	if (!document.localPath || !pageNumber) return <PdfError />;
	if (
		citations.some(
			(citation) =>
				citation.sourceId !== document.sourceId ||
				citation.physicalPage !== pageNumber,
		)
	) {
		throw new Error("PDF evidence viewer requires citations from one source page");
	}

	return (
		<div className="overflow-hidden rounded-2xl bg-muted shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_24px_rgb(0_0_0/0.08)] ring-1 ring-black/10 dark:ring-white/10">
			<Document
				error={<PdfError />}
				file={document.localPath}
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
					{citations.map((citation) => (
						<div
							aria-hidden="true"
							className={cn(
								"pointer-events-none absolute rounded-[2px] opacity-0 ring-1 ring-inset transition-opacity duration-200 motion-reduce:transition-none data-[visible=true]:opacity-100",
								citation.kind === "cell"
									? "bg-yellow-300/60 ring-yellow-700/70 delay-75"
									: "bg-yellow-300/25 ring-yellow-600/50",
							)}
							data-visible={pageRendered}
							key={citation.id}
							style={rectStyle(citation.rect)}
						/>
					))}
				</div>
			</Document>
		</div>
	);
}
