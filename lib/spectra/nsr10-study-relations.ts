import { z } from "zod"

import {
  spectrumStudyRelationRegistry,
  type SpectrumStudyRelationValidator,
} from "./types"

export const NSR10_STUDY_ID = "nsr10-national" as const
export const NSR10_STUDY_VERSION = "NSR-10-2010" as const

const nsr10SelectionInputsSchema = z
  .object({
    hazardLevel: z.string().trim().min(1),
    municipality: z
      .object({
        code: z.string().regex(/^\d{5}$/),
        municipio: z.string().trim().min(1),
        departamento: z.string().trim().min(1),
      })
      .strict()
      .nullable(),
  })
  .passthrough()

export const nsr10StudyRelationValidator: SpectrumStudyRelationValidator = {
  studyId: NSR10_STUDY_ID,
  validate(result, context) {
    const selection = nsr10SelectionInputsSchema.safeParse(
      result.normalizedInputs,
    )
    if (!selection.success) {
      context.addIssue({
        code: "custom",
        message: "NSR-10 normalized inputs have no valid scenario selection",
        path: ["normalizedInputs"],
      })
      return
    }

    const expectedOptionId = selection.data.municipality?.code ?? null
    if (result.scenarioEvidenceKey.optionId !== expectedOptionId) {
      context.addIssue({
        code: "custom",
        message:
          "NSR-10 evidence option must match normalizedInputs.municipality.code",
        path: ["scenarioEvidenceKey", "optionId"],
      })
    }
    if (result.scenarioEvidenceKey.hazardId !== selection.data.hazardLevel) {
      context.addIssue({
        code: "custom",
        message:
          "NSR-10 evidence hazard must match normalizedInputs.hazardLevel",
        path: ["scenarioEvidenceKey", "hazardId"],
      })
    }
  },
}

spectrumStudyRelationRegistry.register(nsr10StudyRelationValidator)
