import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { fixtureStudy } from "./evidence/study.mjs";
import {
	checkEvidenceStudy,
	deterministicJson,
	evidenceCheckReportSchema,
	regulatoryEvidenceStudySchema,
	runInstalledDescriptors,
	validateInstalledDescriptors,
	verifySourceLocks,
	type EvidenceCitation,
	type EvidenceOverride,
	type RegulatoryEvidenceStudy,
	type SourceDocument,
} from "./runtime.mjs";

const repositoryRoot = process.cwd();

function fixture(): RegulatoryEvidenceStudy {
	return structuredClone(fixtureStudy);
}

function duplicateCitation(id: string, value = 1): EvidenceCitation {
	return {
		...fixture().citations.find(({ id: citationId }) => citationId === "fixture-cell-base")!,
		id,
		rect: { left: 0.35, top: 0.15, width: 0.1, height: 0.05 },
		extractedToken: value.toFixed(2),
		normalizedValue: value,
		normalizedNumericValue: value,
		requiredTokens: [value.toFixed(2)],
	};
}

function addDuplicate(study: RegulatoryEvidenceStudy, value = 1): EvidenceOverride {
	study.citations.push(duplicateCitation("fixture-cell-duplicate", value));
	study.rawRows.push({
		...structuredClone(study.rawRows[0]),
		id: "fixture-raw-duplicate",
		citationIds: ["fixture-cell-duplicate"],
		fields: { base: value, result: 2 },
	});
	const override: EvidenceOverride = {
		id: "fixture-override",
		affected: { sourceDocumentId: "fixture-bundled", optionId: "option-a" },
		reason: "The fixture intentionally repeats the option row.",
		competingOccurrences: [
			{ rawRowId: "fixture-raw", fieldCitationIds: { base: ["fixture-cell-base"] } },
			{
				rawRowId: "fixture-raw-duplicate",
				fieldCitationIds: { base: ["fixture-cell-duplicate"] },
			},
		],
		chosenOccurrenceRawRowId: "fixture-raw-duplicate",
		author: "Fixture Author",
		independentReviewer: "Fixture Reviewer",
		reviewDate: "2026-07-22",
	};
	study.overrides.push(override);
	return override;
}

function twoDirectFieldDuplicateStudy(): RegulatoryEvidenceStudy {
	const study = fixture();
	const resultValue = study.values.find(({ fieldId }) => fieldId === "result")!;
	resultValue.provenance = "direct-source";
	resultValue.citationIds = ["fixture-cell-result"];
	resultValue.transformation = "decimal parse";
	delete resultValue.derivedLineage;
	study.citations = study.citations.filter(({ id }) => id !== "fixture-formula");

	const firstResult = duplicateCitation("fixture-cell-result", 2);
	firstResult.rect = { left: 0.35, top: 0.15, width: 0.1, height: 0.05 };
	study.citations.push(firstResult);
	study.rawRows[0].citationIds = ["fixture-cell-base", "fixture-cell-result"];
	study.canonicalRows[0].citationIds = ["fixture-cell-base", "fixture-cell-result"];

	const secondRow = structuredClone(
		study.citations.find(({ id }) => id === "fixture-row")!,
	);
	secondRow.id = "fixture-row-duplicate";
	secondRow.rect = { left: 0.1, top: 0.31, width: 0.6, height: 0.1 };
	const secondBase = duplicateCitation("fixture-cell-duplicate-base", 1);
	secondBase.parentCitationId = secondRow.id;
	secondBase.rect = { left: 0.2, top: 0.33, width: 0.1, height: 0.04 };
	const secondResult = duplicateCitation("fixture-cell-duplicate-result", 2);
	secondResult.parentCitationId = secondRow.id;
	secondResult.rect = { left: 0.35, top: 0.33, width: 0.1, height: 0.04 };
	study.citations.push(secondRow, secondBase, secondResult);

	study.rawRows.push({
		...structuredClone(study.rawRows[0]),
		id: "fixture-raw-duplicate",
		citationIds: [secondBase.id, secondResult.id],
	});
	study.canonicalRows[0].citationIds = [secondBase.id, secondResult.id];
	study.canonicalRows[0].sourceRowIds = ["fixture-raw-duplicate"];
	study.overrides.push({
		id: "fixture-override",
		affected: { sourceDocumentId: "fixture-bundled", optionId: "option-a" },
		reason: "The fixture intentionally repeats a row with two direct fields.",
		competingOccurrences: [
			{
				rawRowId: "fixture-raw",
				fieldCitationIds: {
					base: ["fixture-cell-base"],
					result: ["fixture-cell-result"],
				},
			},
			{
				rawRowId: "fixture-raw-duplicate",
				fieldCitationIds: {
					base: [secondBase.id],
					result: [secondResult.id],
				},
			},
		],
		chosenOccurrenceRawRowId: "fixture-raw-duplicate",
		author: "Fixture Author",
		independentReviewer: "Fixture Reviewer",
		reviewDate: "2026-07-22",
	});
	return study;
}

