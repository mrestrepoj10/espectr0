import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export async function checkBogotaEngineOracle() {
  const locksPath = resolve(repositoryRoot, "lib/bogota/oracle/engine-locks.json");
  const locks = await readJson(locksPath);
  if (locks.schemaVersion !== 1) throw new Error("Unknown Bogotá engine-lock schema");
  if (
    locks.comparisonTolerance.absoluteG !== "1e-12" ||
    locks.comparisonTolerance.relative !== "1e-12" ||
    locks.comparisonTolerance.boundaryEpsilonSeconds !== "1e-9"
  ) {
    throw new Error("Bogotá binary64 tolerance declaration changed");
  }

  const hashes = {};
  for (const [id, lock] of Object.entries(locks.files)) {
    const path = resolve(repositoryRoot, lock.path);
    const actual = await sha256(path);
    if (actual !== lock.sha256) {
      throw new Error(`Bogotá ${id} hash mismatch: ${actual}`);
    }
    hashes[id] = actual;
  }

  const [oracleInput, oracleOutput] = await Promise.all([
    readJson(resolve(repositoryRoot, locks.files.oracleInput.path)),
    readJson(resolve(repositoryRoot, locks.files.oracleOutput.path)),
  ]);
  if (oracleOutput.engine !== locks.oracle) {
    throw new Error("Bogotá oracle engine declaration mismatch");
  }
  if (oracleOutput.inputSha256 !== hashes.oracleInput) {
    throw new Error("Bogotá oracle output is not bound to the locked input");
  }
  if (
    oracleOutput.auditSummary.recordCount !== 48 ||
    oracleOutput.auditSummary.expectedRecordCount !== 48 ||
    oracleOutput.records.length !== 48 ||
    oracleInput.options.length !== 16 ||
    Object.keys(oracleInput.hazards).length !== 3
  ) {
    throw new Error("Bogotá oracle does not cover the approved 16×3 matrix");
  }

  return {
    schemaVersion: 1,
    records: oracleOutput.records.length,
    tolerance: locks.comparisonTolerance,
    hashes,
  };
}

if (process.argv.includes("--check")) {
  const report = await checkBogotaEngineOracle();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
