import { z } from "zod"

import cityReadings from "./data/city-readings.json"
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
  /** Citation of the printed legend table, which states each region's value. */
  legendCitationId: string
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
  /** Citation of the attested source region, one per figure, when directRegion is set. */
  directCitationIds: Record<Ccp14Coefficient, string> | null
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

/**
 * Coefficients whose value the figure states at the location itself, with the
 * citation of the region that states it. Anywhere else the figure marks bands
 * rather than places and nothing can be read off without tracing contours.
 */
export function ccp14DirectMapValues(id: string) {
  const location = resolveCcp14MapLocation(id)
  if (!location.directRegion) return null
  return {
    pgaG: ccp14LegendValue("PGA", location.directRegion.PGA),
    ssG: ccp14LegendValue("Ss", location.directRegion.Ss),
    s1G: ccp14LegendValue("S1", location.directRegion.S1),
  }
}

/**
 * Direct source backing for a declared reading: present only where the figure
 * assigns the location a region AND the entered coefficient still equals what
 * that region's legend row states. An edited value loses its backing rather
 * than keeping a citation that no longer describes it.
 */
/**
 * Backing for a coefficient the engineer read as a whole region rather than
 * interpolating. The legend is a printed table, so once the region is asserted
 * the value is quoted from the publication rather than typed.
 */
export function ccp14LegendBacking(
  coefficient: Ccp14Coefficient,
  region: number | null,
  entered: number,
) {
  if (region === null) return null
  const figure = ccp14MapFigure(coefficient)
  const stated = ccp14LegendValue(coefficient, region)
  if (entered !== stated) return null
  return {
    coefficient,
    region,
    value: stated,
    citationId: figure.legendCitationId,
    reference: `${figure.id.replace("figura-", "Figura ")}, leyenda, región ${region}`,
  }
}

export function ccp14DirectValueBacking(
  id: string | null,
  entered: { pgaG: number; ssG: number; s1G: number },
) {
  if (!id) return []
  const location = resolveCcp14MapLocation(id)
  if (!location.directRegion || !location.directCitationIds) return []
  const fields = [
    ["pgaG", "PGA", entered.pgaG],
    ["ssG", "Ss", entered.ssG],
    ["s1G", "S1", entered.s1G],
  ] as const
  return fields.flatMap(([field, coefficient, value]) => {
    const region = location.directRegion![coefficient as Ccp14Coefficient]
    const stated = ccp14LegendValue(coefficient as Ccp14Coefficient, region)
    if (value !== stated) return []
    return [{
      field,
      coefficient,
      value: stated,
      region,
      citationId: location.directCitationIds![coefficient as Ccp14Coefficient],
    }]
  })
}

export type Ccp14ReadingVerification = "agrees" | "disputed" | "unverified"

export type Ccp14CityReading = {
  id: string
  label: string
  regions: Record<Ccp14Coefficient, number>
  pgaVerification: Ccp14ReadingVerification
  ssVerification: Ccp14ReadingVerification
  s1Verification: Ccp14ReadingVerification
  note: string
}

const readingById = new Map(
  (cityReadings.readings as Ccp14CityReading[]).map((r) => [r.id, r]),
)

/**
 * The region each labeled place was read into, and how well that reading holds
 * up. The value of a region is published; which region a place falls in is not,
 * so this is an espectr0 map reading and every prefilled value stays editable.
 */
export function ccp14CityReading(id: string | null): Ccp14CityReading | null {
  return id ? readingById.get(id) ?? null : null
}

export function ccp14CityValues(id: string | null) {
  const reading = ccp14CityReading(id)
  if (!reading) return null
  return {
    PGA: ccp14LegendValue("PGA", reading.regions.PGA),
    Ss: ccp14LegendValue("Ss", reading.regions.Ss),
    S1: ccp14LegendValue("S1", reading.regions.S1),
  }
}

export const CCP14_READING_LEGEND = cityReadings.verificationLegend
export const CCP14_READING_NOTE = cityReadings.note

export const ccp14MapRegionCountConflict =
  mapLocations.appendixC3RegionCountConflict
