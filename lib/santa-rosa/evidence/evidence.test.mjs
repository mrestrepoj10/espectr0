import { describe, expect, it } from "vitest";
import { check } from "./study.mjs";
describe("Santa Rosa de Cabal evidence dossier", () => { it("passes F3 gates and remains fail-closed", async () => { const report = await check({ repositoryRoot: process.cwd() }); expect(report.studyId).toBe("santa-rosa-de-cabal-microzonation"); }); });
