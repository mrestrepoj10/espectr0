import { createMunicipalEvidenceResolver } from "../spectra/municipal-evidence-resolver"

import canonical from "./data/canonical.json"
import formulaInventory from "./evidence/formula-inventory.json"
import manifest from "./evidence/manifest.json"

/** See the Medellín resolver: registration order forbids importing the adapter. */
const DOSQUEBRADAS_ENGINE_ID = "dosquebradas-spectrum"

const zoneLabels = new Map(
  canonical.zones.map((zone) => [zone.id, zone.label]),
)

export const dosquebradasEvidenceResolver = createMunicipalEvidenceResolver({
  engineId: DOSQUEBRADAS_ENGINE_ID,
  studyLabel: "Microzonificación sísmica de Dosquebradas",
  location: "Dosquebradas",
  sources: manifest.sources,
  citations: manifest.citations,
  formulas: formulaInventory.formulas,
  zoneLabel: (optionId) => zoneLabels.get(optionId) ?? optionId,
  /**
   * Only the two pages that carry Tabla 27 are served, extracted from the
   * officially fetched diagnostic after verifying its locked hash.
   */
  extracts: {
    "pot-2024-diagnostico-amenazas": {
      path: "/dosquebradas/pot-2024-tabla-27.pdf",
      pageMap: { "111": 1, "112": 2 },
    },
  },
})
