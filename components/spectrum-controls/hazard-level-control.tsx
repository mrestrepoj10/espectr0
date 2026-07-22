"use client";

import {
	Field,
	FieldTitle,
} from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

import type { HazardLevel } from "@/lib/nsr10";

import { hazardLevels } from "./constants";

export function HazardLevelControl({
	className,
	value,
	onValueChange,
}: {
	className?: string;
	value: HazardLevel;
	onValueChange: (value: HazardLevel) => void;
}) {
	return (
		<Field className={className}>
			<FieldTitle>Nivel de amenaza</FieldTitle>
			<Select
				items={hazardLevels}
				onValueChange={(nextValue) => {
					if (nextValue) onValueChange(nextValue as HazardLevel);
				}}
				value={value}
			>
				<SelectTrigger
					className="h-11 w-full sm:h-10"
					aria-label="Nivel de amenaza"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>Periodo de retorno</SelectLabel>
						{hazardLevels.map((level) => (
							<SelectItem key={level.value} value={level.value}>
								{level.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
