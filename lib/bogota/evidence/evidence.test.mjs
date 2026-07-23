import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { check } from "./study.mjs";
import { verifyBogotaAttestation } from "./attestation.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const evidenceRoot = resolve(repositoryRoot, "lib/bogota/evidence");
const loadJson = async (name) => JSON.parse(await readFile(resolve(evidenceRoot, name), "utf8"));
const [attestation, extractionProfile, manifest, claims, sourceLocks] = await Promise.all([
  loadJson("extraction-attestation.json"),
  loadJson("extraction-profile.json"),
  loadJson("manifest.json"),
  loadJson("claims-matrix.json"),
  loadJson("source-locks.json"),
]);

function resign(value) {
  const payload = structuredClone(value);
  delete payload.payloadSha256;
  return {
    ...payload,
    payloadSha256: createHash("sha256").update(`${JSON.stringify(payload, null, 2)}\n`).digest("hex"),
  };
}

describe("Bogotá regulatory evidence dossier", () => {
  it("passes F3 coverage, generated-artifact, legal, and independent-oracle gates", async () => {
    const report = await check({ repositoryRoot });
    expect(report.studyId).toBe("bogota-microzonation");
    expect(report.coverage).toMatchObject({ expectedRows: 48, expectedValues: 288, bundledSources: 0 });
    expect(report.uncoveredValues).toEqual([]);
  });

  it.each([
    ["table", (value) => { value.tables[0].reference = "Tabla 7.999. Sintética"; }, /table design authoritative locator mismatch/],
    ["token", (value) => { value.tables[0].rows[0].cells[0].token = "9.99"; }, /cell cell-design-cerros-fa token\/value mismatch/],
    ["rectangle", (value) => { value.tables[1].rows[0].cells[0].rect.left += 0.01; }, /cell cell-limited-safety-cerros-fa rectangle mismatch/],
    ["source hash", (value) => { value.source.sha256 = "0".repeat(64); }, /source hash mismatch/],
  ])("fails closed for a synthetic %s mismatch", (_name, mutate, expected) => {
    const synthetic = structuredClone(attestation);
    mutate(synthetic);
    expect(() => verifyBogotaAttestation({ attestation: resign(synthetic), extractionProfile, manifest, claims, sourceLocks })).toThrow(expected);
  });
});
