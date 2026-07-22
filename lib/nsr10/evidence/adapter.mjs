const EXPECTED_RAW_ROWS = 1_124;
const EXPECTED_CANONICAL_ROWS = 1_123;
const EXPECTED_NORMATIVE_CITATIONS = 8;
const EXPECTED_FIELDS = ["aa", "ad", "ae", "av"];

function invariant(condition, message) {
	if (!condition) throw new Error(`NSR-10 compatibility: ${message}`);
}

/**
 * Adapts the immutable NSR-10 generator report to the generic evidence-check
 * report without changing the compact checked-in manifest.
 */
export function adaptNsr10EvidenceReport(report, manifest, overrides) {
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

	return {
		studyId: "nsr10",
		rawRows: { count: report.rawRows },
		canonicalRows: { count: report.uniqueCodes },
		duplicates: duplicateCodes,
		overrides: overrides.sourceDuplicates.map((override) => ({ ...override })),
		citations: {
			row: manifest.citations.length,
			cell: manifest.citations.length * EXPECTED_FIELDS.length,
			clause: manifest.normativeCitations.length,
		},
		uncoveredValues: [],
		hashes: { ...report.sourceHashes },
		sizes: { ...report.artifactSizes },
		sourcePageCounts: { ...report.sourcePageCounts },
		historicalAaAvProjectionSha256: report.historicalAaAvProjectionSha256,
		oracleCases: report.oracleCases,
	};
}
