import { describe, expect, it } from "vitest";

import { check, studyId } from "./study.mjs";

describe("Manizales regulatory evidence dossier", () => {
  it("passes F3 locks while remaining explicitly inactivable", async () => {
    const repositoryRoot = new URL("../../..", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
    const report = await check({ repositoryRoot });
    expect(report.studyId).toBe(studyId);
    expect(report.coverage.expectedRows).toBe(1);
    expect(report.coverage.expectedValues).toBe(5);
    expect(report.uncoveredValues).toEqual([]);
  });
});
