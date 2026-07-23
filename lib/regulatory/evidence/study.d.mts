import type {
	EvidenceCheckReport,
	RegulatoryEvidenceStudy,
} from "../runtime.mjs";

export const studyId: "framework-fixture";
export const fixtureStudy: RegulatoryEvidenceStudy;
export function check(options: { repositoryRoot: string }): Promise<EvidenceCheckReport>;
