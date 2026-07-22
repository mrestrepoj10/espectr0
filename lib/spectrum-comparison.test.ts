import { describe, expect, it } from "vitest";

import { lookupMunicipio } from "./nsr10";
import {
	buildComparisonChartData,
	comparisonJson,
	computeComparisonScenarios,
	formatComparisonCsv,
} from "./spectrum-comparison";

const cali = lookupMunicipio("Cali", "Valle del Cauca")[0];

if (!cali) throw new Error("Cali must exist in the municipality dataset");

const scenarios = [
	{
		id: "cali-c",
		municipio: cali,
		soilProfile: "C" as const,
		importanceGroup: "I" as const,
		hazardLevel: "design" as const,
	},
	{
		id: "cali-f",
		municipio: cali,
		soilProfile: "F" as const,
		importanceGroup: "III" as const,
		hazardLevel: "damage-threshold" as const,
	},
];

describe("spectrum comparison helpers", () => {
	it("computes each scenario with the engine and preserves soil-F results", () => {
		const computed = computeComparisonScenarios(scenarios);

		expect(computed[0]?.result.status).toBe("ok");
		expect(computed[1]?.result).toMatchObject({
			status: "site-specific-study-required",
			soilProfile: "F",
			hazardLevel: "damage-threshold",
		});
	});

	it("aligns successful engine ordinates and excludes soil F from the chart", () => {
		const computed = computeComparisonScenarios(scenarios);
		const data = buildComparisonChartData(computed);

		expect(data.length).toBeGreaterThan(100);
		expect(data[0]).toMatchObject({ t: 0 });
		expect(data.every((row) => Number.isFinite(row["scenario_cali-c"]))).toBe(true);
		expect(data.every((row) => !("scenario_cali-f" in row))).toBe(true);
	});

	it("formats wide CSV and serializable JSON for all scenario outcomes", () => {
		const computed = computeComparisonScenarios(scenarios);
		const data = buildComparisonChartData(computed);
		const csv = formatComparisonCsv(computed, data);
		const json = comparisonJson(computed);

		expect(csv.split("\n")[0]).toContain("Cali · Suelo C");
		expect(csv).not.toContain("Suelo F");
		expect(JSON.parse(JSON.stringify(json))).toMatchObject({
			schemaVersion: 1,
			scenarios: [
				{ id: "cali-c", result: { status: "ok" } },
				{
					id: "cali-f",
					result: { status: "site-specific-study-required" },
				},
			],
		});
	});
});
