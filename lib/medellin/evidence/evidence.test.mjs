import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { check } from "./study.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Medellín regulatory evidence dossier", () => {
  it("proves the historical 14×2×6 table while preserving the no-activation blockers", async () => {
    const report = await check({ repositoryRoot });
    expect(report.studyId).toBe("medellin-microzonation");
    expect(report.coverage).toMatchObject({ expectedRows: 28, expectedValues: 168, bundledSources: 0 });
    expect(report.citations).toMatchObject({ table: 1, row: 28, cell: 168, applicability: 4 });
    expect(report.uncoveredValues).toEqual([]);
  });
});
