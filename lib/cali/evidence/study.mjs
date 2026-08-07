import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { checkEvidenceStudy } from "../../regulatory/runtime.mjs";
import { verifyCaliAttestation, verifyHistoricalLocatorAttestation } from "./attestation.mjs";

export const studyId = "cali-microzonation";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const repositoryRootFromStudy = resolve(root, "../..");
const run = promisify(execFile);
const load = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = await load("evidence/manifest.json");

function invariant(condition, message) {
  if (!condition) throw new Error(`Cali evidence invariant failed: ${message}`);
}

async function checkAncillary(repositoryRoot) {
  invariant(resolve(repositoryRoot) === resolve(repositoryRootFromStudy), "descriptor repository root mismatch");
  await run(process.execPath, [resolve(here, "generate.mjs"), "--check"], { cwd: repositoryRoot });
  await run("python", [resolve(root, "oracle/generate_oracle.py"), "--check"], { cwd: repositoryRoot });
  const [canonical, locks, formulas, claims, uncertainties, conflicts, differences, redistribution, review, profile, attestation, historicalLocator, historicalAttestation, oracleInput, oracle, oracleLocks] = await Promise.all([
    load("data/canonical.json"), load("evidence/source-locks.json"), load("evidence/formula-inventory.json"),
    load("evidence/claims-matrix.json"), load("evidence/uncertainty-ledger.json"), load("evidence/conflict-ledger.json"),
    load("evidence/reference-site-differences.json"), load("evidence/redistribution.json"), load("evidence/review-record.json"),
    load("evidence/extraction-profile.json"), load("evidence/extraction-attestation.json"),
    load("evidence/historical-locator.json"), load("evidence/historical-locator-attestation.json"), load("oracle/oracle-input.json"),
    load("oracle/oracle.json"), load("oracle/locks.json"),
  ]);

  invariant(canonical.status === "research-only-activation-blocked" && canonical.blockers.length === 2, "activation blockers changed");
  invariant(canonical.geographicOptions.length === 10 && canonical.curveComponents.length === 13, "zone/component model changed");
  invariant(canonical.rows.length === 39 && manifest.values.length === 156, "13×3×4 direct hazard matrix changed");
  invariant(manifest.rawRows.length === 39 && manifest.canonicalRows.length === 39, "hazard row matrix changed");
  invariant(manifest.values.every(({ provenance }) => provenance === "direct-source"), "all matrix values must remain direct transcriptions");
  invariant(claims.directMatrix.coveragePercent === 100 && claims.directMatrix.distinctAttestedCells === 144, "direct claims coverage changed");
  invariant(claims.ancillaryMinimumTable.relation === "design-lower-bound-not-hazard" && claims.ancillaryMinimumTable.exactCoveredFieldValues === 52, "ancillary minimum-table coverage changed");
  invariant(claims.ancillaryPgaTable.relation === "surface-design-pga-not-hazard" && claims.ancillaryPgaTable.exactCoveredFieldValues === 10, "ancillary PGA coverage changed");
  invariant(canonical.hazards.length === 3 && !canonical.hazards.some(({ id }) => id.includes("minimum")), "Table 6 must not be modeled as a hazard");
  invariant(canonical.ancillary.siteSpecificDesignMinimum.rows.length === 13, "minimum design lower-bound rows changed");

  const sourceById = new Map(manifest.sources.map((source) => [source.id, source]));
  invariant(locks.locks.length === 4 && sourceById.size === 4, "four official sources must remain locked");
  for (const lock of locks.locks) {
    const source = sourceById.get(lock.sourceDocumentId);
    invariant(source && source.sha256 === lock.sha256 && source.pageCount === lock.pageCount && source.officialUrl === lock.officialUrl, `source lock mismatch ${lock.sourceDocumentId}`);
    invariant(source.redistribution.decision === "external-only" && lock.redistributionDecision === "external-only", `source must remain external-only ${lock.sourceDocumentId}`);
  }

  const pageKeys = new Set(manifest.sources.flatMap((source) => source.pages.map((page) => `${source.id}/${page.physicalPage}/${page.printedPage ?? ""}`)));
  for (const formula of formulas.formulas) {
    const { sourceDocumentId, physicalPage, printedPage, rect } = formula.citation;
    invariant(pageKeys.has(`${sourceDocumentId}/${physicalPage}/${printedPage ?? ""}`), `unknown formula page ${formula.id}`);
    invariant(rect.left >= 0 && rect.top >= 0 && rect.width > 0 && rect.height > 0 && rect.left + rect.width <= 1 && rect.top + rect.height <= 1, `invalid formula rectangle ${formula.id}`);
  }
  for (const claim of claims.claims) {
    const { sourceDocumentId, physicalPage, printedPage } = claim.citation;
    invariant(pageKeys.has(`${sourceDocumentId}/${physicalPage}/${printedPage ?? ""}`), `unknown claim page ${claim.id}`);
  }
  invariant(formulas.status === "incomplete-blocks-activation" && formulas.formulas.length === 7, "formula inventory status changed");
  invariant(formulas.formulas.filter(({ status }) => status.startsWith("blocked")).length === 2, "damage formula blockers changed");
  invariant(uncertainties.blocking && uncertainties.entries.filter(({ severity }) => severity === "blocker").length === 2, "uncertainty blockers changed");
  invariant(conflicts.entries.some(({ id, status }) => id === "damage-missing-a0d-fa" && status === "unresolved-blocker"), "damage conflict must remain unresolved");
  invariant(differences.nonInference.includes("No se transfieren"), "non-inference guard changed");
  invariant(redistribution.decision === "external-only-all-sources" && redistribution.committedSourceBytes === false, "redistribution policy changed");
  // Pages of a source are served after all — the MZSC-R02 sheet — so the
  // exception has to stay declared and its files present, or the flag above
  // would keep reading as "nothing is shipped".
  const mapException = redistribution.mapSheetException;
  invariant(mapException && mapException.permissionStatus === "not-established", "map sheet exception lost its permission status");
  for (const artifact of mapException.committedArtifacts) {
    await readFile(resolve(repositoryRoot, artifact));
  }
  invariant(review.independentReview.status === "pending" && review.activationDecision.startsWith("blocked"), "review gate changed");

  const attested = verifyCaliAttestation({ attestation, extractionProfile: profile, manifest, canonical, claims, sourceLocks: locks });
  invariant(attested.matrixCells === 156 && attested.ancillaryMinimumCells === 52 && attested.ancillaryPgaCells === 10 && attested.distinctRegions === 206, "attestation coverage changed");
  const historicalAttested = verifyHistoricalLocatorAttestation({
    attestation: historicalAttestation,
    locator: historicalLocator,
    manifest,
    claims,
    sourceLocks: locks,
  });
  invariant(historicalAttested.positivePhysicalPage === 147 && historicalAttested.rejectedPhysicalPage === 136, "historical locator regression changed");

  const canonicalByKey = new Map(canonical.rows.map((row) => [`${row.optionId}/${row.hazardId}`, row.fields]));
  for (const [hazardId, hazard] of Object.entries(oracleInput.hazards)) {
    hazard.rows.forEach((row, optionIndex) => {
      const optionId = oracleInput.options[optionIndex];
      const fields = canonicalByKey.get(`${optionId}/${hazardId}`);
      invariant(fields, `oracle row absent from canonical ${optionId}/${hazardId}`);
      oracleInput.fields.forEach((fieldId, fieldIndex) => invariant(Number(row[fieldIndex]) === fields[fieldId], `oracle/canonical mismatch ${optionId}/${hazardId}/${fieldId}`));
    });
  }
  const minimumInput = oracleInput.ancillaryCurves["site-specific-design-minimum"];
  minimumInput.rows.forEach((row, optionIndex) => {
    const canonicalRow = canonical.ancillary.siteSpecificDesignMinimum.rows[optionIndex];
    oracleInput.fields.forEach((fieldId, fieldIndex) => invariant(Number(row[fieldIndex]) === canonicalRow.fields[fieldId], `minimum oracle/canonical mismatch ${canonicalRow.optionId}/${fieldId}`));
  });
  invariant(oracle.status === "partial-oracle-activation-blocked" && oracle.recordCount === 52, "oracle status/count changed");
  invariant(oracle.records.filter(({ status }) => status.startsWith("partial")).length === 13, "damage partial records changed");
  invariant(oracle.records.filter(({ curveFamilyId }) => curveFamilyId === "site-specific-design-minimum").length === 13, "ancillary minimum oracle records changed");
  invariant(oracle.negativeCases.some(({ case: value, expected }) => value === "activation" && expected.includes("missing-damage-a0d-fa")), "activation negative case missing");
  const [programBytes, inputBytes, canonicalBytes, outputBytes] = await Promise.all([
    readFile(resolve(root, "oracle/generate_oracle.py")), readFile(resolve(root, "oracle/oracle-input.json")),
    readFile(resolve(root, "data/canonical.json")), readFile(resolve(root, "oracle/oracle.json")),
  ]);
  invariant(oracleLocks.program === sha256(programBytes) && oracleLocks.input === sha256(inputBytes) && oracleLocks.canonical === sha256(canonicalBytes) && oracleLocks.output === sha256(outputBytes), "oracle locks differ from committed bytes");
}

export async function check({ repositoryRoot }) {
  await checkAncillary(repositoryRoot);
  return checkEvidenceStudy(manifest, { repositoryRoot });
}
