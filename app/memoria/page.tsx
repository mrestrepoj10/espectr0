import { FileText } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConstructionState } from "@/components/construction-state";

export default function MemoriaPage() {
	return (
		<AppShell>
			<ConstructionState
				description="Este módulo reunirá los parámetros y resultados del proyecto en una memoria de cálculo lista para exportar en formato PDF."
				icon={FileText}
				title="Memoria PDF"
			/>
		</AppShell>
	);
}