describe("valid generic runtime", () => {
	it("checks an installed multi-document study with mandatory bundled locks", async () => {
		const report = await checkEvidenceStudy(fixture(), { repositoryRoot });
		expect(report).toMatchObject({
			schemaVersion: 1,
			studyId: "framework-fixture",
			rawRows: { count: 1, ids: ["fixture-raw"] },
			canonicalRows: { count: 1, ids: ["fixture-canonical"] },
			coverage: {
				expectedRows: 1,
				expectedValues: 2,
				bundledSources: 1,
			},
			sourceLocks: [
				{
					id: "fixture-bundled",
					sha256:
						"8e9b737c440ad0da747afcb669ac64306b6d22ed95fbe91dc82e4163897f5204",
					pageCount: 1,
				},
			],
			uncoveredValues: [],
		});
		expect(report.citations).toMatchObject({ table: 1, row: 1, cell: 1, equation: 1 });
		expect(report.hashes.study).toMatch(/^[a-f0-9]{64}$/);
		expect(deterministicJson(report)).toBe(deterministicJson(report));
	});

	it("accepts a field cell or its row ancestry as exact row support", async () => {
		await expect(checkEvidenceStudy(fixture(), { repositoryRoot })).resolves.toMatchObject({
			studyId: "framework-fixture",
		});

		const rowAncestry = fixture();
		rowAncestry.rawRows[0].citationIds = ["fixture-row"];
		rowAncestry.canonicalRows[0].citationIds = ["fixture-row"];
		await expect(checkEvidenceStudy(rowAncestry, { repositoryRoot })).resolves.toMatchObject({
			studyId: "framework-fixture",
		});
	});

	it("accepts a duplicate only when canonicalization uses its reviewed selection", async () => {
		const study = fixture();
		addDuplicate(study);
		study.canonicalRows[0].sourceRowIds = ["fixture-raw-duplicate"];
		study.canonicalRows[0].citationIds = ["fixture-cell-duplicate"];
		const report = await checkEvidenceStudy(study, { repositoryRoot });
		expect(report.duplicates).toEqual([
			{
				rowKey: "option-a/hazard-a",
				rawRowIds: ["fixture-raw", "fixture-raw-duplicate"],
				overrideId: "fixture-override",
			},
		]);
		expect(report.overrides[0]).toMatchObject({
			selectedRawRowId: "fixture-raw-duplicate",
			reviewStatus: "reviewed",
		});
	});

	it("accepts complete field-scoped evidence for both occurrences of a two-direct-field duplicate", async () => {
		await expect(
			checkEvidenceStudy(twoDirectFieldDuplicateStudy(), { repositoryRoot }),
		).resolves.toMatchObject({
			duplicates: [
				{
					rowKey: "option-a/hazard-a",
					rawRowIds: ["fixture-raw", "fixture-raw-duplicate"],
					overrideId: "fixture-override",
				},
			],
		});
	});
});

