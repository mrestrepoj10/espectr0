import { z } from "zod"

import {
  spectrumStudyRelationRegistry,
  type SpectrumStudyRelationValidator,
} from "../spectra/types"
import canonicalJson from "./data/canonical.json"

const optionIds = new Set(canonicalJson.curveComponents.map(({ id }) => id))
const hazardIds = new Set(canonicalJson.hazards.map(({ id }) => id))

const selectionSchema = z
  .object({ optionId: z.string().nullable(), hazardId: z.string().nullable() })
  .passthrough()

export const caliStudyRelationValidator: SpectrumStudyRelationValidator = {
  studyId: "cali-microzonation",
  validate(result, context) {
    const selection = selectionSchema.safeParse(result.normalizedInputs)
    if (!selection.success) {
      context.addIssue({
        code: "custom",
        message: "Cali normalized inputs have no inspectable option/hazard selection",
        path: ["normalizedInputs"],
      })
      return
    }
    const optionId =
      selection.data.optionId && optionIds.has(selection.data.optionId)
        ? selection.data.optionId
        : null
    const hazardId =
      selection.data.hazardId && hazardIds.has(selection.data.hazardId)
        ? selection.data.hazardId
        : null
    if (result.scenarioEvidenceKey.optionId !== optionId) {
      context.addIssue({
        code: "custom",
        message: "Cali evidence option must match normalizedInputs.optionId",
        path: ["scenarioEvidenceKey", "optionId"],
      })
    }
    if (result.scenarioEvidenceKey.hazardId !== hazardId) {
      context.addIssue({
        code: "custom",
        message: "Cali evidence hazard must match normalizedInputs.hazardId",
        path: ["scenarioEvidenceKey", "hazardId"],
      })
    }
  },
}

spectrumStudyRelationRegistry.register(caliStudyRelationValidator)
