import mapEvidence from "./data/map-evidence.json"

import canonical from "./data/canonical.json"

export type CaliMapEvidence = typeof mapEvidence

const componentLabels = new Map(
  canonical.curveComponents.map((component) => [component.id, component.label]),
)

export const caliMapEvidence: CaliMapEvidence = mapEvidence

/**
 * The legend prints one swatch per geographic zone, but 4B, 4C and 5 each carry
 * two concurrent curve components, so a component id maps onto its zone before
 * the band is looked up.
 */
export function caliZoneOfComponent(componentId: string) {
  return componentId.replace(/-(tc|tl)$/, "")
}

/**
 * Rectangle of a zone's legend row on the cut, as image fractions. Measured
 * from the rendered crop — the legend runs in two columns, so a row is located
 * by x as well as y.
 */
export function caliLegendZoneBand(componentId: string) {
  const zoneId = caliZoneOfComponent(componentId)
  const band =
    mapEvidence.legendZoneBands[
      zoneId as keyof typeof mapEvidence.legendZoneBands
    ]
  if (!band) {
    throw new RangeError(`Zone ${zoneId} has no measured row on the legend`)
  }
  return band
}

export function caliComponentLabel(componentId: string) {
  return componentLabels.get(componentId) ?? componentId
}