describe("mandatory source policy", () => {
	it("binds normalized citation transcriptions to extracted locked text", async () => {
		const normalizedWhitespace = fixture();
		normalizedWhitespace.citations[0].extractedToken = "Table F-1   base 1.00";
		await expect(
			checkEvidenceStudy(normalizedWhitespace, { repositoryRoot }),
		).resolves.toMatchObject({ studyId: "framework-fixture" });

		const fabricated = fixture();
		fabricated.citations[2].extractedToken = "fabricated cell 42.00";
		fabricated.citations[2].requiredTokens = ["42.00"];
		await expect(checkEvidenceStudy(fabricated, { repositoryRoot })).rejects.toThrow(
			/Citation fixture-cell-base transcription is absent from locked source fixture-bundled/,
		);
	});

	it("derives normalized values from the locked token transformation", async () => {
		await expect(checkEvidenceStudy(fixture(), { repositoryRoot })).resolves.toMatchObject({
			studyId: "framework-fixture",
		});

		const mismatched = fixture();
		const baseCitation = mismatched.citations.find(
			({ id }) => id === "fixture-cell-base",
		)!;
		baseCitation.extractedToken = "999.00";
		baseCitation.requiredTokens = ["999.00"];
		await expect(checkEvidenceStudy(mismatched, { repositoryRoot })).rejects.toThrow(
			/Citation fixture-cell-base transformation decimal parse produced 999, not normalized value 1/,
		);
	});

	it("rejects unsupported transformations and units on normalized text", async () => {
		const unsupported = fixture();
		unsupported.citations[2].transformation = "caller-defined parse";
		unsupported.values[0].transformation = "caller-defined parse";
		await expect(checkEvidenceStudy(unsupported, { repositoryRoot })).rejects.toThrow(
			/Citation fixture-cell-base uses unsupported normalization transformation caller-defined parse/,
		);

		const unitBearingText = fixture();
		unitBearingText.citations[2].extractedToken = "option-a";
		unitBearingText.citations[2].requiredTokens = ["option-a"];
		unitBearingText.citations[2].normalizedValue = "option-a";
		delete unitBearingText.citations[2].normalizedNumericValue;
		unitBearingText.citations[2].transformation = "text identity";
		await expect(checkEvidenceStudy(unitBearingText, { repositoryRoot })).rejects.toThrow(
			/Citation fixture-cell-base text identity requires no numeric mirror or unit/,
		);
	});

	it("rejects claimed regions absent from an unrelated hash-matching PDF", async () => {
		const unrelatedPdf = fixture();
		unrelatedPdf.sources[0].mediaType = "application/pdf";
		unrelatedPdf.sources[0].pageCount = 206;
		unrelatedPdf.sources[0].sha256 =
			"47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0";
		unrelatedPdf.sources[0].redistribution.localPath =
			"public/nsr10-titulo-a-2017.pdf";
		await expect(checkEvidenceStudy(unrelatedPdf, { repositoryRoot })).rejects.toThrow(
			/Citation fixture-table transcription is absent from locked source fixture-bundled/,
		);
	}, 30_000);

	it("cannot bypass bundled hash verification", async () => {
		const study = fixture();
		study.sources[0].sha256 = "f".repeat(64);
		await expect(checkEvidenceStudy(study, { repositoryRoot })).rejects.toThrow(
			/Source lock drift for fixture-bundled/,
		);
		await expect(
			checkEvidenceStudy(fixture(), undefined as never),
		).rejects.toThrow(/repositoryRoot is required/);

		const escaped = fixture();
		escaped.sources[0].redistribution.localPath = "../outside-source.txt";
		await expect(checkEvidenceStudy(escaped, { repositoryRoot })).rejects.toThrow(
			/local path escapes the repository root/,
		);
	});

	it("verifies bundled PDF page counts from bytes and detects drift", async () => {
		const source: SourceDocument = {
			...fixture().sources[0],
			id: "nsr-page-drift-fixture",
			mediaType: "application/pdf",
			pageCount: 205,
			sha256: "47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0",
			redistribution: {
				decision: "bundled",
				localPath: "public/nsr10-titulo-a-2017.pdf",
				rationale: "Fixture",
			},
		};
		await expect(verifySourceLocks([source], repositoryRoot)).rejects.toThrow(
			/Source page-count drift.*expected 205, found 206/,
		);
	});

	it("requires bundled paths and forbids paths for external-only/restricted sources", () => {
		const bundled = fixture();
		delete bundled.sources[0].redistribution.localPath;
		expect(() => regulatoryEvidenceStudySchema.parse(bundled)).toThrow(
			/Bundled sources require a local path/,
		);

		for (const decision of ["external-only", "restricted"] as const) {
			const study = fixture();
			study.sources[1].redistribution = {
				decision,
				localPath: "forbidden.pdf",
				rationale: "Fixture",
			};
			expect(() => regulatoryEvidenceStudySchema.parse(study)).toThrow(
				/External-only and restricted sources must be pathless/,
			);
		}
	});
});

