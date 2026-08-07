import { z } from "zod"

import mapLocations from "./data/map-locations.json"

export type Ccp14Coefficient = "PGA" | "Ss" | "S1"

export type Ccp14MapFigure = {
  id: string
  coefficient: Ccp14Coefficient
  title: string
  physicalPage: number
  printedPage: string
  mapTitle: string
  /** Legend rows as printed on the figure, ordered by region number. */
  regions: readonly (readonly [region: number, value: number])[]
}

export type Ccp14MapLocation = {
  id: string
  label: string
  inset: boolean
  /**
   * Set only where the figure prints a region marker at the location itself with
   * no contour crossing it. Everywhere else the figure marks contour bands, not
   * places, so no coefficient can be read off without tracing the contours.
   */
  directRegion: Record<Ccp14Coefficient, number> | null
}

export const ccp14MapFigures = mapLocations.figures.map((figure) => ({
  ...figure,
  coefficient: figure.coefficient as Ccp14Coefficient,
  regions: figure.regions.map(([region, value]) => [region, value] as const),
})) as readonly Ccp14MapFigure[]

export const ccp14MapLocations =
  mapLocations.locations as readonly Ccp14MapLocation[]

export const ccp14MapLocationIds = ccp14MapLocations.map(({ id }) => id) as [
  string,
  ...string[],
]

export const ccp14MapLocationIdSchema = z.enum(ccp14MapLocationIds)
export type Ccp14MapLocationId = z.infer<typeof ccp14MapLocationIdSchema>

const locationById = new Map(
  ccp14MapLocations.map((location) => [location.id, location]),
)
const figureByCoefficient = new Map(
  ccp14MapFigures.map((figure) => [figure.coefficient, figure]),
)

export function resolveCcp14MapLocation(id: string): Ccp14MapLocation {
  const location = locationById.get(id)
  if (!location) throw new RangeError(`Unknown CCP-14 map location: ${id}`)
  return location
}

export function ccp14MapFigure(coefficient: Ccp14Coefficient): Ccp14MapFigure {
  const figure = figureByCoefficient.get(coefficient)
  if (!figure) throw new RangeError(`Unknown CCP-14 coefficient: ${coefficient}`)
  return figure
}

export function ccp14LegendValue(coefficient: Ccp14Coefficient, region: number) {
  const entry = ccp14MapFigure(coefficient).regions.find(
    ([regionNumber]) => regionNumber === region,
  )
  if (!entry) {
    throw new RangeError(
      `Region ${region} is not printed on the ${coefficient} legend`,
    )
  }
  return entry[1]
}

/** The three coefficients where the figure assigns a region at the location itself. */
export function ccp14DirectMapValues(id: string) {
  const location = resolveCcp14MapLocation(id)
  if (!location.directRegion) return null
  return {
    pgaG: ccp14LegendValue("PGA", location.directRegion.PGA),
    ssG: ccp14LegendValue("Ss", location.directRegion.Ss),
    s1G: ccp14LegendValue("S1", location.directRegion.S1),
  }
}

export const ccp14MapRegionCountConflict =
  mapLocations.appendixC3RegionCountConflict
