import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { checkEvidenceStudy } from "../../regulatory/runtime.mjs";

export const studyId = "manizales-microzonation";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const repositoryRoot = resolve(root, "../..");
const run = promisify(execFile);
const load = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = await load("evidence/manifest.json");
const invariant = (condition, message) => {
  if (!condition) throw new Error(`Manizales evidence invariant failed: ${message}`);
};

export async function check({ repositoryRoot: requestedRoot }) {
  invariant(resolve(requestedRoot) === repositoryRoot, "repository root mismatch");
  await run(process.execPath, [resolve(here, "generate.mjs"), "--check"], { cwd: requestedRoot });
  await run("python", [resolve(root, "oracle/generate_oracle.py"), "--check"], { cwd: requestedRoot });
  const [canonical, attestation, formulas, claims, locks, uncertainties, conflicts, differences, redistribution, review, oracle, oracleLocks] =
    await Promise.all(
      [
        "data/canonical.json",
        "evidence/extraction-attestation.json",
        "evidence/formula-inventory.json",
        "evidence/claims-matrix.json",
        "evidence/source-locks.json",
        "evidence/uncertainty-ledger.json",
        "evidence/conflict-ledger.json",
        "evidence/reference-site-differences.json",
        "evidence/redistribution.json",
        "evidence/review-record.json",
        "oracle/oracle.json",
        "oracle/locks.json",
      ].map(load),
    );

  invariant(
    canonical.status === "calculation-supported-full-curve" &&
      canonical.capabilities.municipalSpectrumCalculation &&
      canonical.capabilities.automaticZoneSelection === false,
    "supported municipal interval or selector guard changed",
  );
  invariant(canonical.rows.length === 3 && manifest.values.length === 21, "3×1×7 table coverage changed");
  invariant(
    attestation.coverage.directCells === 21 && attestation.coverage.percent === 100,
    "attestation coverage changed",
  );
  invariant(
    claims.directMatrix.exactCoveredFieldValues === 21 && claims.directMatrix.coveragePercent === 100,
    "claim coverage changed",
  );
  invariant(
    formulas.status === "supported-full-curve" &&
      formulas.formulas.length === 4 &&
      formulas.unsupportedIntervals.length === 0,
    "branch coverage changed",
  );
  // Every branch a result can name has to be findable by the shared municipal
  // resolver, which looks a formula up by its inventory id.
  for (const branch of ["entrance", "plateau", "inverse", "floor"]) {
    invariant(
      formulas.formulas.some(({ id }) => id === `manizales-${branch}-branch`),
      `formula inventory lost the ${branch} branch id the engine names`,
    );
  }
  invariant(
    locks.locks.length === 3 && manifest.sources.every((source) => source.redistribution.decision === "external-only"),
    "source locks/redistribution changed",
  );
  // Two rendered source pages are served after all, so the exception has to
  // stay declared and its file present; otherwise the flag beside it would keep
  // reading as "nothing is shipped".
  {
    const exception = redistribution.tableExtractException;
    invariant(exception && exception.permissionStatus === "not-established", "redistribution exception lost its permission status");
    for (const artifact of exception.committedArtifacts) {
      await readFile(resolve(repositoryRoot, artifact));
    }
  }
  invariant(
    uncertainties.blocking === false && uncertainties.entries.length >= 6,
    "uncertainty ledger gate changed",
  );
  invariant(
    conflicts.entries.some(({ id }) => id === "rounded-branch-limits"),
    "the published one-hundredth rounding of the Zone A limits must stay recorded",
  );
  invariant(
    differences.materialDifferences.some((line) => line.includes("cinco")) ||
      differences.materialDifferences.some((line) => line.includes("five")),
    "the reference site's divergent five-zone model must stay recorded",
  );
  invariant(
    review.independentReview.status === "pending" && review.activationDecision.startsWith("calculation-supported"),
    "review record changed",
  );
  invariant(
    oracle.status === "normalized-spectrum-supported-full-curve" && oracle.records.length === 3,
    "oracle coverage changed",
  );
  const canonicalByOption = new Map(canonical.rows.map((row) => [row.optionId, row.fields]));
  for (const record of oracle.records) {
    invariant(
      JSON.stringify(record.fields) === JSON.stringify(canonicalByOption.get(record.optionId)),
      `independent oracle differs for ${record.optionId}`,
    );
  }
  const [programBytes, inputBytes, canonicalBytes, outputBytes] = await Promise.all(
    ["oracle/generate_oracle.py", "oracle/oracle-input.json", "data/canonical.json", "oracle/oracle.json"].map(
      (path) => readFile(resolve(root, path)),
    ),
  );
  invariant(
    oracleLocks.program === sha256(programBytes) &&
      oracleLocks.input === sha256(inputBytes) &&
      oracleLocks.canonical === sha256(canonicalBytes) &&
      oracleLocks.output === sha256(outputBytes),
    "oracle locks differ from committed bytes",
  );
  return checkEvidenceStudy(manifest, { repositoryRoot: requestedRoot });
}
