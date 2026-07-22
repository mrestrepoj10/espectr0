"use client";

import {
	FieldDescription,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";

import type { HazardLevel, ImportanceGroup } from "@/lib/nsr10";
import { cn } from "@/lib/utils";

import { getImportanceDescription, importanceGroups } from "./constants";
import { ToggleControl } from "./toggle-control";

export function ImportanceGroupControl({
	className,
	hazardLevel,
	value,
	onValueChange,
}: {
	className?: string;
	hazardLevel: HazardLevel;
	value: ImportanceGroup;
	onValueChange: (value: ImportanceGroup) => void;
}) {
	return (
		<FieldSet className={cn("gap-2", className)}>
			<FieldLegend variant="label">Grupo de uso</FieldLegend>
			<ToggleControl
				ariaLabel="Grupo de uso"
				onValueChange={onValueChange}
				options={importanceGroups}
				value={value}
			/>
			<FieldDescription>
				{getImportanceDescription(value, hazardLevel)}
			</FieldDescription>
		</FieldSet>
	);
}
