import { createHash } from "node:crypto";

import {
	regulatoryEvidenceStudySchema,
	type RegulatoryEvidenceStudy,
} from "./schema";
import type { VerifiedSourceLock } from "./source-lock";

type Artifact = string | Uint8Array;

export type EvidenceCheckReport = {
	studyId: string;
	rawRows: { count: number; ids: string[] };
	canonicalRows: { count: number; ids: string[] };
	duplicates: Array<{ rowKey: string; rawRowIds: string[]; overrideId: string }>;
	overrides: RegulatoryEvidenceStudy["overrides"];
	citations: { clause: string[]; cell: string[] };
	uncoveredValues: string[];
	hashes: Record<string, string>;
	sizes: Record<string, number>;
	sourceLocks: VerifiedSourceLock[];
};

function assertUniqueIds<T extends { id: string }>(
	label: string,
	items: T[],
): Map<string, T> {
	const index = new Map<string, T>();
	for (const item of items) {
		if (index.has(item.id)) throw new Error(`Duplicate ${label} id ${item.id}`);
		index.set(item.id, item);
	}
	return index;
}

function assertUniqueStrings(label: string, values: string[]): void {
	const seen = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) throw new Error(`Duplicate ${label} ${value}`);
		seen.add(value);
	}
}

function hashArtifact(value: Artifact): { hash: string; size: number } {
	const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : value;
	return {
		hash: createHash("sha256").update(bytes).digest("hex"),
		size: bytes.byteLength,
	};
}

function coverageKey(optionId: string, hazardId: string, fieldId: string): string {
	return `${optionId}\u0000${hazardId}\u0000${fieldId}`;
}

function containsRect(
	outer: { left: number; top: number; width: number; height: number },
	inner: { left: number; top: number; width: number; height: number },
): boolean {
	return (
		inner.left >= outer.left &&
		inner.top >= outer.top &&
		inner.left + inner.width <= outer.left + outer.width &&
		inner.top + inner.height <= outer.top + outer.height
	);
}

function assertNoDerivedCycles(study: RegulatoryEvidenceStudy): void {
	const dependencies = new Map(
		study.values.map((value) => [
			value.id,
			value.derivedLineage?.dependencyValueIds ?? [],
		]),
	);
	const active = new Set<string>();
	const complete = new Set<string>();

	function visit(id: string): void {
		if (active.has(id)) throw new Error(`Derived dependency cycle at ${id}`);
		if (complete.has(id)) return;
		active.add(id);
		for (const dependencyId of dependencies.get(id) ?? []) visit(dependencyId);
		active.delete(id);
		complete.add(id);
	}

	for (const id of dependencies.keys()) visit(id);
}

function assertNoCitationCycles(study: RegulatoryEvidenceStudy): void {
	const parents = new Map(
		study.citations.map((citation) => [citation.id, citation.parentCitationId]),
	);
	for (const citation of study.citations) {
		const seen = new Set<string>();
		let currentId: string | undefined = citation.id;
		while (currentId) {
			if (seen.has(currentId)) throw new Error(`Citation parent cycle at ${currentId}`);
			seen.add(currentId);
			currentId = parents.get(currentId);
		}
	}
}

