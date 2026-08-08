import { z } from "zod"

import { spectrumEvidenceResolverRegistry } from "../spectra/evidence"
import { manizalesEvidenceResolver } from "./evidence-resolver"
import {
  spectrumStudyRelationRegistry,
  type SpectrumStudyRelationValidator,
} from "../spectra/types"
import { MANIZALES_STUDY_ID, manizalesZoneIdSchema } from "./schema"

const selectionSchema = z
  .object({
    zoneId: manizalesZoneIdSchema.nullable(),
    hazardId: z.string().nullable(),
  })
  .passthrough()

export const manizalesStudyRelationValidator: SpectrumStudyRelationValidator = {
  studyId: MANIZALES_STUDY_ID,
  validate(result, context) {
    const selection = selectionSchema.safeParse(result.normalizedInputs)
    if (!selection.success) {
      context.addIssue({
        code: "custom",
        message: "Manizales normalized inputs have no inspectable selection",
        path: ["normalizedInputs"],
      })
      return
    }
    if (result.scenarioEvidenceKey.optionId !== selection.data.zoneId) {
      context.addIssue({
        code: "custom",
        message: "Manizales evidence option must match normalizedInputs.zoneId",
        path: ["scenarioEvidenceKey", "optionId"],
      })
    }
    const hazardId = selection.data.hazardId === "design" ? "design" : null
    if (result.scenarioEvidenceKey.hazardId !== hazardId) {
      context.addIssue({
        code: "custom",
        message: "Manizales evidence hazard must match normalizedInputs.hazardId",
        path: ["scenarioEvidenceKey", "hazardId"],
      })
    }
  },
}

spectrumStudyRelationRegistry.register(manizalesStudyRelationValidator)

spectrumEvidenceResolverRegistry.register(manizalesEvidenceResolver)
