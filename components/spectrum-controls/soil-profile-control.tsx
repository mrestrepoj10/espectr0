"use client";

import {
	FieldDescription,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import type { SoilProfile } from "@/lib/nsr10";
import { cn } from "@/lib/utils";

import { soilDescriptions, soilProfiles } from "./constants";
import { ToggleControl } from "./toggle-control";

export function SoilProfileControl({
	className,
	value,
	onValueChange,
}: {
	className?: string;
	value: SoilProfile;
	onValueChange: (value: SoilProfile) => void;
}) {
	return (
		<FieldSet className={cn("gap-2", className)}>
			<FieldLegend variant="label">Perfil de suelo</FieldLegend>
			<ToggleControl
				ariaLabel="Perfil de suelo"
				onValueChange={onValueChange}
				options={soilProfiles}
				value={value}
			/>
			<FieldDescription>
				{value} — {soilDescriptions[value]}
			</FieldDescription>
		</FieldSet>
	);
}
