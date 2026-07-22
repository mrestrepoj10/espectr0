import {
	computeSpectrum,
	hazardLevelDetails,
	saAt,
} from "./nsr10";

import type {
	HazardLevel,
	ImportanceGroup,
	Municipio,
	SoilProfile,
	SpectrumParams,
	SpectrumResult,
} from "./nsr10";

export const MAX_COMPARISON_SCENARIOS = 6;

export type ComparisonScenario = {
	id: string;
	municipio: Municipio;
	soilProfile: SoilProfile;
	importanceGroup: ImportanceGroup;
	hazardLevel: HazardLevel;
};

export type ComputedComparisonScenario = ComparisonScenario & {
	label: string;
	seriesKey: string;
	params: SpectrumParams;
	result: SpectrumResult;
};

export type ComparisonChartRow = { t: number } & Record<string, number>;

export function comparisonScenarioLabel(scenario: ComparisonScenario) {
	return `${scenario.municipio.municipio}, ${scenario.municipio.departamento} · Suelo ${scenario.soilProfile} · Grupo ${scenario.importanceGroup} · ${hazardLevelDetails[scenario.hazardLevel].label}`;
}

export function comparisonSeriesKey(id: string) {
	return `scenario_${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function comparisonSpectrumParams(
	scenario: ComparisonScenario,
): SpectrumParams {
	return {
		aa: scenario.municipio.aa,
		av: scenario.municipio.av,
		ae: scenario.municipio.ae,
		ad: scenario.municipio.ad,
		hazardLevel: scenario.hazardLevel,
		soilProfile: scenario.soilProfile,
		importanceGroup: scenario.importanceGroup,
		mode: "general",
	};
}

export function computeComparisonScenarios(
	scenarios: readonly ComparisonScenario[],
): ComputedComparisonScenario[] {
	return scenarios.map((scenario) => {
		const params = comparisonSpectrumParams(scenario);
		return {
			...scenario,
			label: comparisonScenarioLabel(scenario),
			seriesKey: comparisonSeriesKey(scenario.id),
			params,
			result: computeSpectrum(params),
		};
	});
}

/**
 * Aligns engine points on one period axis. Missing ordinates are evaluated with
 * `saAt`, so comparison rendering never duplicates the NSR-10 equations.
 */
export function buildComparisonChartData(
	scenarios: readonly ComputedComparisonScenario[],
): ComparisonChartRow[] {
	const successful = scenarios.filter(
		(scenario) => scenario.result.status === "ok",
	);
	const periods = new Set<number>();

	for (const scenario of successful) {
		if (scenario.result.status !== "ok") continue;
		for (const point of scenario.result.points) periods.add(point.t);
	}

	return [...periods]
		.sort((left, right) => left - right)
		.map((t) => {
			const row: ComparisonChartRow = { t };
			for (const scenario of successful) {
				const ordinate = saAt(t, scenario.params);
				if (ordinate.status === "ok") row[scenario.seriesKey] = ordinate.sa;
			}
			return row;
		});
}

function csvCell(value: string) {
	return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function formatComparisonCsv(
	scenarios: readonly ComputedComparisonScenario[],
	chartData: readonly ComparisonChartRow[],
) {
	const successful = scenarios.filter(
		(scenario) => scenario.result.status === "ok",
	);
	const header = ["T (s)", ...successful.map(({ label }) => `${label} · Sa (g)`)]
		.map(csvCell)
		.join(",");
	const rows = chartData.map((row) =>
		[
			String(row.t),
			...successful.map(({ seriesKey }) => String(row[seriesKey] ?? "")),
		].join(","),
	);

	return [header, ...rows].join("\n");
}

export function comparisonJson(
	scenarios: readonly ComputedComparisonScenario[],
) {
	return {
		schemaVersion: 1,
		generatedBy: "espectr0-comparador",
		scenarios: scenarios.map(
			({ id, label, municipio, soilProfile, importanceGroup, hazardLevel, result }) => ({
				id,
				label,
				inputs: {
					municipio,
					soilProfile,
					importanceGroup,
					hazardLevel,
				},
				result,
			}),
		),
	};
}
