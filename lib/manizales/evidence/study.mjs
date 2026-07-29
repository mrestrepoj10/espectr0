import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { checkEvidenceStudy } from "../../regulatory/runtime.mjs";
import { verifyManizalesAttestation } from "./attestation.mjs";

export const studyId = "manizales-microzonation";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const expectedRepositoryRoot = resolve(root, "../..");
const run = promisify(execFile);
const load = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = await load("evidence/manifest.json");

function invariant(condition, message) {
  if (!condition) throw new Error(`Manizales evidence invariant failed: ${message}`);
}

async function checkAncillary(repositoryRoot) {
  invariant(resolve(repositoryRoot) === resolve(expectedRepositoryRoot), "descriptor repository root mismatch");
  await run(process.execPath, [resolve(here, "generate.mjs"), "--check"], { cwd: repositoryRoot });
  await run("python", [resolve(root, "oracle/generate_oracle.py"), "--check"], { cwd: repositoryRoot });
  const [canonical, sourceLocks, formulas, claims, uncertainties, conflicts, differences, redistribution, review, profile, attestation, oracleInput, oracle, oracleLocks] = await Promise.all([
    load("data/canonical.json"), load("evidence/source-locks.json"), load("evidence/formula-inventory.json"),
    load("evidence/claims-matrix.json"), load("evidence/uncertainty-ledger.json"), load("evidence/conflict-ledger.json"),
    load("evidence/reference-site-differences.json"), load("evidence/redistribution.json"), load("evidence/review-record.json"),
    load("evidence/extraction-profile.json"), load("evidence/extraction-attestation.json"), load("oracle/oracle-input.json"),
    load("oracle/oracle.json"), load("oracle/locks.json"),
  ]);

  invariant(canonical.status === "research-only-activation-blocked" && !canonical.activationAllowed && !canonical.mergeIntoEngineAllowed, "activation guard changed");
  invariant(canonical.blockers.length === 3 && canonical.governingTechnicalCandidate.manualSelectorCompatible === false, "data blockers or selector guard changed");
  invariant(canonical.historicalModel.periodApplicability.scope === "historical-2002-only" && canonical.historicalModel.periodApplicability.specialSeismicAnalysisRequiredAtOrAboveSeconds === 2 && canonical.historicalModel.periodApplicability.notAppliedTo === canonical.governingTechnicalCandidate.id, "historical period applicability changed");
  invariant(manifest.values.length === 5 && manifest.values.every(({ provenance }) => provenance === "direct-source"), "direct matrix changed");
  invariant(manifest.rawRows.length === 1 && manifest.canonicalRows.length === 1, "option x hazard matrix changed");
  invariant(claims.exactOptionHazardMatrix.coveragePercent === 100 && claims.exactOptionHazardMatrix.exactCoveredFieldValues === 5, "exact matrix coverage changed");
  invariant(Object.values(claims.categoryCoverage).every(({ coveragePercent }) => coveragePercent === 100), "claim category disposition coverage changed");
  invariant(formulas.status === "incomplete-blocks-activation" && formulas.inventoryCoverage.operationalFormulaCoveragePercent === 50, "formula disposition changed");
  invariant(uncertainties.blocking && uncertainties.entries.every(({ severity }) => severity === "blocker"), "uncertainty gate changed");
  invariant(conflicts.entries.some(({ id, status }) => id === "manual-selector-vs-spatial-model" && status === "unresolved-blocker"), "manual selector conflict changed");
  invariant(differences.nonInference.startsWith("No se transfieren"), "reference non-inference guard changed");
  invariant(redistribution.committedSourceBytes === false && redistribution.sources.every(({ decision }) => decision === "external-only"), "redistribution guard changed");
  invariant(review.independentReview.status === "pending" && review.activationDecision === "blocked-no-merge-no-activation", "review gate changed");
  invariant(sourceLocks.locks.length === 6 && sourceLocks.unavailableSources.length === 1, "source lock/blocker inventory changed");
  invariant(sourceLocks.indexSearches.length === 1, "decree index search inventory changed");
  invariant(sourceLocks.indexSearches[0].anonymousAccess === true, "public decree index access must be recorded accurately");
  invariant(sourceLocks.indexSearches[0].targetTitleMatches.length === 0, "decree title search disposition changed");
  for (const lock of sourceLocks.locks) {
    const source = manifest.sources.find(({ id }) => id === lock.sourceDocumentId);
    invariant(source && source.sha256 === lock.sha256 && source.pageCount === lock.pageCount && source.officialUrl === lock.officialUrl, `source lock mismatch ${lock.sourceDocumentId}`);
  }

  const attested = verifyManizalesAttestation({ attestation, profile, manifest, sourceLocks });
  invariant(attested.sources === 6 && attested.regions === 21, "attestation totals changed");
  invariant(oracleInput.candidate.optionId === canonical.governingTechnicalCandidate.id, "oracle/canonical option mismatch");
  invariant(oracle.status === "partial-oracle-activation-blocked" && oracle.recordCount === 1 && oracle.records[0].spectralSamples.length === 0, "oracle activation guard changed");
  invariant(oracle.negativeCases.some(({ case: name, expected }) => name === "manual-zone-selector" && expected.includes("raster")), "oracle manual selector rejection missing");
  invariant(oracle.negativeCases.some(({ case: name, expected }) => name === "historical-2002-period-at-or-above-2s" && expected.includes("special-seismic-analysis")), "oracle historical long-period rejection missing");
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
