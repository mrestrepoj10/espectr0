"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export function ToggleControl<T extends string>({
	ariaLabel,
	className,
	options,
	value,
	onValueChange,
}: {
	ariaLabel: string;
	className?: string;
	options: readonly T[];
	value: T;
	onValueChange: (value: T) => void;
}) {
	return (
		<ToggleGroup
			aria-label={ariaLabel}
			className={cn("w-full flex-wrap", className)}
			onValueChange={(values) => {
				const nextValue = values[0] as T | undefined;
				if (nextValue) onValueChange(nextValue);
			}}
			size="default"
			value={[value]}
			variant="contrast"
		>
			{options.map((option) => (
				<ToggleGroupItem className="min-w-10 flex-1" key={option} value={option}>
					{option}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