export function checkEvidenceStudy(
	input: unknown,
	options: {
		artifacts?: Record<string, Artifact>;
		sourceLocks?: VerifiedSourceLock[];
	} = {},
): EvidenceCheckReport {
	const study = regulatoryEvidenceStudySchema.parse(input);
	const sourceById = assertUniqueIds("source", study.sources);
	const citationById = assertUniqueIds("citation", study.citations);
	const valueById = assertUniqueIds("value", study.values);
	const rawRowById = assertUniqueIds("raw row", study.rawRows);
	assertUniqueIds("canonical row", study.canonicalRows);
	const overrideById = assertUniqueIds("override", study.overrides);
	assertUniqueStrings("coverage option", study.coverage.optionIds);
	assertUniqueStrings("coverage hazard", study.coverage.hazardIds);
	assertUniqueStrings("coverage field", study.coverage.fieldIds);
	if (options.sourceLocks) {
		const lockById = assertUniqueIds("source lock", options.sourceLocks);
		const expectedLockIds = study.sources
			.filter(({ redistribution }) => redistribution.decision === "bundled")
			.map(({ id }) => id)
			.sort();
		const actualLockIds = [...lockById.keys()].sort();
		if (JSON.stringify(expectedLockIds) !== JSON.stringify(actualLockIds)) {
			throw new Error("Source-lock coverage differs from bundled sources");
		}
		for (const lock of options.sourceLocks) {
			const source = sourceById.get(lock.id);
			if (
				!source ||
				lock.sha256 !== source.sha256 ||
				lock.pageCount !== source.pageCount ||
				lock.localPath !== source.redistribution.localPath
			) {
				throw new Error(`Source lock ${lock.id} differs from source metadata`);
			}
		}
	}

	const usedCitationIds = new Set(study.applicabilityCitationIds);
	for (const citationId of study.applicabilityCitationIds) {
		const citation = citationById.get(citationId);
		if (!citation) throw new Error(`Missing applicability citation ${citationId}`);
		if (citation.regionKind !== "applicability") {
			throw new Error(`Applicability citation ${citationId} has the wrong region kind`);
		}
	}

	const citedSourceIds = new Set<string>();
	for (const citation of study.citations) {
		const source = sourceById.get(citation.sourceDocumentId);
		if (!source) {
			throw new Error(
				`Citation ${citation.id} references missing source ${citation.sourceDocumentId}`,
			);
		}
		if (citation.physicalPage > source.pageCount) {
			throw new Error(`Citation ${citation.id} exceeds source page count`);
		}
		citedSourceIds.add(source.id);
		const page = source.pages.find(
			({ physicalPage }) => physicalPage === citation.physicalPage,
		);
		if (page) {
			if (page.printedPage && citation.printedPage !== page.printedPage) {
				throw new Error(`Citation ${citation.id} printed page differs from source metadata`);
			}
			if (!containsRect(page.crop, citation.rect)) {
				throw new Error(`Citation ${citation.id} lies outside the declared page crop`);
			}
		}
		if (citation.parentCitationId) {
			const parent = citationById.get(citation.parentCitationId);
			if (!parent) {
				throw new Error(
					`Citation ${citation.id} has missing parent ${citation.parentCitationId}`,
				);
			}
			if (
				parent.sourceDocumentId !== citation.sourceDocumentId ||
				parent.physicalPage !== citation.physicalPage ||
				!containsRect(parent.rect, citation.rect)
			) {
				throw new Error(`Citation ${citation.id} is not contained by its parent`);
			}
			usedCitationIds.add(parent.id);
		}
	}
	assertNoCitationCycles(study);
	const orphanSources = [...sourceById.keys()].filter((id) => !citedSourceIds.has(id));
	if (orphanSources.length > 0) {
		throw new Error(`Orphan sources: ${orphanSources.sort().join(", ")}`);
	}

	const expectedCoverage = new Set<string>();
	for (const optionId of study.coverage.optionIds) {
		for (const hazardId of study.coverage.hazardIds) {
			for (const fieldId of study.coverage.fieldIds) {
				expectedCoverage.add(coverageKey(optionId, hazardId, fieldId));
			}
		}
	}

	const covered = new Map<string, string>();
	for (const value of study.values) {
		const key = coverageKey(value.optionId, value.hazardId, value.fieldId);
		if (!expectedCoverage.has(key)) {
			throw new Error(`Orphan value ${value.id} is outside declared coverage`);
		}
		const duplicate = covered.get(key);
		if (duplicate) {
			throw new Error(`Duplicate covered value ${value.id}; already covered by ${duplicate}`);
		}
		covered.set(key, value.id);

		for (const citationId of value.citationIds) {
			if (!citationById.has(citationId)) {
				throw new Error(`Value ${value.id} references missing citation ${citationId}`);
			}
			usedCitationIds.add(citationId);
		}
		for (const citationId of value.derivedLineage?.citationIds ?? []) {
			if (!citationById.has(citationId)) {
				throw new Error(`Derived value ${value.id} references missing citation ${citationId}`);
			}
			usedCitationIds.add(citationId);
		}
		for (const dependencyId of value.derivedLineage?.dependencyValueIds ?? []) {
			if (!valueById.has(dependencyId)) {
				throw new Error(`Derived value ${value.id} has missing dependency ${dependencyId}`);
			}
			if (dependencyId === value.id) {
				throw new Error(`Derived value ${value.id} cannot depend on itself`);
			}
		}
		if (
			value.derivedLineage &&
			(value.derivedLineage.result !== value.value ||
				value.derivedLineage.unit !== value.unit)
		) {
			throw new Error(`Derived value ${value.id} lineage result or unit differs`);
		}
		if (value.provenance === "direct-source" && typeof value.value === "number") {
			const numericCitations = value.citationIds
				.map((citationId) => citationById.get(citationId))
				.filter((citation) => citation?.normalizedNumericValue !== undefined);
			if (
				!numericCitations.some(
					(citation) =>
						citation?.normalizedNumericValue === value.value &&
						(!citation.unit || citation.unit === value.unit),
				)
			) {
				throw new Error(`Direct numeric value ${value.id} has no matching cell citation`);
			}
		}
	}
	assertNoDerivedCycles(study);

	const uncoveredValues = [...expectedCoverage]
		.filter((key) => !covered.has(key))
		.map((key) => key.replaceAll("\u0000", "/"))
		.sort();
	if (uncoveredValues.length > 0) {
		throw new Error(`Incomplete option×hazard×field coverage: ${uncoveredValues.join(", ")}`);
	}

	const optionIds = new Set(study.coverage.optionIds);
	const hazardIds = new Set(study.coverage.hazardIds);
	const fieldIds = new Set(study.coverage.fieldIds);
	function assertRowDomain(
		label: string,
		row: RegulatoryEvidenceStudy["rawRows"][number],
	): void {
		if (!optionIds.has(row.optionId) || !hazardIds.has(row.hazardId)) {
			throw new Error(`${label} ${row.id} is outside declared option/hazard coverage`);
		}
		const unexpectedFields = Object.keys(row.fields).filter((id) => !fieldIds.has(id));
		if (unexpectedFields.length > 0) {
			throw new Error(`${label} ${row.id} has unexpected fields ${unexpectedFields.join(", ")}`);
		}
	}
	for (const row of study.rawRows) {
		assertRowDomain("Raw row", row);
		if (!sourceById.has(row.sourceDocumentId)) {
			throw new Error(`Raw row ${row.id} references missing source ${row.sourceDocumentId}`);
		}
		for (const citationId of row.citationIds) {
			if (!citationById.has(citationId)) {
				throw new Error(`Raw row ${row.id} references missing citation ${citationId}`);
			}
			usedCitationIds.add(citationId);
		}
	}
	for (const row of study.canonicalRows) {
		assertRowDomain("Canonical row", row);
		if (!sourceById.has(row.sourceDocumentId)) {
			throw new Error(
				`Canonical row ${row.id} references missing source ${row.sourceDocumentId}`,
			);
		}
		for (const sourceRowId of row.sourceRowIds) {
			if (!rawRowById.has(sourceRowId)) {
				throw new Error(`Canonical row ${row.id} references missing raw row ${sourceRowId}`);
			}
		}
		for (const citationId of row.citationIds) {
			if (!citationById.has(citationId)) {
				throw new Error(
					`Canonical row ${row.id} references missing citation ${citationId}`,
				);
			}
			usedCitationIds.add(citationId);
		}
	}
	assertUniqueStrings(
		"canonical row key",
		study.canonicalRows.map(({ rowKey }) => rowKey),
	);

	const rowsByKey = new Map<string, string[]>();
	for (const row of study.rawRows) {
		const rows = rowsByKey.get(row.rowKey) ?? [];
		rows.push(row.id);
		rowsByKey.set(row.rowKey, rows);
	}
	const duplicateRows = [...rowsByKey]
		.filter(([, ids]) => ids.length > 1)
		.sort(([left], [right]) => left.localeCompare(right));
	const matchedOverrides = new Set<string>();
	const duplicates = duplicateRows.map(([rowKey, rawRowIds]) => {
		const matching = study.overrides.filter((override) => {
			const occurrenceIds = override.competingOccurrences
				.map(({ rawRowId }) => rawRowId)
				.sort();
			return JSON.stringify(occurrenceIds) === JSON.stringify([...rawRowIds].sort());
		});
		if (matching.length !== 1) {
			throw new Error(`Undeclared or ambiguously overridden duplicate row ${rowKey}`);
		}
		const override = matching[0];
		const competingRows = rawRowIds.map((id) => rawRowById.get(id));
		if (
			competingRows.some(
				(row) =>
					row?.sourceDocumentId !== override.affected.sourceDocumentId ||
					row.optionId !== override.affected.optionId,
			)
		) {
			throw new Error(`Override ${override.id} affected source/option does not match`);
		}
		if (!rawRowIds.includes(override.chosenOccurrenceRawRowId)) {
			throw new Error(`Override ${override.id} chooses a non-competing occurrence`);
		}
		for (const occurrence of override.competingOccurrences) {
			const row = rawRowById.get(occurrence.rawRowId);
			if (!row?.citationIds.includes(occurrence.citationId)) {
				throw new Error(`Override ${override.id} has an invalid competing citation`);
			}
			usedCitationIds.add(occurrence.citationId);
		}
		matchedOverrides.add(override.id);
		return { rowKey, rawRowIds: [...rawRowIds].sort(), overrideId: override.id };
	});
	for (const overrideId of overrideById.keys()) {
		if (!matchedOverrides.has(overrideId)) {
			throw new Error(`Orphan override ${overrideId} does not resolve a duplicate row`);
		}
	}

	const orphanCitations = [...citationById.keys()].filter(
		(citationId) => !usedCitationIds.has(citationId),
	);
	if (orphanCitations.length > 0) {
		throw new Error(`Orphan citations: ${orphanCitations.sort().join(", ")}`);
	}

	const hashes: Record<string, string> = {};
	const sizes: Record<string, number> = {};
	for (const [name, artifact] of Object.entries(options.artifacts ?? {}).sort(
		([left], [right]) => left.localeCompare(right),
	)) {
		const result = hashArtifact(artifact);
		hashes[name] = result.hash;
		sizes[name] = result.size;
	}
	for (const lock of options.sourceLocks ?? []) {
		const key = `source:${lock.id}`;
		if (hashes[key] || sizes[key]) throw new Error(`Duplicate report artifact ${key}`);
		hashes[key] = lock.sha256;
		sizes[key] = lock.size;
	}

	return {
		studyId: study.studyId,
		rawRows: {
			count: study.rawRows.length,
			ids: study.rawRows.map(({ id }) => id).sort(),
		},
		canonicalRows: {
			count: study.canonicalRows.length,
			ids: study.canonicalRows.map(({ id }) => id).sort(),
		},
		duplicates,
		overrides: [...study.overrides].sort((left, right) =>
			left.id.localeCompare(right.id),
		),
		citations: {
			clause: study.citations
				.filter(({ regionKind }) => regionKind === "clause")
				.map(({ id }) => id)
				.sort(),
			cell: study.citations
				.filter(({ regionKind }) => regionKind === "cell")
				.map(({ id }) => id)
				.sort(),
		},
		uncoveredValues: [],
		hashes,
		sizes,
		sourceLocks: [...(options.sourceLocks ?? [])].sort((left, right) =>
			left.id.localeCompare(right.id),
		),
	};
}
