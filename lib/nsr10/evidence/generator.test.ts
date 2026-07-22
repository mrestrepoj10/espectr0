import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import oracleInputData from "../data/oracle-input.json";

describe("NSR-10 evidence generator", () => {
	it("reproduces the checked-in outputs and accounts for every source row", () => {
		const report = JSON.parse(
			execFileSync(
				process.execPath,
				[
					resolve("scripts/generate-nsr10-evidence.mjs"),
					"--check",
					"--report-json",
				],
				{ cwd: process.cwd(), encoding: "utf8" },
			),
		);

		expect(report).toMatchObject({
			rawRows: 1_124,
			uniqueCodes: 1_123,
			duplicateCodes: ["11001"],
			geometryRowsValidated: 1_124,
			normativeCitations: 8,
			oracleCases: 12,
			sourceHashes: {
				pdf: "47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0",
			},
			sourcePageCounts: { pdf: 206 },
			historicalAaAvProjectionSha256:
				"34a9b7e54703037884eb44baf36c4626891b50f80ea9a50bce6b2e95fc331f14",
		});
		expect(report.artifactSizes.manifest).toBeLessThan(42_000);
	}, 15_000);

	it.each([
		["path", { pdf_path: "public/not-the-pinned-source.pdf" }, /Oracle PDF path changed/],
		["SHA-256", { pdf_sha256: "0".repeat(64) }, /Oracle PDF SHA-256 changed/],
		["page count", { pdf_page_count: 205 }, /Oracle PDF page count changed/],
	] as const)("fails closed when the oracle PDF %s drifts", (_, sourceDrift, error) => {
		const directory = mkdtempSync(resolve(tmpdir(), "espectr0-oracle-lock-"));
		const inputFile = resolve(directory, "oracle-input.json");
		const drifted = {
			...oracleInputData,
			source: { ...oracleInputData.source, ...sourceDrift },
		};
		writeFileSync(inputFile, `${JSON.stringify(drifted, null, 2)}\n`, "utf8");

		try {
			expect(() =>
				execFileSync(
					process.execPath,
					[
						resolve("scripts/generate-nsr10-evidence.mjs"),
						"--check",
						`--oracle-input=${inputFile}`,
					],
					{ cwd: process.cwd(), encoding: "utf8", stdio: "pipe" },
				),
			).toThrow(error);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	}, 30_000);
});