describe("strict aggregate boundary", () => {
	it("rejects malformed/no-op reports and descriptor/result ID disagreement", async () => {
		const descriptor = { studyId: "study-a", check: async () => ({ studyId: "study-a" }) };
		await expect(
			runInstalledDescriptors([descriptor], { repositoryRoot }),
		).rejects.toThrow();
		const validReport = evidenceCheckReportSchema.parse(
			await checkEvidenceStudy(fixture(), { repositoryRoot }),
		);
		await expect(
			runInstalledDescriptors(
				[{ studyId: "study-a", check: async () => validReport }],
				{ repositoryRoot },
			),
		).rejects.toThrow(
			/Descriptor\/result study ID mismatch/,
		);

		const missingLocks = structuredClone(validReport);
		missingLocks.sourceLocks = [];
		await expect(
			runInstalledDescriptors(
				[{ studyId: "framework-fixture", check: async () => missingLocks }],
				{ repositoryRoot },
			),
		).rejects.toThrow(/source-lock coverage differs/i);

		const uncovered = structuredClone(validReport);
		uncovered.uncoveredValues = ["option-a/hazard-a/base"];
		await expect(
			runInstalledDescriptors(
				[{ studyId: "framework-fixture", check: async () => uncovered }],
				{ repositoryRoot },
			),
		).rejects.toThrow();
	});

	it("rejects duplicate installed IDs and propagates failing children", async () => {
		const descriptor = { studyId: "study-a", check: async () => ({}) };
		expect(() => validateInstalledDescriptors([descriptor, descriptor])).toThrow(
			/Duplicate installed study ID study-a/,
		);
		const failing = {
			studyId: "failing",
			check: async () => {
				throw new Error("child failed");
			},
		};
		await expect(
			runInstalledDescriptors([failing], { repositoryRoot }),
		).rejects.toThrow(/child failed/);
	});

	it("rejects contradictory duplicate/override sets and unexplained raw surplus", async () => {
		const validReport = evidenceCheckReportSchema.parse(
			await checkEvidenceStudy(fixture(), { repositoryRoot }),
		);
		const contradictory = structuredClone(validReport);
		contradictory.rawRows = {
			count: 3,
			ids: ["fixture-raw", "ghost-a", "ghost-b"],
		};
		contradictory.duplicates = [
			{
				rowKey: "option-a/hazard-a",
				rawRowIds: ["fixture-raw", "ghost-a"],
				overrideId: "fixture-override",
			},
		];
		contradictory.overrides = [
			{
				id: "fixture-override",
				competingRawRowIds: ["ghost-b", "missing-row"],
				selectedRawRowId: "missing-row",
				reviewStatus: "reviewed",
			},
		];
		const contradiction = runInstalledDescriptors(
			[{ studyId: "framework-fixture", check: async () => contradictory }],
			{ repositoryRoot },
		);
		await expect(contradiction).rejects.toThrow(/Invalid report override/);
		await expect(contradiction).rejects.toThrow(/duplicate\/override raw rows differ/);

		const unexplained = structuredClone(validReport);
		unexplained.rawRows = { count: 2, ids: ["fixture-raw", "ghost-row"] };
		await expect(
			runInstalledDescriptors(
				[{ studyId: "framework-fixture", check: async () => unexplained }],
				{ repositoryRoot },
			),
		).rejects.toThrow(/unexplained surplus/);
	});

	it("runs the plain-Node aggregate twice with byte-identical LF output", () => {
		const command = [resolve("scripts/regulatory/check-evidence.mjs"), "--check", "--report-json"];
		const first = execFileSync(process.execPath, command, { encoding: "utf8" });
		const second = execFileSync(process.execPath, command, { encoding: "utf8" });
		expect(second).toBe(first);
		expect(first.endsWith("\n")).toBe(true);
		const aggregate = JSON.parse(first);
		expect(aggregate.schemaVersion).toBe(1);
		expect(aggregate.installedStudies).toEqual(
			expect.arrayContaining(["framework-fixture", "medellin-microzonation", "nsr10"]),
		);
		expect(aggregate.installedStudies).toEqual([...aggregate.installedStudies].sort());
		expect(new Set(aggregate.installedStudies).size).toBe(aggregate.installedStudies.length);
		expect(aggregate.studies.find(({ studyId }: { studyId: string }) => studyId === "framework-fixture")).toMatchObject({
			studyId: "framework-fixture",
			coverage: { bundledSources: 1 },
		});
		expect(aggregate.studies.find(({ studyId }: { studyId: string }) => studyId === "nsr10")).toMatchObject({
			studyId: "nsr10",
			coverage: { expectedRows: 1_123 },
		});
		expect(aggregate.studies.find(({ studyId }: { studyId: string }) => studyId === "medellin-microzonation")).toMatchObject({
			studyId: "medellin-microzonation",
			coverage: { expectedRows: 28, expectedValues: 168 },
			uncoveredValues: [],
		});
	}, 30_000);
});

