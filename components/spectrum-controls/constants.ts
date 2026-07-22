import {
	lookupMunicipio,
	normalizeSearchText,
} from "@/lib/nsr10";

import type {
	HazardLevel,
	ImportanceGroup,
	Municipio,
	SoilProfile,
} from "@/lib/nsr10";

export const hazardLevels = [
	{ label: "Diseño · TR 475 años", value: "design" },
	{
		label: "Seguridad limitada · TR 225 años",
		value: "limited-safety",
	},
	{
		label: "Umbral de daño · TR 31 años",
		value: "damage-threshold",
	},
] as const satisfies ReadonlyArray<{ label: string; value: HazardLevel }>;

export const soilProfiles = ["A", "B", "C", "D", "E", "F"] as const;
export const importanceGroups = ["I", "II", "III", "IV"] as const;

export const soilDescriptions: Record<SoilProfile, string> = {
	A: "Roca competente",
	B: "Roca de rigidez media",
	C: "Suelo muy denso o roca blanda",
	D: "Suelo rígido",
	E: "Suelo blando",
	F: "Requiere estudio específico",
};

export const importanceDescriptions: Record<ImportanceGroup, string> = {
	I: "Ocupación normal",
	II: "Ocupación especial",
	III: "Atención a la comunidad",
	IV: "Edificación indispensable",
};

export const importanceValues: Record<ImportanceGroup, string> = {
	I: "1.00",
	II: "1.10",
	III: "1.25",
	IV: "1.50",
};

export const defaultMunicipio = lookupMunicipio("Cali", "Valle del Cauca")[0];

if (!defaultMunicipio) {
	throw new Error("El conjunto NSR-10 no contiene el municipio predeterminado de Cali");
}

export function municipioLabel(municipio: Municipio) {
	return `${municipio.municipio}, ${municipio.departamento}`;
}

export function municipioMatches(municipio: Municipio, query: string) {
	const normalizedQuery = normalizeSearchText(query);
	if (!normalizedQuery) return true;

	return normalizeSearchText(municipioLabel(municipio)).includes(normalizedQuery);
}

export function getMunicipalityCoefficients(
	municipio: Municipio,
	hazardLevel: HazardLevel,
) {
	if (hazardLevel === "design") {
		return `Aa ${municipio.aa.toFixed(2)} · Av ${municipio.av.toFixed(2)}`;
	}

	return hazardLevel === "limited-safety"
		? `Ae ${municipio.ae.toFixed(2)}`
		: `Ad ${municipio.ad.toFixed(2)}`;
}

export function getImportanceDescription(
	importanceGroup: ImportanceGroup,
	hazardLevel: HazardLevel,
) {
	const description = importanceDescriptions[importanceGroup];

	return hazardLevel === "damage-threshold"
		? `${importanceGroup} — ${description} · I no modifica A.12.3`
		: `${importanceGroup} — ${description} · I = ${importanceValues[importanceGroup]}`;
}

export function getHazardNotice(
	hazardLevel: HazardLevel,
	importanceGroup: ImportanceGroup,
) {
	if (hazardLevel === "limited-safety") {
		return "Uso restringido a las edificaciones existentes permitidas por A.10.9.";
	}

	if (hazardLevel === "damage-threshold") {
		return importanceGroup === "III" || importanceGroup === "IV"
			? "Verificación especial de operatividad para las edificaciones cubiertas por A.12."
			: "A.12 aplica a las edificaciones cubiertas de los grupos III y IV; revisa el grupo de uso.";
	}

	return "Movimientos sísmicos de diseño para edificaciones nuevas y existentes.";
}
