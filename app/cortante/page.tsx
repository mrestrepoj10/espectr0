import { ChartNoAxesColumnIncreasing } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConstructionState } from "@/components/construction-state";

export default function CortantePage() {
	return (
		<AppShell>
			<ConstructionState
				description="Este módulo permitirá estimar y documentar el cortante sísmico basal del proyecto según la NSR-10."
				icon={ChartNoAxesColumnIncreasing}
				title="Cortante basal"
			/>
		</AppShell>
	);
}
