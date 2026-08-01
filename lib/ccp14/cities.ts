import { z } from "zod"

export const ccp14CityIds = [
  "arauca", "armenia", "barranquilla", "bogota-dc", "bucaramanga", "cali",
  "cartagena", "cucuta", "florencia", "ibague", "leticia", "manizales",
  "medellin", "mitu", "mocoa", "monteria", "neiva", "pasto", "pereira",
  "popayan", "puerto-carreno", "puerto-inirida", "quibdo", "riohacha",
  "san-andres", "santa-marta", "san-jose-del-guaviare", "sincelejo", "tunja",
  "valledupar", "villavicencio", "yopal",
] as const

export const ccp14CityIdSchema = z.enum(ccp14CityIds)
export type Ccp14CityId = z.infer<typeof ccp14CityIdSchema>

export type Ccp14CityHazard = {
  id: Ccp14CityId
  label: string
  pgaG: number
  ssG: number
  s1G: number
  citationIds: [string, string, string]
}

const mapCitationIds = [
  "claim-map-inputs",
  "claim-map-inputs",
  "claim-map-inputs",
] as const

const cityValues: Record<Ccp14CityId, readonly [label: string, pgaG: number, ssG: number, s1G: number]> = {
  arauca: ["Arauca", 0.20, 0.40, 0.20],
  armenia: ["Armenia", 0.25, 0.60, 0.30],
  barranquilla: ["Barranquilla", 0.10, 0.20, 0.10],
  "bogota-dc": ["Bogotá D.C.", 0.25, 0.60, 0.30],
  bucaramanga: ["Bucaramanga", 0.20, 0.50, 0.25],
  cali: ["Cali", 0.30, 0.60, 0.30],
  cartagena: ["Cartagena", 0.10, 0.20, 0.10],
  cucuta: ["Cúcuta", 0.55, 1.20, 0.60],
  florencia: ["Florencia", 0.20, 0.50, 0.25],
  ibague: ["Ibagué", 0.25, 0.60, 0.30],
  leticia: ["Leticia", 0.05, 0.10, 0.05],
  manizales: ["Manizales", 0.25, 0.60, 0.30],
  medellin: ["Medellín", 0.20, 0.50, 0.25],
  mitu: ["Mitú", 0.05, 0.10, 0.05],
  mocoa: ["Mocoa", 0.40, 0.90, 0.40],
  monteria: ["Montería", 0.15, 0.30, 0.20],
  neiva: ["Neiva", 0.35, 0.80, 0.40],
  pasto: ["Pasto", 0.30, 0.70, 0.35],
  pereira: ["Pereira", 0.25, 0.60, 0.30],
  popayan: ["Popayán", 0.30, 0.60, 0.30],
  "puerto-carreno": ["Puerto Carreño", 0.05, 0.10, 0.05],
  "puerto-inirida": ["Puerto Inírida", 0.05, 0.10, 0.05],
  quibdo: ["Quibdó", 0.40, 0.90, 0.50],
  riohacha: ["Riohacha", 0.15, 0.30, 0.15],
  "san-andres": ["San Andrés", 0.05, 0.10, 0.05],
  "santa-marta": ["Santa Marta", 0.20, 0.40, 0.20],
  "san-jose-del-guaviare": ["San José del Guaviare", 0.10, 0.20, 0.10],
  sincelejo: ["Sincelejo", 0.10, 0.20, 0.15],
  tunja: ["Tunja", 0.25, 0.60, 0.30],
  valledupar: ["Valledupar", 0.10, 0.20, 0.10],
  villavicencio: ["Villavicencio", 0.45, 1.00, 0.45],
  yopal: ["Yopal", 0.40, 0.90, 0.45],
}

export const ccp14Cities: readonly Ccp14CityHazard[] = ccp14CityIds.map((id) => {
  const [label, pgaG, ssG, s1G] = cityValues[id]
  return { id, label, pgaG, ssG, s1G, citationIds: [...mapCitationIds] }
})

const cityById = new Map(ccp14Cities.map((city) => [city.id, city]))

export function resolveCcp14City(id: Ccp14CityId): Ccp14CityHazard {
  const city = cityById.get(id)
  if (!city) throw new RangeError(`Unknown CCP-14 city: ${id}`)
  return city
}
