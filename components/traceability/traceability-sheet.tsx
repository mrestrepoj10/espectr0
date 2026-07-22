"use client";

import dynamic from "next/dynamic";

import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const TraceabilityDetails = dynamic(
	() =>
		import("./traceability-details").then(
			(module) => module.TraceabilityDetails,
		),
	{
		loading: () => <TraceabilityDetailsLoading />,
		ssr: false,
	},
);

function TraceabilityDetailsLoading() {
	return (
		<div
			aria-live="polite"
			className="min-h-0 flex-1 overflow-y-auto"
			role="status"
		>
			<div className="flex flex-col gap-4 p-4 sm:p-6">
				<Skeleton className="h-5 w-48" />
				<Skeleton className="h-24 w-full rounded-2xl" />
				<Skeleton className="h-32 w-full rounded-2xl" />
				<Skeleton className="aspect-[612/792] w-full rounded-2xl" />
			</div>
			<span className="sr-only">Cargando trazabilidad normativa…</span>
		</div>
	);
}

export function TraceabilitySheet({
	municipalityCode,
	open,
	onOpenChange,
}: {
	municipalityCode: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent
				className="h-dvh overflow-hidden border-0 data-[side=right]:w-screen data-[side=right]:max-w-none data-[side=right]:sm:w-[52vw] data-[side=right]:sm:min-w-[36rem] data-[side=right]:sm:max-w-none data-[side=right]:sm:border-l"
				side="right"
			>
				<SheetHeader className="border-b pr-16">
					<SheetTitle>Trazabilidad normativa</SheetTitle>
					<SheetDescription>
						Origen de Aa y Av usados por el cálculo actual, con evidencia en la norma.
					</SheetDescription>
				</SheetHeader>
				{open && (
					<TraceabilityDetails
						key={municipalityCode}
						municipalityCode={municipalityCode}
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}
