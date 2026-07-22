import { z } from "zod"

import {
  SPECTRUM_CAPABILITIES_SCHEMA_VERSION,
  spectrumCapabilitiesSchema,
} from "./capabilities"
import type {
  NormalizedSpectrumResult,
  SpectrumScenario,
} from "./types"

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

export type SpectrumEngineMetadata = z.infer<typeof spectrumEngineMetadataSchema>

export interface SpectrumEngine<TScenario extends SpectrumScenario = SpectrumScenario> {
  readonly metadata: SpectrumEngineMetadata
  accepts(scenario: SpectrumScenario): scenario is TScenario
  compute(scenario: TScenario): NormalizedSpectrumResult
}
