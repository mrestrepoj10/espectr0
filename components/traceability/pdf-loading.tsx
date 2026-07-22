import { Skeleton } from "@/components/ui/skeleton";

export function PdfLoading() {
	return (
		<div
			aria-label="Cargando página de evidencia normativa"
			aria-live="polite"
			className="flex aspect-[612/792] w-full flex-col gap-3 p-4"
			role="status"
		>
			<Skeleton className="h-5 w-2/5" />
			<Skeleton className="h-3 w-3/4" />
			<Skeleton className="flex-1" />
			<span className="sr-only">Cargando página del PDF…</span>
		</div>
	);
}
