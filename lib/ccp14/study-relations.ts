import { spectrumStudyRelationRegistry } from "../spectra/types"

const STUDY_ID = "ccp14"
const STUDY_VERSION = "CCP-14/Resolution-108-2015-v1"
const HAZARD_ID = "ccp14-2014-7pct-75y"

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
