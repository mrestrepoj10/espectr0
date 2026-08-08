import { createMunicipalEvidenceResolver } from "../spectra/municipal-evidence-resolver"

import canonical from "./data/canonical.json"
import formulaInventory from "./evidence/formula-inventory.json"
import manifest from "./evidence/manifest.json"

/** See the Medellín resolver: registration order forbids importing the adapter. */
const MANIZALES_ENGINE_ID = "manizales-spectrum"

const zoneLabels = new Map(canonical.zones.map((zone) => [zone.id, zone.label]))

export const manizalesEvidenceResolver = createMunicipalEvidenceResolver({
  engineId: MANIZALES_ENGINE_ID,
  studyLabel: "Microzonificación sísmica de Manizales",
  location: "Manizales",
  sources: manifest.sources,
  citations: manifest.citations,
  formulas: formulaInventory.formulas,
  zoneLabel: (optionId) => zoneLabels.get(optionId) ?? optionId,
  /**
   * Only the two pages that carry the model are served: the Figura 8.1 plate
   * with the zone map, the four branches and the design considerations, and the
   * Figura 8.5 parameter sheet.
   */
  extracts: {
    "manizales-uniandes-2002-figuras": {
      path: "/manizales/uniandes-2002-figuras-8.1-8.5.pdf",
      pageMap: { "197": 1, "201": 2 },
    },
  },
})
