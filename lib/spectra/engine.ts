import { z } from "zod"

import {
  SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  spectrumCapabilitiesSchema,
} from "./capabilities"
import type {
  NormalizedSpectrumResult,
  SpectrumScenario,
} from "./types"
import { normalizedSpectrumResultDataSchema } from "./types"

export const spectrumEngineMetadataSchema = z
  .object({
    id: z.string().trim().min(1),
    version: z.string().trim().min(1),
    studyId: z.string().trim().min(1),
    studyVersion: z.string().trim().min(1),
    scenarioType: z.enum(["nsr10-national", "ccp14", "municipal-study"]),
    capabilitySchemaVersion: z.literal(SPECTRUM_CAPABILITIES_SCHEMA_VERSION),
    capabilities: spectrumCapabilitiesSchema,
  })
  .strict()
  .superRefine((metadata, context) => {
    const expectedStudyId =
      metadata.scenarioType === "nsr10-national"
        ? "nsr10-national"
        : metadata.scenarioType === "ccp14"
          ? "ccp14"
          : null
    if (expectedStudyId !== null && metadata.studyId !== expectedStudyId) {
      context.addIssue({
        code: "custom",
        message: `${metadata.scenarioType} engines must use study ${expectedStudyId}`,
        path: ["studyId"],
      })
    }
    if (
      metadata.scenarioType === "municipal-study" &&
      (metadata.studyId === "nsr10-national" || metadata.studyId === "ccp14")
    ) {
      context.addIssue({
        code: "custom",
        message: "Municipal engines cannot use reserved national study IDs",
        path: ["studyId"],
      })
    }
  })

export type SpectrumEngineMetadata = z.infer<typeof spectrumEngineMetadataSchema>

export interface SpectrumEngine<TScenario extends SpectrumScenario = SpectrumScenario> {
  readonly metadata: SpectrumEngineMetadata
  accepts(scenario: SpectrumScenario): scenario is TScenario
  compute(scenario: TScenario): NormalizedSpectrumResult
}

export function assertEngineResultIdentity(
  metadata: SpectrumEngineMetadata,
  result: NormalizedSpectrumResult,
): void {
  const data = { ...result }
  Reflect.deleteProperty(data, "saAt")
  const parsed = normalizedSpectrumResultDataSchema.parse(data)
  if (
    parsed.engine.id !== metadata.id ||
    parsed.engine.version !== metadata.version ||
    parsed.study.id !== metadata.studyId ||
    parsed.study.version !== metadata.studyVersion ||
    parsed.scenarioType !== metadata.scenarioType
  ) {
    throw new Error("Spectrum result identity does not match registered engine metadata")
  }
}
