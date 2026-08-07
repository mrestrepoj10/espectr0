"use client";

import dynamic from "next/dynamic";
import { ListTreeIcon, MapIcon } from "lucide-react";
import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
		<div aria-live="polite" role="status">
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

type EvidencePanel = "fuente" | "linaje";

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
	const details =
		result && scenarioEvidenceKey ? (
			<TraceabilityDetails
				key={Object.values(scenarioEvidenceKey).join(":")}
				result={result}
				scenarioEvidenceKey={scenarioEvidenceKey}
			/>
		) : null;
	/**
	 * Stacking the map cut on top of the lineage made one scrollport six screens
	 * deep, so the two are separate panels the reader switches between. With only
	 * one of them present there is nothing to switch and the panel stands alone.
	 */
	const [panel, setPanel] = useState<EvidencePanel>("fuente");
	const activePanel = !sourceEvidence ? "linaje" : !details ? "fuente" : panel;

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent
				className="h-dvh overflow-hidden border-0 data-[side=right]:w-screen data-[side=right]:max-w-none data-[side=right]:sm:w-[68vw] data-[side=right]:sm:min-w-[44rem] data-[side=right]:sm:max-w-none data-[side=right]:sm:border-l data-[side=right]:xl:w-[62vw]"
				side="right"
			>
				<SheetHeader className="gap-3 border-b pr-16">
					<div className="flex flex-col gap-1">
						<SheetTitle>Trazabilidad normativa</SheetTitle>
						<SheetDescription>
							{result
								? "Fuentes, regiones y linaje del resultado normalizado activo."
								: "Fuentes y regiones de la selección actual; el linaje aparece al calcular."}
						</SheetDescription>
					</div>
					{sourceEvidence && details ? (
						<ToggleGroup
							aria-label="Sección de evidencia"
							className="w-full max-w-md"
							onValueChange={(values) => {
								const next = values[0] as EvidencePanel | undefined;
								if (next) setPanel(next);
							}}
							size="default"
							value={[activePanel]}
							variant="contrast"
						>
							<ToggleGroupItem className="flex-1" value="fuente">
								<MapIcon data-icon="inline-start" />
								Evidencia de la fuente
							</ToggleGroupItem>
							<ToggleGroupItem className="flex-1" value="linaje">
								<ListTreeIcon data-icon="inline-start" />
								Linaje del resultado
							</ToggleGroupItem>
						</ToggleGroup>
					) : null}
				</SheetHeader>
				{open ? (
					<div
						className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
						key={activePanel}
					>
						{activePanel === "fuente" && sourceEvidence ? (
							<div className="flex flex-col gap-4 p-4 sm:p-6">{sourceEvidence}</div>
						) : null}
						{activePanel === "linaje" ? details : null}
					</div>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
