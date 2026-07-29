import { describe, expect, it } from "vitest";
import { check } from "./study.mjs";

describe("Dosquebradas evidence dossier", () => {
  it("passes deterministic evidence gates with a localized unsupported interval", async () => {
    const report = await check({ repositoryRoot: process.cwd() });
    expect(report.studyId).toBe("dosquebradas-microzonation");
  });
});
