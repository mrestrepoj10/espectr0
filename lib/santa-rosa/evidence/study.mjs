import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkEvidenceStudy } from "../../regulatory/runtime.mjs";
export const studyId = "santa-rosa-de-cabal-microzonation";
const here = dirname(fileURLToPath(import.meta.url)); const root = resolve(here, ".."); const repositoryRoot = resolve(root, "../.."); const run = promisify(execFile); const load = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8")); const manifest = await load("evidence/manifest.json"); const invariant = (condition, message) => { if (!condition) throw new Error(`Santa Rosa evidence invariant failed: ${message}`); };
export async function check({ repositoryRoot: requestedRoot }) {
  invariant(resolve(requestedRoot) === repositoryRoot, "repository root mismatch"); await run(process.execPath, [resolve(here, "generate.mjs"), "--check"], { cwd: requestedRoot }); await run("python", [resolve(root, "oracle/generate_oracle.py"), "--check"], { cwd: requestedRoot });
  const [canonical, claims, formulas, attestation, review, oracle] = await Promise.all(["data/canonical.json", "evidence/claims-matrix.json", "evidence/formula-inventory.json", "evidence/extraction-attestation.json", "evidence/review-record.json", "oracle/oracle.json"].map(load));
  invariant(canonical.proposedSpectrumMatrix.rows.length === 0 && canonical.documentedDesignZones.length === 5 && canonical.documentedDesignZones[2].subareas.join(",") === "3A,3B" && !canonical.capabilities.municipalSpectrumCalculation, "unsupported spectrum became active or zone structure changed"); invariant(manifest.values.length === 1 && claims.regulatoryStatusMatrix.coveragePercent === 100, "regulatory coverage changed"); invariant(attestation.coverage.percent === 100 && attestation.coverage.proposedSpectrumValues === 0, "attestation coverage changed"); invariant(formulas.status === "unavailable-blocks-activation" && formulas.proposedProductionFormulas.length === 0, "unsupported formula introduced"); invariant(review.independentReview.status === "pending" && review.activationDecision.startsWith("blocked"), "review gate changed"); invariant(oracle.status === "negative-oracle-activation-blocked" && oracle.cases.every(({ outcome }) => outcome === "reject"), "negative oracle permits calculation");
  return checkEvidenceStudy(manifest, { repositoryRoot: requestedRoot });
}
