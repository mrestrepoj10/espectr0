"use client";

import { FileWarningIcon } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

const pdfPath = "/nsr10-titulo-a-2017.pdf";

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
	return (
		<div className="overflow-hidden rounded-2xl border bg-muted">
			<Document error={<PdfError />} file={pdfPath} loading={<PdfLoading />}>
				<div className="relative w-full bg-white">
					<Page
						className="w-full [&_canvas]:!h-auto [&_canvas]:!w-full"
						loading={<PdfLoading />}
						pageNumber={191}
						renderAnnotationLayer={false}
						renderTextLayer={false}
						width={900}
					/>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute top-[63.3%] left-[12.5%] h-[1.8%] w-[72.5%] rounded-[2px] bg-primary/20 ring-2 ring-primary ring-offset-1"
					/>
				</div>
			</Document>
		</div>
	);
}
