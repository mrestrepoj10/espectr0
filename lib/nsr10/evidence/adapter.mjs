const EXPECTED_RAW_ROWS = 1_124;
const EXPECTED_CANONICAL_ROWS = 1_123;
const EXPECTED_NORMATIVE_CITATIONS = 8;
const EXPECTED_ORACLE_CASES = 12;
const EXPECTED_PROJECTION_HASH =
	"34a9b7e54703037884eb44baf36c4626891b50f80ea9a50bce6b2e95fc331f14";
const EXPECTED_FIELDS = ["aa", "ad", "ae", "av"];

function invariant(condition, message) {
	if (!condition) throw new Error(`NSR-10 compatibility: ${message}`);
}

/**
 * Adapts the immutable NSR-10 generator report to the generic evidence-check
 * report without changing the compact checked-in manifest.
 */
export function adaptNsr10EvidenceReport(report, manifest, overrides, pdfSize) {
	invariant(report.rawRows === EXPECTED_RAW_ROWS, "raw row coverage changed");
	invariant(report.uniqueCodes === EXPECTED_CANONICAL_ROWS, "canonical row coverage changed");
	invariant(
		report.geometryRowsValidated === EXPECTED_RAW_ROWS,
		"geometry coverage changed",
	);
	invariant(
		report.normativeCitations === EXPECTED_NORMATIVE_CITATIONS,
		"normative citation coverage changed",
	);
	invariant(manifest.schemaVersion === 4, "unsupported legacy manifest");
	invariant(
		manifest.citations.length === EXPECTED_CANONICAL_ROWS,
		"compact citation coverage changed",
	);
	invariant(
		new Set(manifest.citations.map(([code]) => code)).size ===
			EXPECTED_CANONICAL_ROWS,
		"duplicate compact citation codes",
	);
	invariant(
		manifest.normativeCitations.length === EXPECTED_NORMATIVE_CITATIONS,
		"normative manifest coverage changed",
	);
	invariant(
		JSON.stringify(Object.keys(manifest.layout.values).sort()) ===
			JSON.stringify(EXPECTED_FIELDS),
		"field-level layout coverage changed",
	);
	invariant(
		manifest.source.pdfSha256 === report.sourceHashes.pdf,
		"manifest and generator source hashes differ",
	);
	invariant(overrides.schemaVersion === 1, "unsupported override schema");
	const duplicateCodes = overrides.sourceDuplicates.map(({ code }) => code).sort();
	invariant(
		JSON.stringify(duplicateCodes) ===
			JSON.stringify([...report.duplicateCodes].sort()),
		"duplicate override coverage changed",
	);
	for (const override of overrides.sourceDuplicates) {
		invariant(override.reason?.trim(), `override ${override.code} has no reason`);
		invariant(
			override.occurrencePageNumbers.includes(override.chosenPageNumber),
			`override ${override.code} chooses an undeclared occurrence`,
		);
	}
	invariant(report.oracleCases === EXPECTED_ORACLE_CASES, "oracle case coverage changed");
	invariant(
		report.historicalAaAvProjectionSha256 === EXPECTED_PROJECTION_HASH,
		"historical projection hash changed",
	);
	invariant(Number.isInteger(pdfSize) && pdfSize > 0, "pinned PDF size is required");

	const canonicalIds = manifest.citations.map(([code]) => code).sort();
	const pageByCode = new Map(
		manifest.citations.map(([code, pageNumber]) => [code, pageNumber]),
	);
	const rawIds = canonicalIds.map((code) => `${code}@${pageByCode.get(code)}`);
	for (const override of overrides.sourceDuplicates) {
		for (const pageNumber of override.occurrencePageNumbers) {
			const id = `${override.code}@${pageNumber}`;
			if (!rawIds.includes(id)) rawIds.push(id);
		}
	}
	rawIds.sort();
	invariant(rawIds.length === EXPECTED_RAW_ROWS, "adapted raw row IDs changed");
	const adaptedOverrides = overrides.sourceDuplicates.map((override) => ({
		id: `legacy-${override.code}`,
		selectedRawRowId: `${override.code}@${override.chosenPageNumber}`,
		competingRawRowIds: override.occurrencePageNumbers
			.map((pageNumber) => `${override.code}@${pageNumber}`)
			.sort(),
		reviewStatus: "legacy-pending",
	}));

	return {
		schemaVersion: 1,
		studyId: "nsr10",
		rawRows: { count: report.rawRows, ids: rawIds },
		canonicalRows: { count: report.uniqueCodes, ids: canonicalIds },
		duplicates: overrides.sourceDuplicates.map((override) => ({
			rowKey: `${override.code}/nsr10-seismic`,
			rawRowIds: override.occurrencePageNumbers
				.map((pageNumber) => `${override.code}@${pageNumber}`)
				.sort(),
			overrideId: `legacy-${override.code}`,
		})),
		overrides: adaptedOverrides,
		citations: {
			table: 1,
			row: manifest.citations.length,
			cell: manifest.citations.length * EXPECTED_FIELDS.length,
			clause: manifest.normativeCitations.length,
			equation: 0,
			note: 0,
			warning: 0,
			figure: 0,
			applicability: 0,
		},
		uncoveredValues: [],
		hashes: {
			...report.sourceHashes,
			historicalAaAvProjection: report.historicalAaAvProjectionSha256,
			"source:nsr10-title-a": report.sourceHashes.pdf,
		},
		sizes: {
			...report.artifactSizes,
			"source:nsr10-title-a": pdfSize,
		},
		sourceLocks: [
			{
				id: "nsr10-title-a",
				localPath: "public/nsr10-titulo-a-2017.pdf",
				sha256: report.sourceHashes.pdf,
				size: pdfSize,
				pageCount: report.sourcePageCounts.pdf,
			},
		],
		coverage: {
			optionIds: canonicalIds,
			hazardIds: ["nsr10-seismic"],
			fieldIds: EXPECTED_FIELDS,
			expectedRows: EXPECTED_CANONICAL_ROWS,
			expectedValues: EXPECTED_CANONICAL_ROWS * EXPECTED_FIELDS.length,
			bundledSources: 1,
		},
	};
}
