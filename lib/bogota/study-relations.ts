import { z } from "zod"

import { spectrumEvidenceResolverRegistry } from "../spectra/evidence"
import {
  spectrumStudyRelationRegistry,
  type SpectrumStudyRelationValidator,
} from "../spectra/types"
import { BOGOTA_STUDY_ID, bogotaCanonical } from "./schema"
import { bogotaEvidenceResolver } from "./evidence-resolver"

const optionIds = new Set<string>(bogotaCanonical.options.map(({ id }) => id))
const hazardIds = new Set<string>(bogotaCanonical.hazards.map(({ id }) => id))

const selectionSchema = z
  .object({
    zoneId: z.string().nullable(),
    hazardId: z.string().nullable(),
  })
  .passthrough()

export const bogotaStudyRelationValidator: SpectrumStudyRelationValidator = {
  studyId: BOGOTA_STUDY_ID,
  validate(result, context) {
    const selection = selectionSchema.safeParse(result.normalizedInputs)
    if (!selection.success) {
      context.addIssue({
        code: "custom",
        message: "Bogotá normalized inputs have no inspectable zone/hazard selection",
        path: ["normalizedInputs"],
      })
      return
    }

    const expectedOptionId =
      selection.data.zoneId && optionIds.has(selection.data.zoneId)
        ? selection.data.zoneId
        : null
    const expectedHazardId =
      selection.data.hazardId && hazardIds.has(selection.data.hazardId)
        ? selection.data.hazardId
        : null

    if (result.scenarioEvidenceKey.optionId !== expectedOptionId) {
      context.addIssue({
        code: "custom",
        message: "Bogotá evidence option must match normalizedInputs.zoneId",
        path: ["scenarioEvidenceKey", "optionId"],
      })
    }
    if (result.scenarioEvidenceKey.hazardId !== expectedHazardId) {
      context.addIssue({
        code: "custom",
        message: "Bogotá evidence hazard must match normalizedInputs.hazardId",
        path: ["scenarioEvidenceKey", "hazardId"],
      })
    }
    if (result.status === "ok" && (!expectedOptionId || !expectedHazardId)) {
      context.addIssue({
        code: "custom",
        message: "Successful Bogotá results require a canonical zone and hazard",
        path: ["normalizedInputs"],
      })
    }
  },
}

spectrumStudyRelationRegistry.register(bogotaStudyRelationValidator)

spectrumEvidenceResolverRegistry.register(bogotaEvidenceResolver)
