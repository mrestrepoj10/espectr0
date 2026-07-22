import { access, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function canonicalize(value) {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
				.map(([key, nested]) => [key, canonicalize(nested)]),
		);
	}
	return value;
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const libraryDirectory = resolve(repositoryRoot, "lib");
const entries = (await readdir(libraryDirectory, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.sort((left, right) => left.name.localeCompare(right.name));
const descriptors = [];

for (const entry of entries) {
	const descriptorPath = resolve(libraryDirectory, entry.name, "evidence/study.mjs");
	try {
		await access(descriptorPath);
	} catch (error) {
		if (error?.code === "ENOENT") continue;
		throw error;
	}
	const descriptor = await import(pathToFileURL(descriptorPath).href);
	if (typeof descriptor.studyId !== "string" || typeof descriptor.check !== "function") {
		throw new Error(`${descriptorPath} must export studyId and check()`);
	}
	descriptors.push(descriptor);
}

if (descriptors.length === 0) throw new Error("No regulatory evidence studies installed");
const duplicateStudyIds = descriptors
	.map(({ studyId }) => studyId)
	.filter((studyId, index, ids) => ids.indexOf(studyId) !== index);
if (duplicateStudyIds.length > 0) {
	throw new Error(`Duplicate installed study IDs: ${duplicateStudyIds.join(", ")}`);
}

const studies = [];
for (const descriptor of descriptors.sort((left, right) =>
	left.studyId.localeCompare(right.studyId),
)) {
	studies.push(await descriptor.check({ repositoryRoot }));
}

const report = canonicalize({
	schemaVersion: 1,
	installedStudies: descriptors.map(({ studyId }) => studyId).sort(),
	studies,
});

if (process.argv.includes("--report-json")) {
	process.stdout.write(`${JSON.stringify(report)}\n`);
} else {
	process.stdout.write(
		`Verified ${descriptors.length} installed regulatory evidence study: ${descriptors
			.map(({ studyId }) => studyId)
			.join(", ")}\n`,
	);
}
