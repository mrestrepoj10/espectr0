import { z } from "zod"

export const SPECTRUM_CAPABILITIES_SCHEMA_VERSION = 1 as const

export const spectrumCapabilityKeys = [
  "comparison",
  "contextualPdf",
  "csvExport",
  "etabsExport",
  "jsonExport",
  "svgPngExport",
  "buildingBaseShear",
  "fheWorkflow",
  "bridgeRFactorWorkflow",
  "traceabilityViewer",
] as const

export type SpectrumCapabilityKey = (typeof spectrumCapabilityKeys)[number]

export const capabilityDecisionSchema = z.discriminatedUnion("supported", [
  z.object({ supported: z.literal(true) }).strict(),
  z
    .object({
      supported: z.literal(false),
      reason: z.string().trim().min(1),
    })
    .strict(),
])

const capabilityShape = Object.fromEntries(
  spectrumCapabilityKeys.map((key) => [key, capabilityDecisionSchema]),
) as Record<SpectrumCapabilityKey, typeof capabilityDecisionSchema>

export const spectrumCapabilitiesSchema = z.object(capabilityShape).strict()

export type CapabilityDecision = z.infer<typeof capabilityDecisionSchema>
export type SpectrumCapabilities = z.infer<typeof spectrumCapabilitiesSchema>

export function supportedCapability(): CapabilityDecision {
  return { supported: true }
}

export function unsupportedCapability(reason: string): CapabilityDecision {
  return capabilityDecisionSchema.parse({ supported: false, reason })
}
