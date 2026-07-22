import municipiosData from "./data/municipios.json"

import type { Municipio } from "./schema"

export const municipios: readonly Municipio[] = municipiosData

const municipiosByCode = new Map(municipios.map((municipio) => [municipio.code, municipio]))

/** Returns the municipality identified by its stable five-digit DANE code. */
export function lookupMunicipioByCode(code: string) {
  return municipiosByCode.get(code)
}

/** Normalizes Spanish text for case- and accent-insensitive matching. */
export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-CO")
    .trim()
}

/**
 * Returns every exact municipality-name match. A department can disambiguate
 * names that occur more than once in the legal appendix.
 */
export function lookupMunicipio(municipio: string, departamento?: string) {
  const normalizedMunicipio = normalizeSearchText(municipio)
  const normalizedDepartamento = departamento
    ? normalizeSearchText(departamento)
    : undefined

  return municipios.filter(
    (entry) =>
      normalizeSearchText(entry.municipio) === normalizedMunicipio &&
      (normalizedDepartamento === undefined ||
        normalizeSearchText(entry.departamento) === normalizedDepartamento),
  )
}

/**
 * Searches municipality and department names, prioritizing municipality-name
 * prefixes. Results preserve legal-dataset order for stable UI rendering.
 */
export function searchMunicipios(query: string, limit = 20) {
  if (!Number.isFinite(limit) || limit <= 0) return []

  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return municipios.slice(0, Math.floor(limit))

  const matches = municipios
    .map((entry, index) => {
      const municipio = normalizeSearchText(entry.municipio)
      const departamento = normalizeSearchText(entry.departamento)
      const combined = `${municipio} ${departamento}`
      const rank = municipio.startsWith(normalizedQuery)
        ? 0
        : municipio.includes(normalizedQuery)
          ? 1
          : departamento.startsWith(normalizedQuery)
            ? 2
            : combined.includes(normalizedQuery)
              ? 3
              : -1

      return { entry, index, rank }
    })
    .filter((match) => match.rank >= 0)
    .sort((left, right) => left.rank - right.rank || left.index - right.index)

  return matches.slice(0, Math.floor(limit)).map(({ entry }) => entry)
}
