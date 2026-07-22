export {
	aggregateEvidenceReportSchema,
	checkEvidenceStudy,
	evidenceCheckReportSchema,
	runInstalledDescriptors,
	studyDescriptorSchema,
	validateInstalledDescriptors,
	validateStudyCheckResult,
	type EvidenceCheckReport,
} from "./check";
export { deterministicJson } from "./deterministic";
export {
	citationRegionKindSchema,
	citationSchema,
	evidenceOverrideSchema,
	evidenceValueSchema,
	normalizedRectSchema,
	regulatoryEvidenceStudySchema,
	sourceDocumentSchema,
	valueProvenanceSchema,
	type EvidenceCitation,
	type EvidenceOverride,
	type EvidenceValue,
	type RegulatoryEvidenceStudy,
	type SourceDocument,
} from "./schema";
export {
	verifySourceLocks,
	type SourceLockOptions,
	type VerifiedSourceLock,
} from "./source-lock";