describe("override/canonical binding", () => {
	it("rejects cell and parent-row support borrowed across duplicate occurrences", async () => {
		const borrowedCell = twoDirectFieldDuplicateStudy();
		borrowedCell.rawRows[1].citationIds = [
			"fixture-cell-duplicate-base",
			"fixture-cell-result",
		];
		await expect(checkEvidenceStudy(borrowedCell, { repositoryRoot })).rejects.toThrow(
			/Raw row fixture-raw-duplicate citation fixture-cell-result is not row\/cell evidence/,
		);

		const borrowedParent = twoDirectFieldDuplicateStudy();
		borrowedParent.rawRows[1].citationIds = [
			"fixture-cell-duplicate-base",
			"fixture-row",
		];
		await expect(checkEvidenceStudy(borrowedParent, { repositoryRoot })).rejects.toThrow(
			/Raw row fixture-raw-duplicate citation fixture-row is not row\/cell evidence/,
		);
	});

	it("rejects an override whose canonical row uses the unselected occurrence", async () => {
		const study = fixture();
		addDuplicate(study, 999);
		await expect(checkEvidenceStudy(study, { repositoryRoot })).rejects.toThrow(
			/does not use override fixture-override selection/,
		);
	});

	it("rejects reused occurrence citations and regions", async () => {
		const study = fixture();
		const override = addDuplicate(study);
		override.competingOccurrences[1].fieldCitationIds.base = ["fixture-cell-base"];
		await expect(checkEvidenceStudy(study, { repositoryRoot })).rejects.toThrow(
			/Duplicate override occurrence citation/,
		);

		const repeatedRegion = fixture();
		addDuplicate(repeatedRegion);
		repeatedRegion.citations.find(({ id }) => id === "fixture-cell-duplicate")!.rect =
			structuredClone(
				repeatedRegion.citations.find(({ id }) => id === "fixture-cell-base")!.rect,
			);
		await expect(checkEvidenceStudy(repeatedRegion, { repositoryRoot })).rejects.toThrow(
			/Duplicate override occurrence region/,
		);
	});

	it("rejects undeclared duplicate rows and orphan overrides", async () => {
		const duplicate = fixture();
		duplicate.citations.push(duplicateCitation("fixture-cell-duplicate"));
		duplicate.rawRows.push({
			...structuredClone(duplicate.rawRows[0]),
			id: "fixture-raw-duplicate",
			citationIds: ["fixture-cell-duplicate"],
		});
		await expect(checkEvidenceStudy(duplicate, { repositoryRoot })).rejects.toThrow(
			/Undeclared or ambiguously overridden duplicate row/,
		);

		const orphan = fixture();
		orphan.overrides.push(addDuplicate(fixture()));
		await expect(checkEvidenceStudy(orphan, { repositoryRoot })).rejects.toThrow(
			/Orphan override/,
		);
	});
});

