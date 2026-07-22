import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { adaptNsr10EvidenceReport } from "./adapter.mjs";

export const studyId = "nsr10";

export async function check({ repositoryRoot }) {
	const stdout = execFileSync(
		process.execPath,
		[
			resolve(repositoryRoot, "scripts/generate-nsr10-evidence.mjs"),
			"--check",
			"--report-json",
		],
		{ cwd: repositoryRoot, encoding: "utf8" },
	);
	const [manifest, overrides, pdfBytes] = await Promise.all([
		readFile(resolve(repositoryRoot, "lib/nsr10/evidence/manifest.json"), "utf8"),
		readFile(resolve(repositoryRoot, "scripts/nsr10-evidence-overrides.json"), "utf8"),
		readFile(resolve(repositoryRoot, "public/nsr10-titulo-a-2017.pdf")),
	]);
	return adaptNsr10EvidenceReport(
		JSON.parse(stdout),
		JSON.parse(manifest),
		JSON.parse(overrides),
		pdfBytes.byteLength,
	);
}
