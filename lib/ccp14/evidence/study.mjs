import { checkEvidenceStudy } from "../../regulatory/runtime.mjs";

import { ccp14Study, studyId } from "./study-data.mjs";

export { ccp14Study, studyId };

export async function check({ repositoryRoot }) {
	return checkEvidenceStudy(ccp14Study, { repositoryRoot });
}
