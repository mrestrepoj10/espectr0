import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { check } from "./study.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Armenia regulatory-status evidence dossier", () => {
  it("proves the no-activation decision without inventing a spectrum matrix", async () => {
    const report = await check({ repositoryRoot });
    expect(report.studyId).toBe("armenia-microzonation");
    expect(report.coverage).toMatchObject({ expectedRows: 1, expectedValues: 1, bundledSources: 0 });
    expect(report.citations).toMatchObject({ table: 1, row: 1, cell: 1, applicability: 5 });
    expect(report.uncoveredValues).toEqual([]);
  });
});