describe("exact rows and values", () => {
	it("rejects missing, partial, extra, and unconsumed rows", async () => {
		const missing = fixture();
		missing.canonicalRows = [];
		await expect(checkEvidenceStudy(missing, { repositoryRoot })).rejects.toThrow();

		const partial = fixture();
		delete partial.rawRows[0].fields.result;
		await expect(checkEvidenceStudy(partial, { repositoryRoot })).rejects.toThrow(
			/does not contain the exact field set/,
		);

		const extra = fixture();
		extra.rawRows.push({
			...structuredClone(extra.rawRows[0]),
			id: "extra-raw",
			rowKey: "extra/hazard-a",
			optionId: "extra",
		});
		await expect(checkEvidenceStudy(extra, { repositoryRoot })).rejects.toThrow(
			/unexpected row key/,
		);
	});

	it("rejects canonical fields that differ from selected source or values", async () => {
		const sourceMismatch = fixture();
		sourceMismatch.canonicalRows[0].fields.base = 9;
		await expect(checkEvidenceStudy(sourceMismatch, { repositoryRoot })).rejects.toThrow(
			/differs from selected raw occurrence/,
		);

		const valueMismatch = fixture();
		valueMismatch.rawRows[0].fields.result = 3;
		valueMismatch.canonicalRows[0].fields.result = 3;
		await expect(checkEvidenceStudy(valueMismatch, { repositoryRoot })).rejects.toThrow(
			/field result differs from its value/,
		);
	});

	it("binds raw and canonical row sources to their citation ancestry", async () => {
		const rawMismatch = fixture();
		rawMismatch.rawRows[0].sourceDocumentId = "fixture-external";
		await expect(checkEvidenceStudy(rawMismatch, { repositoryRoot })).rejects.toThrow(
			/Raw row fixture-raw citation fixture-cell-base has source ancestry outside fixture-external/,
		);

		const canonicalMismatch = fixture();
		canonicalMismatch.canonicalRows[0].sourceDocumentId = "fixture-external";
		await expect(checkEvidenceStudy(canonicalMismatch, { repositoryRoot })).rejects.toThrow(
			/Canonical row fixture-canonical citation fixture-cell-base has source ancestry outside fixture-external/,
		);
	});

	it("rejects applicability evidence substituted for raw or canonical field-row support", async () => {
		const exactReproduction = fixture();
		for (const row of [
			...exactReproduction.rawRows,
			...exactReproduction.canonicalRows,
		]) {
			row.sourceDocumentId = "fixture-external";
			row.citationIds = ["fixture-applicability"];
		}
		await expect(checkEvidenceStudy(exactReproduction, { repositoryRoot })).rejects.toThrow(
			/Raw row fixture-raw citation fixture-applicability is not row\/cell evidence for its direct\/interpolated fields/,
		);

		const rawApplicability = fixture();
		rawApplicability.rawRows[0].sourceDocumentId = "fixture-external";
		rawApplicability.rawRows[0].citationIds = ["fixture-applicability"];
		await expect(checkEvidenceStudy(rawApplicability, { repositoryRoot })).rejects.toThrow(
			/Raw row fixture-raw citation fixture-applicability is not row\/cell evidence for its direct\/interpolated fields/,
		);

		const canonicalApplicability = fixture();
		canonicalApplicability.canonicalRows[0].sourceDocumentId = "fixture-external";
		canonicalApplicability.canonicalRows[0].citationIds = ["fixture-applicability"];
		await expect(checkEvidenceStudy(canonicalApplicability, { repositoryRoot })).rejects.toThrow(
			/Canonical row fixture-canonical citation fixture-applicability is not row\/cell evidence for its direct\/interpolated fields/,
		);
	});

	it("rejects duplicate values and incomplete Cartesian coverage", async () => {
		const duplicate = fixture();
		duplicate.values.push({ ...structuredClone(duplicate.values[0]), id: "duplicate-value" });
		await expect(checkEvidenceStudy(duplicate, { repositoryRoot })).rejects.toThrow(
			/Duplicate covered value/,
		);

		const incomplete = fixture();
		incomplete.coverage.hazardIds.push("hazard-b");
		await expect(checkEvidenceStudy(incomplete, { repositoryRoot })).rejects.toThrow(
			/Incomplete option×hazard×field coverage/,
		);
	});
});

