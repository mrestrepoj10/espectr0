import mapEvidence from "./data/map-evidence.json"

import canonical from "./data/canonical.json"

export type BogotaMapEvidence = typeof mapEvidence

const zoneLabels = new Map(
  canonical.options.map((option) => [option.id, option.sourceLabel]),
)

export const bogotaMapEvidence: BogotaMapEvidence = mapEvidence

/**
 * Vertical band of a zone's swatch on the legend cut, as image fractions.
 * Measured from the rendered crop, so the highlight lands on the swatch rather
 * than between two of them.
 */
export function bogotaLegendRowBand(zoneId: string) {
  const band = mapEvidence.legendRowBands[
    zoneId as keyof typeof mapEvidence.legendRowBands
  ]
  if (!band) {
    throw new RangeError(`Zone ${zoneId} has no measured row on the legend`)
  }
  return band
}

export function bogotaZoneLabel(zoneId: string) {
  return zoneLabels.get(zoneId) ?? zoneId
}
