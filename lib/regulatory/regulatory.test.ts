import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { checkEvidenceStudy } from "./check";
import { deterministicJson } from "./deterministic";
import {
	regulatoryEvidenceStudySchema,
	type EvidenceCitation,
	type RegulatoryEvidenceStudy,
	type SourceDocument,
} from "./schema";
import { verifySourceLocks } from "./source-lock";

const lockedContents = "locked source\n";
const lockedHash = createHash("sha256").update(lockedContents).digest("hex");

function source(id = "source-a"): SourceDocument {
	return {
		id,
		issuingAuthority: "Ministerio de ejemplo",
		officialTitle: `Reglamento ${id}`,
		edition: "Primera edición",
		revision: "Revisión 2026",
		adoptionInstrument: "Decreto 1 de 2026",
		amendmentsAndErrata: [
			{
				kind: "erratum" as const,
				reference: "Fe de erratas 1",
				issuedOn: "2026-02-02",
				officialUrl: "https://example.gov.co/errata",
			},
		],
		legalStatus: "active" as const,
		applicabilityStatus: "applicable" as const,
		officialUrl: "https://example.gov.co/regulation.pdf",
		retrievedOn: "2026-07-22",
		redistribution: {
			decision: "bundled" as const,
			localPath: "source.txt",
			rationale: "Official source is redistributable.",
		},
		mediaType: "text/plain",
		pageCount: 2,
		sha256: lockedHash,
		pages: [
			{
				physicalPage: 1,
				printedPage: "A-1",
				rotationDegrees: 0 as const,
				crop: { left: 0, top: 0, width: 1, height: 1 },
			},
		],
	};
}

function citation(
	id: string,
	regionKind: "cell" | "clause" | "applicability",
	extractedToken: string,
): EvidenceCitation {
	return {
		id,
		sourceDocumentId: "source-a",
		regionKind,
		physicalPage: 1,
		printedPage: "A-1",
		reference: `Reference ${id}`,
		rect: { left: 0.1, top: 0.1, width: 0.2, height: 0.1 },
		extractedToken,
		normalizedNumericValue: regionKind === "cell" ? 1 : undefined,
		unit: regionKind === "cell" ? "g" : undefined,
		transformation: regionKind === "cell" ? "decimal parse" : undefined,
		requiredTokens: [extractedToken],
	};
}

function fixture(): RegulatoryEvidenceStudy {
	return {
		schemaVersion: 1 as const,
		studyId: "study-a",
		title: "Study A",
		sources: [source()],
		citations: [
			citation("cell-base", "cell", "1.00"),
			citation("clause-formula", "clause", "R = B × 2"),
			citation("applicability", "applicability", "Applies nationally"),
		],
		applicabilityCitationIds: ["applicability"],
		coverage: {
			optionIds: ["option-a"],
			hazardIds: ["hazard-a"],
			fieldIds: ["base", "result"],
		},
		values: [
			{
				id: "value-base",
				optionId: "option-a",
				hazardId: "hazard-a",
				fieldId: "base",
				value: 1,
				unit: "g",
				provenance: "direct-source" as const,
				citationIds: ["cell-base"],
			},
			{
				id: "value-result",
				optionId: "option-a",
				hazardId: "hazard-a",
				fieldId: "result",
				value: 2,
				unit: "g",
				provenance: "derived" as const,
				citationIds: [],
				derivedLineage: {
					dependencyValueIds: ["value-base"],
					citationIds: ["clause-formula"],
					formula: "R = B × 2",
					substitution: "1 g × 2",
					result: 2,
					unit: "g",
				},
			},
		],
		rawRows: [
			{
				id: "raw-a",
				rowKey: "option-a/hazard-a",
				sourceDocumentId: "source-a",
				optionId: "option-a",
				hazardId: "hazard-a",
				citationIds: ["cell-base"],
				fields: { base: 1 },
			},
		],
		canonicalRows: [
			{
				id: "canonical-a",
				rowKey: "option-a/hazard-a",
				sourceDocumentId: "source-a",
				optionId: "option-a",
				hazardId: "hazard-a",
				citationIds: ["cell-base"],
				fields: { base: 1, result: 2 },
				sourceRowIds: ["raw-a"],
			},
		],
		overrides: [],
	};
}