describe("page, hierarchy, and direct evidence", () => {
	it("requires metadata and printed labels for every cited physical page", async () => {
		const missingPage = fixture();
		missingPage.citations[4].physicalPage = 2;
		missingPage.sources[1].pageCount = 2;
		await expect(checkEvidenceStudy(missingPage, { repositoryRoot })).rejects.toThrow(
			/has no physical page metadata/,
		);

		const printedMismatch = fixture();
		printedMismatch.citations[4].printedPage = "A-1";
		await expect(checkEvidenceStudy(printedMismatch, { repositoryRoot })).rejects.toThrow(
			/printed page differs/,
		);
	});

	it("requires table→row→cell containment and exact cell evidence", async () => {
		const clause = fixture();
		clause.citations[2].regionKind = "clause";
		delete clause.citations[2].parentCitationId;
		await expect(checkEvidenceStudy(clause, { repositoryRoot })).rejects.toThrow(
			/Direct value fixture-value-base requires cell evidence/,
		);

		const containment = fixture();
		containment.citations[2].rect = { left: 0.75, top: 0.15, width: 0.1, height: 0.05 };
		await expect(checkEvidenceStudy(containment, { repositoryRoot })).rejects.toThrow(
			/not contained by its parent/,
		);

		const invalidGeometry = fixture();
		invalidGeometry.citations[2].rect = {
			left: 0.95,
			top: 0.15,
			width: 0.1,
			height: 0.05,
		};
		await expect(checkEvidenceStudy(invalidGeometry, { repositoryRoot })).rejects.toThrow(
			/fit within the page width/,
		);
	});

	it("checks non-numeric direct transcription, unit, and transformation", async () => {
		const study = fixture();
		study.values[0].value = "different";
		study.values[0].unit = null;
		study.values[0].transformation = "text identity";
		study.rawRows[0].fields.base = "different";
		study.canonicalRows[0].fields.base = "different";
		study.citations[2].extractedToken = "option-a";
		study.citations[2].requiredTokens = ["option-a"];
		study.citations[2].normalizedValue = "option-a";
		delete study.citations[2].normalizedNumericValue;
		study.citations[2].unit = null;
		study.citations[2].transformation = "text identity";
		await expect(checkEvidenceStudy(study, { repositoryRoot })).rejects.toThrow(
			/does not match its exact cell transcription/,
		);
	});
});

describe("role-based derived lineage", () => {
	it("requires a clause/equation formula citation", async () => {
		const study = fixture();
		study.citations[3].regionKind = "warning";
		await expect(checkEvidenceStudy(study, { repositoryRoot })).rejects.toThrow(
			/requires a clause\/equation formula citation/,
		);
	});

	it("rejects unrelated input citations and missing/cyclic dependencies", async () => {
		const unrelated = fixture();
		unrelated.values[1].derivedLineage!.dependencies[0].inputCitationIds = [
			"fixture-applicability",
		];
		await expect(checkEvidenceStudy(unrelated, { repositoryRoot })).rejects.toThrow(
			/unrelated input citation/,
		);

		const missing = fixture();
		missing.values[1].derivedLineage!.dependencies[0].valueId = "missing";
		await expect(checkEvidenceStudy(missing, { repositoryRoot })).rejects.toThrow(
			/missing dependency missing/,
		);

		const cyclic = fixture();
		cyclic.values[1].derivedLineage!.dependencies[0].valueId = "fixture-value-result";
		await expect(checkEvidenceStudy(cyclic, { repositoryRoot })).rejects.toThrow(
			/cannot depend on itself|dependency cycle/,
		);
	});
});

describe("duplicate and orphan identities", () => {
	it("rejects missing, duplicate, and orphan citations", async () => {
		const missing = fixture();
		missing.values[0].citationIds = ["missing-citation"];
		await expect(checkEvidenceStudy(missing, { repositoryRoot })).rejects.toThrow(
			/references missing citation missing-citation/,
		);

		const duplicate = fixture();
		duplicate.citations.push(structuredClone(duplicate.citations[0]));
		await expect(checkEvidenceStudy(duplicate, { repositoryRoot })).rejects.toThrow(
			/Duplicate citation id/,
		);

		const orphan = fixture();
		orphan.citations.push({
			...structuredClone(orphan.citations[3]),
			id: "orphan-clause",
		});
		await expect(checkEvidenceStudy(orphan, { repositoryRoot })).rejects.toThrow(
			/Orphan citations: orphan-clause/,
		);
	});
});
