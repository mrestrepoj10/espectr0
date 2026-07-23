import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { checkEvidenceStudy } from "../../regulatory/runtime.mjs";
import { verifyBogotaAttestation } from "./attestation.mjs";

export const studyId = "bogota-microzonation";
const here = dirname(fileURLToPath(import.meta.url));
const studyRoot = resolve(here, "..");
const repositoryRootFromStudy = resolve(studyRoot, "../..");
const run = promisify(execFile);

const loadJson = async (path) => JSON.parse(await readFile(resolve(studyRoot, path), "utf8"));
const manifest = await loadJson("evidence/manifest.json");

function invariant(condition, message) {
  if (!condition) throw new Error(`Bogotá evidence invariant failed: ${message}`);
}

async function checkAncillaryArtifacts(repositoryRoot) {
  invariant(resolve(repositoryRoot) === resolve(repositoryRootFromStudy), "descriptor repository root mismatch");
  await run(process.execPath, [resolve(here, "generate.mjs"), "--check"], { cwd: repositoryRoot });
  await run("python", [resolve(studyRoot, "oracle/generate_oracle.py"), "--check"], { cwd: repositoryRoot });

  const [canonical, sourceLocks, extractionProfile, attestation, formulas, claims, uncertainties, conflicts, differences, redistribution, review, oracleInput, oracle] = await Promise.all([
    loadJson("data/canonical.json"),
    loadJson("evidence/source-locks.json"),
    loadJson("evidence/extraction-profile.json"),
    loadJson("evidence/extraction-attestation.json"),
    loadJson("evidence/formula-inventory.json"),
    loadJson("evidence/claims-matrix.json"),
    loadJson("evidence/uncertainty-ledger.json"),
    loadJson("evidence/conflict-ledger.json"),
    loadJson("evidence/reference-site-differences.json"),
    loadJson("evidence/redistribution.json"),
    loadJson("evidence/review-record.json"),
    loadJson("oracle/oracle-input.json"),
    loadJson("oracle/oracle.json"),
  ]);

  invariant(canonical.status === "research-only-not-activated", "canonical status must remain research-only");
  invariant(canonical.rows.length === 48, "canonical matrix must contain 48 option×hazard rows");
  invariant(manifest.values.length === 288, "manifest must contain 288 exact covered values");
  invariant(manifest.values.filter(({ provenance }) => provenance === "direct-source").length === 256, "manifest must contain 256 exact direct cells");
  invariant(manifest.values.filter(({ provenance }) => provenance === "derived").length === 32, "manifest must contain 32 graph-origin derivations");
  invariant(claims.directMatrix.exactCoveredPairs === 48 && claims.directMatrix.exactCoveredFieldValues === 288, "claims coverage totals differ");
  const attestationReport = verifyBogotaAttestation({ attestation, extractionProfile, manifest, claims, sourceLocks });
  invariant(attestationReport.tables === 3 && attestationReport.rows === 48 && attestationReport.cells === 256, "external extraction attestation coverage differs");

  const sourceById = new Map(manifest.sources.map((source) => [source.id, source]));
  invariant(sourceLocks.locks.length === manifest.sources.length, "external lock coverage differs from source manifest");
  for (const lock of sourceLocks.locks) {
    const source = sourceById.get(lock.sourceDocumentId);
    invariant(source, `unknown source lock ${lock.sourceDocumentId}`);
    invariant(source.officialUrl === lock.officialUrl && source.sha256 === lock.sha256 && source.retrievedOn === lock.retrievedOn, `lock metadata mismatch for ${lock.sourceDocumentId}`);
    invariant(source.redistribution.decision === "external-only" && lock.redistributionDecision === "external-only", `source ${lock.sourceDocumentId} must remain pathless`);
  }

  const validSourcePages = new Set(manifest.sources.flatMap((source) => source.pages.map((page) => `${source.id}/${page.physicalPage}/${page.printedPage ?? ""}`)));
  for (const formula of formulas.formulas) {
    const { sourceDocumentId, physicalPage, printedPage, rect } = formula.citation;
    invariant(validSourcePages.has(`${sourceDocumentId}/${physicalPage}/${printedPage ?? ""}`), `formula ${formula.id} has an unknown source page`);
    invariant(rect.left >= 0 && rect.top >= 0 && rect.width > 0 && rect.height > 0 && rect.left + rect.width <= 1 && rect.top + rect.height <= 1, `formula ${formula.id} has invalid coordinates`);
  }
  invariant(formulas.formulas.length === 14, "all 14 curve/boundary formulas must be inventoried");
  for (const claim of claims.claims) {
    const citation = claim.citation;
    invariant(validSourcePages.has(`${citation.sourceDocumentId}/${citation.physicalPage}/${citation.printedPage ?? ""}`), `claim ${claim.id} has an unknown source coordinate`);
  }
  invariant(claims.claims.filter(({ id }) => id.startsWith("warning-")).length === 7, "warning claim coverage differs");
  invariant(uncertainties.entries.length === 3 && conflicts.entries.length === 3, "uncertainty/conflict ledgers are incomplete");
  invariant(differences.nonInference.includes("does not infer"), "legal comparison must preserve the non-inference guard");
  invariant(redistribution.decision === "external-only-all-sources", "redistribution policy changed");
  invariant(review.independentReview.status === "pending" && review.activationDecision === "blocked-pending-independent-review", "research cannot be activated before independent review");

  const fieldIds = manifest.coverage.fieldIds;
  const canonicalByKey = new Map(canonical.rows.map((row) => [`${row.optionId}/${row.hazardId}`, row.fields]));
  for (const [hazardId, hazard] of Object.entries(oracleInput.hazards)) {
    hazard.rows.forEach((row, index) => {
      const optionId = oracleInput.options[index];
      const expected = canonicalByKey.get(`${optionId}/${hazardId}`);
      invariant(expected, `oracle row ${optionId}/${hazardId} is absent from canonical data`);
      fieldIds.forEach((fieldId, fieldIndex) => invariant(Number(row[fieldIndex]) === expected[fieldId], `independent transcription differs at ${optionId}/${hazardId}/${fieldId}`));
    });
  }
  invariant(oracle.auditSummary.recordCount === 48 && oracle.records.length === 48, "oracle coverage differs");
  invariant(oracle.boundaryPolicy.includes("Direct tabulated periods"), "oracle must not substitute recomputed boundaries");
}

export async function check({ repositoryRoot }) {
  await checkAncillaryArtifacts(repositoryRoot);
  return checkEvidenceStudy(manifest, { repositoryRoot });
}
