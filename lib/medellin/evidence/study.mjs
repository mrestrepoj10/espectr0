import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { checkEvidenceStudy } from "../../regulatory/runtime.mjs";
import { verifyMedellinCurrentnessAttestation } from "./attestation.mjs";

export const studyId = "medellin-microzonation";
const here = dirname(fileURLToPath(import.meta.url));
const studyRoot = resolve(here, "..");
const repositoryRootFromStudy = resolve(studyRoot, "../..");
const run = promisify(execFile);
const loadJson = async (path) => JSON.parse(await readFile(resolve(studyRoot, path), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = await loadJson("evidence/manifest.json");

function invariant(condition, message) {
  if (!condition) throw new Error(`Medellín evidence invariant failed: ${message}`);
}

async function checkAncillaryArtifacts(repositoryRoot) {
  invariant(resolve(repositoryRoot) === resolve(repositoryRootFromStudy), "descriptor repository root mismatch");
  await run(process.execPath, [resolve(here, "generate.mjs"), "--check"], { cwd: repositoryRoot });
  await run("python", [resolve(studyRoot, "oracle/generate_oracle.py"), "--check"], { cwd: repositoryRoot });
  const [canonical, locks, formulas, claims, uncertainties, conflicts, currentness, currentnessAttestation, differences, redistribution, review, oracleInput, oracle, oracleLocks] = await Promise.all([
    loadJson("data/canonical.json"), loadJson("evidence/source-locks.json"),
    loadJson("evidence/formula-inventory.json"), loadJson("evidence/claims-matrix.json"),
    loadJson("evidence/uncertainty-ledger.json"), loadJson("evidence/conflict-ledger.json"),
    loadJson("evidence/currentness-ledger.json"), loadJson("evidence/currentness-attestation.json"),
    loadJson("evidence/reference-site-differences.json"), loadJson("evidence/redistribution.json"),
    loadJson("evidence/review-record.json"), loadJson("oracle/oracle-input.json"),
    loadJson("oracle/oracle.json"), loadJson("oracle/locks.json"),
  ]);

  invariant(canonical.status === "calculation-supported-with-localized-limitations", "canonical calculation policy changed");
  invariant(canonical.localizedLimitations.length === 4, "canonical localized limitation set changed");
  invariant(canonical.rows.length === 28 && manifest.values.length === 168, "14×2×6 matrix coverage differs");
  invariant(manifest.values.every(({ provenance }) => provenance === "direct-source"), "all table fields must remain exact direct transcriptions");
  invariant(claims.directMatrix.coveragePercent === 100 && claims.directMatrix.exactCoveredFieldValues === 168, "claims coverage differs");

  const sourceById = new Map(manifest.sources.map((source) => [source.id, source]));
  invariant(locks.locks.length === 6 && sourceById.size === 6, "all six official sources require locks");
  for (const lock of locks.locks) {
    const source = sourceById.get(lock.sourceDocumentId);
    invariant(source, `unknown source lock ${lock.sourceDocumentId}`);
    invariant(source.sha256 === lock.sha256 && source.pageCount === lock.pageCount && source.officialUrl === lock.officialUrl, `source lock mismatch ${lock.sourceDocumentId}`);
    invariant(source.redistribution.decision === "external-only" && lock.redistributionDecision === "external-only", `source ${lock.sourceDocumentId} must remain pathless`);
  }

  const pageKeys = new Set(manifest.sources.flatMap((source) => source.pages.map((page) => `${source.id}/${page.physicalPage}/${page.printedPage ?? ""}`)));
  for (const formula of formulas.formulas) {
    const { sourceDocumentId, physicalPage, printedPage, rect } = formula.citation;
    invariant(pageKeys.has(`${sourceDocumentId}/${physicalPage}/${printedPage ?? ""}`), `formula ${formula.id} has an unknown source page`);
    invariant(rect.left >= 0 && rect.top >= 0 && rect.width > 0 && rect.height > 0 && rect.left + rect.width <= 1 && rect.top + rect.height <= 1, `formula ${formula.id} has invalid coordinates`);
  }
  invariant(formulas.status === "calculation-supported-with-localized-gap" && formulas.formulas.length === 5, "formula inventory must preserve explicit localized gap");
  invariant(formulas.formulas.some(({ status }) => status === "localized-unsupported-equation-absent"), "missing short-period formula must localize unsupported periods");
  invariant(claims.claims.filter(({ kind }) => kind === "warning").length === 6, "warning citation coverage differs");
  invariant(!uncertainties.blocking && uncertainties.entries.every(({ severity }) => severity !== "blocker"), "uncertainties must remain localized or contextual");
  invariant(conflicts.entries.length === 5 && conflicts.entries.every(({ status }) => status === "resolved-for-product"), "conflict resolutions differ");
  invariant(currentness.asOf === "2026-07-25" && currentness.status === "no-current-municipal-adoption-established", "currentness decision changed");
  invariant(currentness.openQuestions.length === 4 && currentness.activationDecision === "technical-calculation-enabled-localized-limitations", "currentness calculation policy changed");
  const claimIds = new Set(claims.claims.map(({ id }) => id));
  const uncertaintyById = new Map(uncertainties.entries.map((entry) => [entry.id, entry]));
  invariant(currentness.latestOfficialEvidence.every(({ sourceDocumentId, citationIds }) => sourceById.has(sourceDocumentId) && citationIds.every((citationId) => claimIds.has(citationId))), "currentness evidence is not source/claim locked");
  invariant(currentness.openQuestions.every((id) => uncertaintyById.get(id)?.status.startsWith("open")), "currentness open questions differ from uncertainty ledger");
  verifyMedellinCurrentnessAttestation({ attestation: currentnessAttestation, manifest, sourceLocks: locks });
  invariant(differences.nonInference.includes("No coefficient"), "reference-site non-inference guard changed");
  invariant(redistribution.decision === "external-only-all-sources" && !redistribution.committedSourceBytes, "redistribution decision changed");
  // Bytes of a source are served after all, so the exception has to stay
  // declared and its files present; otherwise the flag beside it would keep
  // reading as "nothing is shipped".
  {
    const exception = redistribution.mapSheetException;
    invariant(exception && exception.permissionStatus === "not-established", "medellin redistribution exception lost its permission status");
    for (const artifact of exception.committedArtifacts) {
      await readFile(resolve(repositoryRoot, artifact));
    }
  }
  invariant(review.independentReview.status === "pending" && review.activationDecision === "source-explicit-calculation-enabled-localized-limitations", "independent review/calculation policy changed");

  const canonicalByKey = new Map(canonical.rows.map((row) => [`${row.optionId}/${row.hazardId}`, row.fields]));
  for (const [hazardId, hazard] of Object.entries(oracleInput.hazards)) {
    hazard.rows.forEach((row, index) => {
      const optionId = oracleInput.options[index];
      const canonicalFields = canonicalByKey.get(`${optionId}/${hazardId}`);
      invariant(canonicalFields, `oracle input row missing from canonical ${optionId}/${hazardId}`);
      oracleInput.fields.forEach((fieldId, fieldIndex) => invariant(Number(row[fieldIndex]) === canonicalFields[fieldId], `oracle transcription mismatch ${optionId}/${hazardId}/${fieldId}`));
    });
  }
  invariant(oracle.status === "partial-oracle-localized-coverage" && oracle.recordCount === 28, "oracle must preserve localized partial coverage");
  invariant(oracle.negativeCases.some(({ case: value, expected }) => value === "return-period" && expected === "unknown-null"), "oracle unknown return-period case missing");
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
