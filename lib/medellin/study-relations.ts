import { z } from "zod"

import {
  spectrumStudyRelationRegistry,
  type SpectrumStudyRelationValidator,
} from "../spectra/types"
import {
  MEDELLIN_STUDY_ID,
  medellinHazardIdSchema,
  medellinZoneIdSchema,
} from "./schema"

const selectionSchema = z
  .object({
    zoneId: medellinZoneIdSchema.nullable(),
    hazardId: medellinHazardIdSchema.nullable(),
  })
  .passthrough()

export const medellinStudyRelationValidator: SpectrumStudyRelationValidator = {
  studyId: MEDELLIN_STUDY_ID,
  validate(result, context) {
    const selection = selectionSchema.safeParse(result.normalizedInputs)
    if (!selection.success) {
      context.addIssue({
        code: "custom",
        message: "Medellín normalized inputs have no inspectable selection",
        path: ["normalizedInputs"],
      })
      return
    }
    if (result.scenarioEvidenceKey.optionId !== selection.data.zoneId) {
      context.addIssue({
        code: "custom",
        message: "Medellín evidence option must match normalizedInputs.zoneId",
        path: ["scenarioEvidenceKey", "optionId"],
      })
    }
    if (result.scenarioEvidenceKey.hazardId !== selection.data.hazardId) {
      context.addIssue({
        code: "custom",
        message: "Medellín evidence hazard must match normalizedInputs.hazardId",
        path: ["scenarioEvidenceKey", "hazardId"],
      })
    }
  },
}

spectrumStudyRelationRegistry.register(medellinStudyRelationValidator)
