import { MapPinned } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConstructionState } from "@/components/construction-state";

export default function MicrozonificacionPage() {
	return (
		<AppShell>
			<ConstructionState
				description="Este módulo incorporará los parámetros definidos por los estudios de microzonificación sísmica disponibles para el proyecto."
				icon={MapPinned}
				title="Microzonificación"
			/>
		</AppShell>
	);
}
