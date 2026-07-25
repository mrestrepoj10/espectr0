import { describe, expect, it } from "vitest";

import { check, studyId } from "./study.mjs";

describe("Cali regulatory evidence dossier", () => {
  it("passes the installed F3 evidence and ancillary locks", async () => {
    const report = await check({ repositoryRoot: new URL("../../..", import.meta.url).pathname.replace(/^\/(.:)/, "$1") });
    expect(report.studyId).toBe(studyId);
    expect(report.coverage.expectedRows).toBe(39);
    expect(report.coverage.expectedValues).toBe(156);
    expect(report.uncoveredValues).toEqual([]);
  });
});
