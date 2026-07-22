import type { z } from "zod";

export type Scalar = string | number | boolean | null;
export type NormalizedRect = {
	left: number;
	top: number;
	width: number;
	height: number;
};
export type SourceDocument = {
	id: string;
	issuingAuthority: string;
	officialTitle: string;
	edition: string;
	revision: string | null;
	adoptionInstrument: string;
	amendmentsAndErrata: Array<{
		kind: "amendment" | "erratum";
		reference: string;
		issuedOn?: string;
		officialUrl?: string;
	}>;
	legalStatus: "active" | "superseded" | "draft" | "historical" | "unknown";
	applicabilityStatus:
		| "applicable"
		| "conditional"
		| "not-applicable"
		| "historical"
		| "unknown";
	officialUrl: string;
	retrievedOn: string;
	redistribution: {
		decision: "bundled" | "external-only" | "restricted";
		localPath?: string;
		rationale: string;
	};
	mediaType: string;
	pageCount: number;
	sha256: string;
	pages: Array<{
		physicalPage: number;
		printedPage: string | null;
		rotationDegrees: 0 | 90 | 180 | 270;
		crop: NormalizedRect;
	}>;
};
export type CitationRegionKind =
	| "table"
	| "row"
	| "cell"
	| "clause"
	| "equation"
	| "note"
	| "warning"
	| "figure"
	| "applicability";
export type EvidenceCitation = {
	id: string;
	sourceDocumentId: string;
	regionKind: CitationRegionKind;
	physicalPage: number;
	printedPage: string | null;
	reference: string;
	parentCitationId?: string;
	rect: NormalizedRect;
	extractedToken: string;
	normalizedValue?: Scalar;
	normalizedNumericValue?: number;
	unit: string | null;
	transformation: string | null;
	requiredTokens: string[];
};
export type EvidenceValue = {
	id: string;
	optionId: string;
	hazardId: string;
	fieldId: string;
	value: Scalar;
	unit: string | null;
	provenance: "direct-source" | "interpolated" | "derived" | "user-input";
	citationIds: string[];
	transformation: string | null;
	derivedLineage?: {
		dependencies: Array<{ valueId: string; inputCitationIds: string[] }>;
		formulaCitationId: string;
		formula: string;
		substitution: string;
		result: Scalar;
		unit: string | null;
	};
};
export type EvidenceRow = {
	id: string;
	rowKey: string;
	sourceDocumentId: string;
	optionId: string;
	hazardId: string;
	citationIds: string[];
	fields: Record<string, Scalar>;
};
export type CanonicalRow = EvidenceRow & { sourceRowIds: string[] };
export type EvidenceOverride = {
	id: string;
	affected: { sourceDocumentId: string; optionId: string };
	reason: string;
	competingOccurrences: Array<{ rawRowId: string; citationId: string }>;
	chosenOccurrenceRawRowId: string;
	author: string;
	independentReviewer: string;
	reviewDate: string;
};
export type RegulatoryEvidenceStudy = {
	schemaVersion: 1;
	studyId: string;
	title: string;
	sources: SourceDocument[];
	citations: EvidenceCitation[];
	applicabilityCitationIds: string[];
	coverage: { optionIds: string[]; hazardIds: string[]; fieldIds: string[] };
	values: EvidenceValue[];
	rawRows: EvidenceRow[];
	canonicalRows: CanonicalRow[];
	overrides: EvidenceOverride[];
};
export type VerifiedSourceLock = {
	id: string;
	localPath: string;
	sha256: string;
	size: number;
	pageCount: number;
};
export type SourceLockOptions = {
	readPageCount?: (
		source: SourceDocument,
		bytes: Uint8Array,
	) => number | Promise<number>;
};
export type EvidenceCheckReport = {
	schemaVersion: 1;
	studyId: string;
	rawRows: { count: number; ids: string[] };
	canonicalRows: { count: number; ids: string[] };
	duplicates: Array<{ rowKey: string; rawRowIds: string[]; overrideId: string }>;
	overrides: Array<{
		id: string;
		selectedRawRowId: string;
		competingRawRowIds: string[];
		reviewStatus: "reviewed" | "legacy-pending";
	}>;
	citations: Record<CitationRegionKind, number>;
	uncoveredValues: string[];
	hashes: Record<string, string>;
	sizes: Record<string, number>;
	sourceLocks: VerifiedSourceLock[];
	coverage: {
		optionIds: string[];
		hazardIds: string[];
		fieldIds: string[];
		expectedRows: number;
		expectedValues: number;
		bundledSources: number;
	};
};

export const normalizedRectSchema: z.ZodType<NormalizedRect>;
export const sourceDocumentSchema: z.ZodType<SourceDocument>;
export const citationRegionKindSchema: z.ZodType<CitationRegionKind>;
export const citationSchema: z.ZodType<EvidenceCitation>;
export const valueProvenanceSchema: z.ZodType<EvidenceValue["provenance"]>;
export const evidenceValueSchema: z.ZodType<EvidenceValue>;
export const evidenceOverrideSchema: z.ZodType<EvidenceOverride>;
export const regulatoryEvidenceStudySchema: z.ZodType<RegulatoryEvidenceStudy>;
export const evidenceCheckReportSchema: z.ZodType<EvidenceCheckReport>;
export const aggregateEvidenceReportSchema: z.ZodType<{
	schemaVersion: 1;
	installedStudies: string[];
	studies: EvidenceCheckReport[];
}>;
export const studyDescriptorSchema: z.ZodType<{ studyId: string; check: (...args: never[]) => unknown }>;
export function validateInstalledDescriptors(
	inputs: unknown[],
): Array<{ studyId: string; check: (...args: never[]) => unknown }>;
export function validateStudyCheckResult(
	descriptor: unknown,
	input: unknown,
): EvidenceCheckReport;
export function runInstalledDescriptors(
	inputs: unknown[],
	context: { repositoryRoot: string },
): Promise<{
	descriptors: Array<{ studyId: string; check: (...args: never[]) => unknown }>;
	reports: EvidenceCheckReport[];
}>;
export function deterministicJson(value: unknown): string;
export function verifySourceLocks(
	sources: SourceDocument[],
	repositoryRoot: string,
	options?: SourceLockOptions,
): Promise<VerifiedSourceLock[]>;
export function checkEvidenceStudy(
	input: unknown,
	options: SourceLockOptions & { repositoryRoot: string },
): Promise<EvidenceCheckReport>;
