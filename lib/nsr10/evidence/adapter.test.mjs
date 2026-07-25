import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { adaptNsr10EvidenceReport } from "./adapter.mjs";

const manifest = JSON.parse(readFileSync("lib/nsr10/evidence/manifest.json", "utf8"));
const overrides = JSON.parse(
	readFileSync("scripts/nsr10-evidence-overrides.json", "utf8"),
);
const pdfSize = readFileSync("public/nsr10-titulo-a-2017.pdf").byteLength;
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
		expect(adaptNsr10EvidenceReport(report, manifest, overrides, pdfSize)).toMatchObject({
			schemaVersion: 1,
			studyId: "nsr10",
			rawRows: { count: 1_124, ids: expect.any(Array) },
			canonicalRows: { count: 1_123, ids: expect.any(Array) },
			duplicates: [
				{
					rowKey: "11001/nsr10-seismic",
					rawRowIds: ["11001@181", "11001@183"],
					overrideId: "legacy-11001",
				},
			],
			overrides: [
				{
					id: "legacy-11001",
					selectedRawRowId: "11001@183",
					reviewStatus: "legacy-pending",
				},
			],
			citations: { row: 1_123, cell: 4_492, clause: 8 },
			uncoveredValues: [],
			hashes: { pdf: manifest.source.pdfSha256 },
			sourceLocks: [
				{
					id: "nsr10-title-a",
					sha256: manifest.source.pdfSha256,
					pageCount: 206,
				},
			],
			coverage: { expectedRows: 1_123, expectedValues: 4_492, bundledSources: 1 },
		});
	});

	it.each([
		["raw rows", { rawRows: 1_123 }, /raw row coverage changed/],
		["canonical rows", { uniqueCodes: 1_122 }, /canonical row coverage changed/],
		["normative citations", { normativeCitations: 7 }, /normative citation coverage changed/],
	])("fails closed if %s drift", (_label, drift, error) => {
		expect(() =>
			adaptNsr10EvidenceReport({ ...report, ...drift }, manifest, overrides, pdfSize),
		).toThrow(error);
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
		const aggregate = JSON.parse(first);
		expect(aggregate.schemaVersion).toBe(1);
		expect(aggregate.installedStudies).toEqual(
			expect.arrayContaining(["bogota-microzonation", "framework-fixture", "nsr10"]),
		);
		expect(aggregate.installedStudies).toEqual([...aggregate.installedStudies].sort());
		expect(new Set(aggregate.installedStudies).size).toBe(aggregate.installedStudies.length);
		expect(aggregate.studies.find(({ studyId }) => studyId === "framework-fixture")).toMatchObject({
			studyId: "framework-fixture",
			coverage: { expectedRows: 1 },
		});
		expect(aggregate.studies.find(({ studyId }) => studyId === "nsr10")).toMatchObject({
			studyId: "nsr10",
			rawRows: { count: 1_124 },
			canonicalRows: { count: 1_123 },
			citations: { cell: 4_492, clause: 8 },
			uncoveredValues: [],
		});
		expect(aggregate.studies.find(({ studyId }) => studyId === "bogota-microzonation")).toMatchObject({
			studyId: "bogota-microzonation",
			coverage: { expectedRows: 48, expectedValues: 288 },
			uncoveredValues: [],
		});
	}, 30_000);
});
