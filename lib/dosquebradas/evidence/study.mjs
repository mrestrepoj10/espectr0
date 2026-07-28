import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkEvidenceStudy } from "../../regulatory/runtime.mjs";

export const studyId = "dosquebradas-microzonation";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const repositoryRoot = resolve(root, "../..");
const run = promisify(execFile);
const load = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const manifest = await load("evidence/manifest.json");
const invariant = (condition, message) => { if (!condition) throw new Error(`Dosquebradas evidence invariant failed: ${message}`); };

export async function check({ repositoryRoot: requestedRoot }) {
  invariant(resolve(requestedRoot) === repositoryRoot, "repository root mismatch");
  await run(process.execPath, [resolve(here, "generate.mjs"), "--check"], { cwd: requestedRoot });
  await run("python", [resolve(root, "oracle/generate_oracle.py"), "--check"], { cwd: requestedRoot });
  const [canonical, attestation, formulas, claims, locks, review, oracle] = await Promise.all(["data/canonical.json", "evidence/extraction-attestation.json", "evidence/formula-inventory.json", "evidence/claims-matrix.json", "evidence/source-locks.json", "evidence/review-record.json", "oracle/oracle.json"].map(load));
  invariant(canonical.status === "research-only-activation-blocked" && !canonical.capabilities.municipalSpectrumCalculation, "municipal calculation became active");
  invariant(canonical.rows.length === 5 && manifest.values.length === 30, "5×1×6 table coverage changed");
  invariant(attestation.coverage.directCells === 30 && attestation.coverage.percent === 100, "attestation coverage changed");
  invariant(claims.directMatrix.exactCoveredFieldValues === 30 && claims.directMatrix.coveragePercent === 100, "claim coverage changed");
  invariant(formulas.status === "unavailable-blocks-activation" && formulas.proposedProductionFormulas.length === 0, "unsupported formula introduced");
  invariant(locks.locks.length === 3 && manifest.sources.every((source) => source.redistribution.decision === "external-only"), "source locks/redistribution changed");
  invariant(review.independentReview.status === "pending" && review.activationDecision.startsWith("blocked"), "review gate changed");
  invariant(oracle.status === "table-transcription-verified-calculation-blocked" && oracle.records.length === 5 && oracle.negativeCases.every(({ outcome }) => outcome === "reject"), "oracle permits unsupported calculation");
  const canonicalByOption = new Map(canonical.rows.map((row) => [row.optionId, row.fields]));
  for (const record of oracle.records) invariant(JSON.stringify(record.fields) === JSON.stringify(canonicalByOption.get(record.optionId)), `independent oracle differs for ${record.optionId}`);
  return checkEvidenceStudy(manifest, { repositoryRoot: requestedRoot });
}
