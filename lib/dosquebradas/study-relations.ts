import { z } from "zod"

import {
  spectrumStudyRelationRegistry,
  type SpectrumStudyRelationValidator,
} from "../spectra/types"
import { DOSQUEBRADAS_STUDY_ID, dosquebradasZoneIdSchema } from "./schema"

const selectionSchema = z
  .object({
    zoneId: dosquebradasZoneIdSchema.nullable(),
    hazardId: z.string().nullable(),
  })
  .passthrough()

export const dosquebradasStudyRelationValidator: SpectrumStudyRelationValidator = {
  studyId: DOSQUEBRADAS_STUDY_ID,
  validate(result, context) {
    const selection = selectionSchema.safeParse(result.normalizedInputs)
    if (!selection.success) {
      context.addIssue({
        code: "custom",
        message: "Dosquebradas normalized inputs have no inspectable selection",
        path: ["normalizedInputs"],
      })
      return
    }
    if (result.scenarioEvidenceKey.optionId !== selection.data.zoneId) {
      context.addIssue({
        code: "custom",
        message: "Dosquebradas evidence option must match normalizedInputs.zoneId",
        path: ["scenarioEvidenceKey", "optionId"],
      })
    }
    const hazardId = selection.data.hazardId === "design" ? "design" : null
    if (result.scenarioEvidenceKey.hazardId !== hazardId) {
      context.addIssue({
        code: "custom",
        message: "Dosquebradas evidence hazard must match normalizedInputs.hazardId",
        path: ["scenarioEvidenceKey", "hazardId"],
      })
    }
  },
}

spectrumStudyRelationRegistry.register(dosquebradasStudyRelationValidator)
