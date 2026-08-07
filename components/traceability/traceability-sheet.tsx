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
import type { ReactNode } from "react";
import type {
	NormalizedSpectrumResultData,
	ScenarioEvidenceKey,
} from "@/lib/spectra";

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

/**
 * The single traceability surface. `result` is optional so the drawer can open
 * on a selection that has not been calculated yet, showing whatever source
 * evidence already exists for it.
 */
export function TraceabilitySheet({
	result,
	scenarioEvidenceKey,
	sourceEvidence,
	open,
	onOpenChange,
}: {
	result?: NormalizedSpectrumResultData | null;
	scenarioEvidenceKey?: ScenarioEvidenceKey | null;
	sourceEvidence?: ReactNode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent
				className="h-dvh overflow-hidden border-0 data-[side=right]:w-screen data-[side=right]:max-w-none data-[side=right]:sm:w-[68vw] data-[side=right]:sm:min-w-[44rem] data-[side=right]:sm:max-w-none data-[side=right]:sm:border-l data-[side=right]:xl:w-[62vw]"
				side="right"
			>
				<SheetHeader className="border-b pr-16">
					<SheetTitle>Trazabilidad normativa</SheetTitle>
					<SheetDescription>
						{result
							? "Fuentes, regiones y linaje del resultado normalizado activo."
							: "Fuentes y regiones de la selección actual; el linaje aparece al calcular."}
					</SheetDescription>
				</SheetHeader>
				{open ? (
					<div className="min-h-0 flex-1 overflow-y-auto">
						{sourceEvidence ? (
							<div className="flex flex-col gap-4 p-4 sm:p-6">{sourceEvidence}</div>
						) : null}
						{result && scenarioEvidenceKey ? (
							<TraceabilityDetails
								key={Object.values(scenarioEvidenceKey).join(":")}
								result={result}
								scenarioEvidenceKey={scenarioEvidenceKey}
							/>
						) : null}
					</div>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
