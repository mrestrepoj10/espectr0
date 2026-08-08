import { describe, expect, it } from "vitest";

import { check, studyId } from "./study.mjs";

describe("Manizales regulatory evidence dossier", () => {
  it("covers the three zones of Figura 8.5 with no uncovered value", async () => {
    const repositoryRoot = new URL("../../..", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
    const report = await check({ repositoryRoot });
    expect(report.studyId).toBe(studyId);
    expect(report.coverage.expectedRows).toBe(3);
    expect(report.coverage.expectedValues).toBe(21);
    expect(report.uncoveredValues).toEqual([]);
  });
});
