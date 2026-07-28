import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

import { check, studyId } from "./study.mjs";

describe("Cali regulatory evidence dossier", () => {
  it("passes the installed F3 evidence and ancillary locks", async () => {
    const report = await check({ repositoryRoot: new URL("../../..", import.meta.url).pathname.replace(/^\/(.:)/, "$1") });
    expect(report.studyId).toBe(studyId);
    expect(report.coverage.expectedRows).toBe(39);
    expect(report.coverage.expectedValues).toBe(156);
    expect(report.uncoveredValues).toEqual([]);
  });

  it("pins the historical threshold to physical page 147 and rejects page 136", async () => {
    const locator = JSON.parse(await readFile(new URL("./historical-locator.json", import.meta.url), "utf8"));
    const attestation = JSON.parse(await readFile(new URL("./historical-locator-attestation.json", import.meta.url), "utf8"));

    expect(locator.claim).toMatchObject({
      physicalPage: 147,
      printedFooter: "136",
      scanMarker: "747",
      regionAttestationId: "historical-threshold-p147",
    });
    expect(locator.rejectedLocator).toMatchObject({
      physicalPage: 136,
      printedFooter: "125",
      scanMarker: "736",
    });
    expect(locator.rejectedLocator.reason).toContain("Zona 4E");
    expect(locator.rejectedLocator.reason).toContain("Figura 7.9");
    expect(attestation.positiveLocator.regions[0].rawRgbCropSha256).not.toBe(
      attestation.rejectedLocator.regions[0].rawRgbCropSha256,
    );
  });
});
