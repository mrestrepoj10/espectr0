import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
			pdfSha256:
				"47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0",
		});
		expect(report.manifestBytes).toBeLessThan(42_000);
	}, 15_000);
});
