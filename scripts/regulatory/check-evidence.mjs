import { access, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
	aggregateEvidenceReportSchema,
	deterministicJson,
	runInstalledDescriptors,
} from "../../lib/regulatory/runtime.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const libraryDirectory = resolve(repositoryRoot, "lib");
const entries = (await readdir(libraryDirectory, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.sort((left, right) => left.name.localeCompare(right.name));
const discovered = [];

for (const entry of entries) {
	const descriptorPath = resolve(libraryDirectory, entry.name, "evidence/study.mjs");
	try {
		await access(descriptorPath);
	} catch (error) {
		if (error?.code === "ENOENT") continue;
		throw error;
	}
	const descriptorModule = await import(pathToFileURL(descriptorPath).href);
	discovered.push({ studyId: descriptorModule.studyId, check: descriptorModule.check });
}

if (discovered.length === 0) throw new Error("No regulatory evidence studies installed");
const { descriptors, reports: studies } = await runInstalledDescriptors(discovered, {
	repositoryRoot,
});

const report = aggregateEvidenceReportSchema.parse({
	schemaVersion: 1,
	installedStudies: descriptors.map(({ studyId }) => studyId),
	studies,
});

if (process.argv.includes("--report-json")) {
	process.stdout.write(deterministicJson(report));
} else {
	process.stdout.write(
		`Verified ${descriptors.length} installed regulatory evidence studies: ${descriptors
			.map(({ studyId }) => studyId)
			.join(", ")}\n`,
	);
}
