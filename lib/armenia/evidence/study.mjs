import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { checkEvidenceStudy } from "../../regulatory/runtime.mjs";

export const studyId = "armenia-microzonation";
const here = dirname(fileURLToPath(import.meta.url));
const studyRoot = resolve(here, "..");
const repositoryRootFromStudy = resolve(studyRoot, "../..");
const run = promisify(execFile);
const loadJson = async (path) => JSON.parse(await readFile(resolve(studyRoot, path), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = await loadJson("evidence/manifest.json");

function invariant(condition, message) {
  if (!condition) throw new Error(`Armenia evidence invariant failed: ${message}`);
}

function validRect(rect) {
  return rect.left >= 0 && rect.top >= 0 && rect.width > 0 && rect.height > 0
    && rect.left + rect.width <= 1 && rect.top + rect.height <= 1;
}

async function checkAncillaryArtifacts(repositoryRoot) {
  invariant(resolve(repositoryRoot) === resolve(repositoryRootFromStudy), "descriptor repository root mismatch");
  await run(process.execPath, [resolve(here, "generate.mjs"), "--check"], { cwd: repositoryRoot });
  await run("python", [resolve(studyRoot, "oracle/generate_oracle.py"), "--check"], { cwd: repositoryRoot });

  const [canonical, locks, attestation, formulas, claims, uncertainties, conflicts, differences, redistribution, review, oracleInput, oracle, oracleLocks] = await Promise.all([
    loadJson("data/canonical.json"),
    loadJson("evidence/source-locks.json"),
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
    loadJson("oracle/locks.json"),
  ]);

  invariant(canonical.status === "research-only-activation-blocked", "canonical data must remain inactive");
  invariant(canonical.proposedSpectrumMatrix.selectableOptions.length === 0, "no municipal spectrum option may be selectable");
  invariant(canonical.proposedSpectrumMatrix.hazards.length === 0 && canonical.proposedSpectrumMatrix.rows.length === 0, "no hazard or coefficient rows may ship");
  invariant(canonical.historicalRecord.coefficientsCanonicalized === false && canonical.historicalRecord.formulasCanonicalized === false, "legacy values/formulas must not be canonicalized");
  invariant(Object.entries(canonical.capabilities).every(([key, value]) => key === "traceabilityViewer" ? value === true : value === false), "blocked capability matrix changed");
  invariant(canonical.blockers.length === 5, "canonical blocker set changed");

  invariant(manifest.values.length === 1 && manifest.values[0].fieldId === "activation-status", "F3 matrix must contain only the regulatory status value");
  invariant(manifest.values[0].provenance === "direct-source", "regulatory status must remain source-direct");
  invariant(manifest.rawRows.length === 1 && manifest.canonicalRows.length === 1, "regulatory status row count changed");
  invariant(claims.regulatoryStatusMatrix.coveragePercent === 100, "regulatory status coverage differs");
  invariant(claims.proposedSpectrumMatrix.coverageStatus === "not-applicable-no-approved-matrix", "empty spectrum matrix rationale changed");
  invariant(claims.claimCoverage.applicability.coveragePercent === 100 && claims.claimCoverage.warnings.coveragePercent === 100, "claim citation coverage differs");

  const sourceById = new Map(manifest.sources.map((source) => [source.id, source]));
  invariant(sourceById.size === 5 && locks.locks.length === 5, "all five official sources require locks");
  for (const lock of locks.locks) {
    const source = sourceById.get(lock.sourceDocumentId);
    invariant(source, `unknown source lock ${lock.sourceDocumentId}`);
    invariant(source.sha256 === lock.sha256 && source.pageCount === lock.pageCount && source.officialUrl === lock.officialUrl, `source lock mismatch ${lock.sourceDocumentId}`);
    invariant(source.redistribution.decision === "external-only" && lock.redistributionDecision === "external-only", `source ${lock.sourceDocumentId} must remain pathless`);
  }

  const attestationById = new Map(attestation.attestations.map((item) => [item.id, item]));
  invariant(attestation.externalOnly && attestation.extraction.ocrUsed === false, "external-only/no-OCR policy changed");
  invariant(attestationById.size === 6, "attestation set changed");
  for (const item of attestation.attestations) {
    const source = sourceById.get(item.sourceDocumentId);
    invariant(source && source.sha256 === item.sourceSha256, `attestation source hash mismatch ${item.id}`);
    invariant(validRect(item.rect), `attestation rectangle invalid ${item.id}`);
    invariant(hash(Buffer.from(item.text, "utf8")) === item.sha256, `attestation statement hash mismatch ${item.id}`);
    invariant(item.requiredTokens.every((token) => item.text.includes(token)), `attestation required token missing ${item.id}`);
  }
  const indexAudit = attestationById.get("attest-decree-index-audit");
  invariant(indexAudit.absentTokens.length === 3 && indexAudit.caveat.includes("not treated as proof"), "decree-index negative-evidence guard changed");

  const pageKeys = new Set(manifest.sources.flatMap((source) => source.pages.map((page) => `${source.id}/${page.physicalPage}`)));
  for (const claim of claims.claims) {
    const item = attestationById.get(claim.citation.attestationId);
    invariant(item, `claim ${claim.id} has no extraction attestation`);
    invariant(pageKeys.has(`${claim.citation.sourceDocumentId}/${claim.citation.physicalPage}`), `claim ${claim.id} has an unknown source page`);
    invariant(item.sha256 === claim.citation.statementSha256 && validRect(claim.citation.rect), `claim ${claim.id} locator/hash differs`);
  }
  invariant(formulas.status === "unavailable-blocks-activation", "formula gap must block activation");
  invariant(formulas.proposedProductionFormulas.length === 0 && formulas.coverage.expected === 0 && formulas.coverage.cited === 0, "unsupported formulas were introduced");
  invariant(uncertainties.blocking && uncertainties.entries.length === 5 && uncertainties.entries.every(({ severity }) => severity === "blocker"), "uncertainty blockers differ");
  invariant(conflicts.entries.length === 3 && conflicts.entries.every(({ status }) => status === "resolved-for-product"), "conflict resolutions differ");
  invariant(differences.nonInference.includes("No missing primary-source fact"), "reference-site non-inference guard changed");
  invariant(redistribution.decision === "external-only-all-sources" && !redistribution.committedSourceBytes, "redistribution decision changed");
  invariant(review.independentReview.status === "pending" && review.activationDecision.startsWith("blocked"), "independent review/activation gate changed");

  invariant(oracleInput.proposedSpectrumMatrix.selectableOptions.length === 0, "oracle input must not contain selectable zones");
  invariant(oracle.status === "negative-oracle-activation-blocked" && oracle.records.length === 5, "negative oracle status/cases differ");
  invariant(oracle.records.every(({ expected }) => expected.startsWith("reject") || expected === "use-nsr10-national"), "oracle permits an unsupported municipal result");
  const oracleBytes = await readFile(resolve(studyRoot, "oracle/oracle.json"));
  const inputBytes = await readFile(resolve(studyRoot, "oracle/oracle-input.json"));
  const programBytes = await readFile(resolve(studyRoot, "oracle/generate_oracle.py"));
  const canonicalBytes = await readFile(resolve(studyRoot, "data/canonical.json"));
  invariant(oracleLocks.output === hash(oracleBytes) && oracleLocks.input === hash(inputBytes) && oracleLocks.program === hash(programBytes) && oracleLocks.canonical === hash(canonicalBytes), "oracle locks differ from committed bytes");
}

export async function check({ repositoryRoot }) {
  await checkAncillaryArtifacts(repositoryRoot);
  return checkEvidenceStudy(manifest, { repositoryRoot });
}
