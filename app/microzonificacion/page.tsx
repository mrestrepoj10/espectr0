import { MapPinned } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConstructionState } from "@/components/construction-state";

export default function MicrozonificacionPage() {
	return (
		<AppShell>
			<ConstructionState
				description="Este módulo queda reservado exclusivamente para la futura incorporación del estudio SGC Amenaza Sísmica 2018."
				icon={MapPinned}
				title="SGC Amenaza Sísmica 2018 · próximamente"
			/>
		</AppShell>
	);
}
