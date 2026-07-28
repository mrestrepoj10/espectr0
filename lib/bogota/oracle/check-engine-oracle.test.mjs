import { describe, expect, it } from "vitest";

import { checkBogotaEngineOracle } from "./check-engine-oracle.mjs";

describe("Bogotá engine oracle locks", () => {
  it("pins the independent program, input, output, canonical data, and tolerances", async () => {
    const report = await checkBogotaEngineOracle();
    expect(report).toMatchObject({
      schemaVersion: 1,
      records: 48,
      tolerance: {
        absoluteG: "1e-12",
        relative: "1e-12",
        boundaryEpsilonSeconds: "1e-9",
      },
    });
    expect(Object.keys(report.hashes).sort()).toEqual([
      "canonical",
      "oracleInput",
      "oracleOutput",
      "oracleProgram",
    ]);
  });
});
