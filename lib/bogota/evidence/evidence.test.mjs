import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { check } from "./study.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Bogotá regulatory evidence dossier", () => {
  it("passes F3 coverage, generated-artifact, legal, and independent-oracle gates", async () => {
    const report = await check({ repositoryRoot });
    expect(report.studyId).toBe("bogota-microzonation");
    expect(report.coverage).toMatchObject({ expectedRows: 48, expectedValues: 288, bundledSources: 0 });
    expect(report.uncoveredValues).toEqual([]);
  });
});