describe("regulatory evidence contracts", () => {
	it("accepts multiple documents and complete regulatory metadata", () => {
		const study = fixture();
		study.sources.push({
			...source("source-b"),
			legalStatus: "historical",
			applicabilityStatus: "historical",
			redistribution: {
				decision: "external-only",
				rationale: "The authority does not grant redistribution rights.",
			},
		});
		expect(regulatoryEvidenceStudySchema.parse(study).sources).toHaveLength(2);
	});

	it("produces exact deterministic coverage, citation, hash, and size reporting", () => {
		const report = checkEvidenceStudy(fixture(), {
			artifacts: { canonical: "one\n", raw: "two\n" },
		});
		expect(report).toMatchObject({
			studyId: "study-a",
			rawRows: { count: 1, ids: ["raw-a"] },
			canonicalRows: { count: 1, ids: ["canonical-a"] },
			duplicates: [],
			overrides: [],
			citations: { cell: ["cell-base"], clause: ["clause-formula"] },
			uncoveredValues: [],
			sizes: { canonical: 4, raw: 4 },
		});
		expect(report.hashes.canonical).toMatch(/^[a-f0-9]{64}$/);
		const serialized = deterministicJson(report);
		expect(serialized.endsWith("\n")).toBe(true);
		expect(serialized).toBe(deterministicJson(report));
	});

	it("rejects a direct value without a citation", () => {
		const study = fixture();
		study.values[0].citationIds = [];
		expect(() => checkEvidenceStudy(study)).toThrow(
			/Direct-source values require a citation/,
		);
	});

	it("rejects missing citations and derived dependencies", () => {
		const missingCitation = fixture();
		missingCitation.values[0].citationIds = ["missing"];
		expect(() => checkEvidenceStudy(missingCitation)).toThrow(/missing citation missing/);

		const missingDependency = fixture();
		missingDependency.values[1].derivedLineage!.dependencyValueIds = ["missing"];
		expect(() => checkEvidenceStudy(missingDependency)).toThrow(
			/missing dependency missing/,
		);
	});

	it("rejects derived lineage whose emitted result or unit differs", () => {
		const study = fixture();
		study.values[1].derivedLineage!.result = 3;
		expect(() => checkEvidenceStudy(study)).toThrow(/lineage result or unit differs/);
	});

	it("rejects duplicate IDs and duplicate covered values", () => {
		const duplicateId = fixture();
		duplicateId.citations.push({ ...duplicateId.citations[0] });
		expect(() => checkEvidenceStudy(duplicateId)).toThrow(/Duplicate citation id cell-base/);

		const duplicateValue = fixture();
		duplicateValue.values.push({ ...duplicateValue.values[0], id: "value-copy" });
		expect(() => checkEvidenceStudy(duplicateValue)).toThrow(/Duplicate covered value/);
	});

	it("rejects incomplete option×hazard×field coverage", () => {
		const study = fixture();
		study.coverage.hazardIds.push("hazard-b");
		expect(() => checkEvidenceStudy(study)).toThrow(
			/Incomplete option×hazard×field coverage/,
		);
	});

	it("rejects invalid normalized geometry", () => {
		const study = fixture();
		study.citations[0].rect = { left: 0.9, top: 0.1, width: 0.2, height: 0.1 };
		expect(() => checkEvidenceStudy(study)).toThrow(/fit within the page width/);
	});

	it("rejects a cell outside its cited row and unexpected source rows", () => {
		const badParent = fixture();
		badParent.citations.push({
			...citation("row-base", "cell", "row"),
			regionKind: "row",
			rect: { left: 0.1, top: 0.1, width: 0.05, height: 0.05 },
		});
		badParent.citations[0].parentCitationId = "row-base";
		expect(() => checkEvidenceStudy(badParent)).toThrow(/not contained by its parent/);

		const unexpectedRow = fixture();
		unexpectedRow.rawRows[0].optionId = "unexpected";
		expect(() => checkEvidenceStudy(unexpectedRow)).toThrow(
			/outside declared option\/hazard coverage/,
		);

		const cyclicCitation = fixture();
		cyclicCitation.citations[0].parentCitationId = "cell-base";
		expect(() => checkEvidenceStudy(cyclicCitation)).toThrow(/Citation parent cycle/);
	});

	it("rejects a duplicate row without an explicit override", () => {
		const study = fixture();
		study.rawRows.push({ ...study.rawRows[0], id: "raw-b" });
		expect(() => checkEvidenceStudy(study)).toThrow(/Undeclared.*duplicate row/);
	});

	it("accepts a reviewed override and rejects orphan overrides", () => {
		const study = fixture();
		study.rawRows.push({ ...study.rawRows[0], id: "raw-b" });
		study.overrides.push({
			id: "override-a",
			affected: { sourceDocumentId: "source-a", optionId: "option-a" },
			reason: "The source prints the same option twice.",
			competingOccurrences: [
				{ rawRowId: "raw-a", citationId: "cell-base" },
				{ rawRowId: "raw-b", citationId: "cell-base" },
			],
			chosenOccurrenceRawRowId: "raw-b",
			author: "Analyst One",
			independentReviewer: "Reviewer Two",
			reviewDate: "2026-07-22",
		});
		expect(checkEvidenceStudy(study).duplicates).toEqual([
			{
				rowKey: "option-a/hazard-a",
				rawRowIds: ["raw-a", "raw-b"],
				overrideId: "override-a",
			},
		]);

		const orphan = fixture();
		orphan.overrides = study.overrides;
		expect(() => checkEvidenceStudy(orphan)).toThrow(/Orphan override override-a/);

		const selfReviewed = structuredClone(study);
		selfReviewed.overrides[0].independentReviewer = "Analyst One";
		expect(() => checkEvidenceStudy(selfReviewed)).toThrow(
			/author and independent reviewer must differ/,
		);
	});

	it("rejects orphan citations", () => {
		const study = fixture();
		study.citations.push(citation("unused-note", "clause", "Unused"));
		expect(() => checkEvidenceStudy(study)).toThrow(/Orphan citations: unused-note/);
	});
});

describe("source locks", () => {
	it("returns deterministic hashes and rejects source-lock drift", async () => {
		const directory = mkdtempSync(resolve(tmpdir(), "regulatory-source-lock-"));
		writeFileSync(resolve(directory, "source.txt"), lockedContents, "utf8");
		try {
			await expect(verifySourceLocks([source()], directory)).resolves.toEqual([
				{
					id: "source-a",
					localPath: "source.txt",
					sha256: lockedHash,
					size: Buffer.byteLength(lockedContents),
					pageCount: 2,
				},
			]);
			const pdfSource = { ...source(), mediaType: "application/pdf" };
			await expect(verifySourceLocks([pdfSource], directory)).rejects.toThrow(
				/requires a page-count reader/,
			);
			await expect(
				verifySourceLocks([pdfSource], directory, { readPageCount: () => 1 }),
			).rejects.toThrow(/Source page-count drift for source-a/);
			writeFileSync(resolve(directory, "source.txt"), "drift\n", "utf8");
			await expect(verifySourceLocks([source()], directory)).rejects.toThrow(
				/Source lock drift for source-a/,
			);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
