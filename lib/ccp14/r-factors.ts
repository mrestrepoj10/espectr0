import rFactors from "./data/r-factors.json"

export type Ccp14OperationalCategory = "critical" | "essential" | "other"
export type Ccp14SubstructureElement = keyof typeof rFactors.substructure.rows
export type Ccp14ConnectionElement = keyof typeof rFactors.connection.rows

export type Ccp14RFactorResult =
  | { status: "ok"; value: number; citationIds: string[] }
  | { status: "not-tabulated"; reason: string; citationIds: string[] }

const substructureEvidenceRow: Record<Ccp14SubstructureElement, string> = {
  "multiple-column-frames": "portico-multiples-columnas",
  "reinforced-concrete-frame-inclined-piles": "portico-concreto-pilas-inclinadas",
  "reinforced-concrete-frame-vertical-piles-only": "portico-concreto-pilas-verticales",
  "single-columns": "columna-sola",
  "steel-or-composite-frame-inclined-piles": "portico-acero-compuesto-pilas-inclinadas",
  "steel-or-composite-frame-vertical-piles-only": "portico-acero-compuesto-pilas-verticales",
  "wall-piers-major-dimension": "pilar-muro-dimension-mayor",
}

const connectionEvidenceRow: Record<Ccp14ConnectionElement, string> = {
  "column-or-pier-to-foundation": "columna-pilar-cimentacion",
  "column-pier-or-pile-to-beam-or-superstructure": "columna-pilar-pila-viga-superestructura",
  "expansion-joint-in-superstructure-span": "junta-expansion-superestructura",
  "superstructure-to-abutment": "superestructura-estribo",
}

export function lookupCcp14SubstructureR(
  category: string,
  element: string,
  inelasticTimeHistory = false,
): Ccp14RFactorResult {
  if (inelasticTimeHistory) {
    return { status: "ok", value: 1, citationIds: ["claim-r-application"] }
  }
  if (!(element in rFactors.substructure.rows)) {
    return {
      status: "not-tabulated",
      reason: "The requested substructure element is not tabulated by CCP-14 Table 3.10.7.1-1.",
      citationIds: ["claim-r-tables"],
    }
  }
  if (!rFactors.substructure.columns.includes(category as Ccp14OperationalCategory)) {
    return {
      status: "not-tabulated",
      reason: "The requested operational category is not tabulated by CCP-14 Table 3.10.7.1-1.",
      citationIds: ["claim-r-tables"],
    }
  }
  const column = rFactors.substructure.columns.indexOf(category)
  const typedElement = element as Ccp14SubstructureElement
  const row = rFactors.substructure.rows[typedElement]
  return {
    status: "ok",
    value: row[column],
    citationIds: [
      `r-substructure-cell-${substructureEvidenceRow[typedElement]}-${column + 1}`,
      "claim-r-application",
    ],
  }
}

export function lookupCcp14ConnectionR(
  element: string,
  inelasticTimeHistory = false,
): Ccp14RFactorResult {
  if (inelasticTimeHistory) {
    return { status: "ok", value: 1, citationIds: ["claim-r-application"] }
  }
  if (!(element in rFactors.connection.rows)) {
    return {
      status: "not-tabulated",
      reason: "The requested connection element is not tabulated by CCP-14 Table 3.10.7.1-2.",
      citationIds: ["claim-r-tables"],
    }
  }
  return {
    status: "ok",
    value: rFactors.connection.rows[element as Ccp14ConnectionElement][0],
    citationIds: [
      `r-connection-cell-${connectionEvidenceRow[element as Ccp14ConnectionElement]}-1`,
      "claim-r-application",
    ],
  }
}
