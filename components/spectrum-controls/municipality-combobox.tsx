"use client";

import { DicesIcon } from "lucide-react";

import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import {
	InputGroupAddon,
	InputGroupButton,
} from "@/components/ui/input-group";
import { municipios } from "@/lib/nsr10";
import { cn } from "@/lib/utils";

import type { Municipio } from "@/lib/nsr10";

import { municipioLabel, municipioMatches } from "./constants";

export function MunicipalityCombobox({
	className,
	value,
	onValueChange,
}: {
	className?: string;
	value: Municipio;
	onValueChange: (municipio: Municipio) => void;
}) {
	return (
		<Combobox
			autoHighlight
			filter={municipioMatches}
			isItemEqualToValue={(item, selected) =>
				item.departamento === selected.departamento &&
				item.municipio === selected.municipio
			}
			items={municipios}
			itemToStringLabel={municipioLabel}
			itemToStringValue={municipioLabel}
			onValueChange={(municipio) => {
				if (municipio) onValueChange(municipio);
			}}
			value={value}
		>
			<ComboboxInput
				aria-label="Buscar municipio"
				className={cn(
					"h-11 w-full sm:h-10",
					className,
				)}
				placeholder="Buscar municipio…"
			>
				<InputGroupAddon align="inline-end" className="py-0 pr-2">
					<InputGroupButton
						aria-label="Elegir municipio al azar"
						className="size-11 rounded-lg sm:size-10"
						onClick={() => {
							const randomMunicipio =
								municipios[Math.floor(Math.random() * municipios.length)];
							if (randomMunicipio) onValueChange(randomMunicipio);
						}}
						size="icon-xs"
						title="Elegir municipio al azar"
						variant="ghost"
					>
						<DicesIcon />
					</InputGroupButton>
				</InputGroupAddon>
			</ComboboxInput>
			<ComboboxContent>
				<ComboboxEmpty>No se encontraron municipios.</ComboboxEmpty>
				<ComboboxList>
					{(municipio: Municipio) => (
						<ComboboxItem
							key={`${municipio.departamento}-${municipio.municipio}`}
							value={municipio}
						>
							<span className="flex min-w-0 flex-col">
								<span className="truncate">{municipio.municipio}</span>
								<span className="truncate font-normal text-muted-foreground text-xs">
									{municipio.departamento} · Aa {municipio.aa.toFixed(2)} · Av{" "}
									{municipio.av.toFixed(2)}
								</span>
							</span>
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
