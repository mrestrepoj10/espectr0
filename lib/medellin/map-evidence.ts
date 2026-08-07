import mapEvidence from "./data/map-evidence.json"

import canonical from "./data/canonical.json"

export type MedellinMapEvidence = typeof mapEvidence

const zoneLabels = new Map(
  canonical.options.map((option) => [
    option.id,
    `${option.sourceLabel} — ${option.description}`,
  ]),
)

export const medellinMapEvidence: MedellinMapEvidence = mapEvidence

/**
 * Rectangle of a zone's legend row on the cut, as image fractions. The rows are
 * matched to the study's options by ordinal position, not by label: the sheet
 * names zones 2 and 3 by lithology where the DAP support text names them by
 * sector. See rowMatchingNote.
 */
export function medellinLegendZoneBand(zoneId: string) {
  const band =
    mapEvidence.legendZoneBands[
      zoneId as keyof typeof mapEvidence.legendZoneBands
    ]
  if (!band) {
    throw new RangeError(`Zone ${zoneId} has no measured row on the legend`)
  }
  return band
}

export function medellinZoneLabel(zoneId: string) {
  return zoneLabels.get(zoneId) ?? zoneId
}
