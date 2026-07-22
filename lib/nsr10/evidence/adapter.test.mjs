import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { adaptNsr10EvidenceReport } from "./adapter.mjs";

const manifest = JSON.parse(readFileSync("lib/nsr10/evidence/manifest.json", "utf8"));
const overrides = JSON.parse(
	readFileSync("scripts/nsr10-evidence-overrides.json", "utf8"),
);
const report = {
	rawRows: 1_124,
	uniqueCodes: 1_123,
	duplicateCodes: ["11001"],
	geometryRowsValidated: 1_124,
	normativeCitations: 8,
	sourceHashes: { pdf: manifest.source.pdfSha256 },
	sourcePageCounts: { pdf: 206 },
	historicalAaAvProjectionSha256:
		"34a9b7e54703037884eb44baf36c4626891b50f80ea9a50bce6b2e95fc331f14",
	oracleCases: 12,
	artifactSizes: { manifest: 40_000, municipalities: 200_000, oracle: 10_000 },
};

describe("NSR-10 generic evidence adapter", () => {
	it("preserves legacy row, field, clause, override, and source-lock coverage", () => {
		expect(adaptNsr10EvidenceReport(report, manifest, overrides)).toMatchObject({
			studyId: "nsr10",
			rawRows: { count: 1_124 },
			canonicalRows: { count: 1_123 },
			duplicates: ["11001"],
			overrides: overrides.sourceDuplicates,
			citations: { row: 1_123, cell: 4_492, clause: 8 },
			uncoveredValues: [],
			hashes: { pdf: manifest.source.pdfSha256 },
		});
	});

	it.each([
		["raw rows", { rawRows: 1_123 }, /raw row coverage changed/],
		["canonical rows", { uniqueCodes: 1_122 }, /canonical row coverage changed/],
		["normative citations", { normativeCitations: 7 }, /normative citation coverage changed/],
	])("fails closed if %s drift", (_label, drift, error) => {
		expect(() => adaptNsr10EvidenceReport({ ...report, ...drift }, manifest, overrides)).toThrow(
			error,
		);
	});

	it("is installed by convention and emits byte-identical LF reports", () => {
		const command = [
			resolve("scripts/regulatory/check-evidence.mjs"),
			"--check",
			"--report-json",
		];
		const first = execFileSync(process.execPath, command, { encoding: "utf8" });
		const second = execFileSync(process.execPath, command, { encoding: "utf8" });
		expect(second).toBe(first);
		expect(first.endsWith("\n")).toBe(true);
		expect(JSON.parse(first)).toMatchObject({
			schemaVersion: 1,
			installedStudies: ["nsr10"],
			studies: [
				{
					studyId: "nsr10",
					rawRows: { count: 1_124 },
					canonicalRows: { count: 1_123 },
					citations: { cell: 4_492, clause: 8 },
					uncoveredValues: [],
				},
			],
		});
	}, 30_000);
});
