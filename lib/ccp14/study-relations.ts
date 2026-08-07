import { spectrumEvidenceResolverRegistry } from "../spectra/evidence"
import { spectrumStudyRelationRegistry } from "../spectra/types"

import {
  CCP14_HAZARD_ID as HAZARD_ID,
  CCP14_STUDY_ID as STUDY_ID,
  CCP14_STUDY_VERSION as STUDY_VERSION,
} from "./constants"
import { ccp14EvidenceResolver } from "./evidence-resolver"

spectrumStudyRelationRegistry.register({
  studyId: STUDY_ID,
  validate(result, context) {
    if (result.study.version !== STUDY_VERSION) {
      context.addIssue({
        code: "custom",
        message: "Unexpected CCP-14 study version",
        path: ["study", "version"],
      })
    }
    if (result.scenarioType !== "ccp14") {
      context.addIssue({
        code: "custom",
        message: "CCP-14 must use the bridge scenario type",
        path: ["scenarioType"],
      })
    }
    if (result.hazard !== null && result.hazard.id !== HAZARD_ID) {
      context.addIssue({
        code: "custom",
        message: "Unexpected CCP-14 general hazard",
        path: ["hazard", "id"],
      })
    }
  },
})

spectrumEvidenceResolverRegistry.register(ccp14EvidenceResolver)
