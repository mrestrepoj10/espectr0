import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const manifestPath = resolve(import.meta.dirname, "artifact-locks.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

for (const artifact of manifest.artifacts) {
	const bytes = await readFile(resolve(repositoryRoot, artifact.path));
	const hash = createHash("sha256").update(bytes).digest("hex");
	if (bytes.byteLength !== artifact.bytes || hash !== artifact.sha256) {
		throw new Error(`Artifact lock mismatch: ${artifact.path}`);
	}
}

console.log(`CCP-14 artifact locks: PASS (${manifest.artifacts.length} files)`);
