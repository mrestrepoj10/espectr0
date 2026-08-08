import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const full = { left: 0, top: 0, width: 1, height: 1 };
/**
 * Figura 8.5 sits on a 792×612 landscape page; Figura 8.1 is the 2551×1417
 * plate. Both rectangles are measured with pdfplumber in the orientation the
 * viewer renders, so a citation lands on the printed token.
 */
const boxOn = (pageWidth, pageHeight) => (x0, top, x1, bottom) => ({
  left: Number((x0 / pageWidth).toFixed(6)),
  top: Number((top / pageHeight).toFixed(6)),
  width: Number(((x1 - x0) / pageWidth).toFixed(6)),
  height: Number(((bottom - top) / pageHeight).toFixed(6)),
});
const sheet = boxOn(792, 612);
const plate = boxOn(2551, 1417);

const studyId = "manizales-microzonation";
const sourceUrl = {
  report:
    "https://idea.manizales.unal.edu.co/sitios/gestion_riesgos/descargas/microzon/informe_final.pdf",
  figures:
    "https://idea.manizales.unal.edu.co/sitios/gestion_riesgos/descargas/microzon/informe_final_figuras.pdf",
  nsr10:
    "https://iisee.kenken.go.jp/worldlist/11_Colombia/Colombia%20Titulo%20A-NSR-10-Ver-2017.pdf",
};
const retrievedOn = "2026-08-08";
const externalOnly = {
  decision: "external-only",
  rationale:
    "La copia oficial permite consulta abierta, pero no concede una licencia de redistribución; se conservan URL, huella y atestación, no los bytes completos.",
};

const sources = [
  {
    id: "manizales-uniandes-2002",
    issuingAuthority:
      "Oficina Municipal para la Prevención y Atención de Desastres de Manizales y Universidad de los Andes (CIMOC)",
    officialTitle: "Microzonificación Sísmica de la Ciudad de Manizales — informe final",
    edition: "Agosto de 2002",
    revision: null,
    adoptionInstrument:
      "Estudio técnico municipal; complementario a la NSR-98 según su propia consideración de diseño (a)",
    amendmentsAndErrata: [],
    legalStatus: "historical",
    applicabilityStatus: "conditional",
    officialUrl: sourceUrl.report,
    retrievedOn,
    redistribution: externalOnly,
    mediaType: "application/pdf",
    pageCount: 160,
    sha256: "2e8c2c752f657899bf0240292f9e390f70c41fc87af8355b65f3a12fdfb3a799",
    pages: [
      { physicalPage: 153, printedPage: "148", rotationDegrees: 0, crop: full },
      { physicalPage: 157, printedPage: "152", rotationDegrees: 0, crop: full },
    ],
  },
  {
    id: "manizales-uniandes-2002-figuras",
    issuingAuthority:
      "Oficina Municipal para la Prevención y Atención de Desastres de Manizales y Universidad de los Andes (CIMOC)",
    officialTitle: "Microzonificación Sísmica de la Ciudad de Manizales — volumen de figuras",
    edition: "Agosto de 2002",
    revision: null,
    adoptionInstrument: "Volumen de figuras del mismo informe final; contiene las Figuras 8.1 y 8.5",
    amendmentsAndErrata: [],
    legalStatus: "historical",
    applicabilityStatus: "conditional",
    officialUrl: sourceUrl.figures,
    retrievedOn,
    redistribution: externalOnly,
    mediaType: "application/pdf",
    pageCount: 201,
    sha256: "fbcfa673a0657f9efa673dec74ebaffd80697ff659a25b89a92f6ad342708a69",
    pages: [
      { physicalPage: 197, printedPage: null, rotationDegrees: 90, crop: full },
      { physicalPage: 201, printedPage: null, rotationDegrees: 0, crop: full },
    ],
  },
  {
    id: "nsr10-title-a-2017",
    issuingAuthority:
      "Comisión Asesora Permanente para el Régimen de Construcciones Sismo Resistentes",
    officialTitle: "NSR-10 Título A — versión consolidada 2017",
    edition: "2017",
    revision: null,
    adoptionInstrument: "Decreto 926 de 2010 y modificaciones",
    amendmentsAndErrata: [],
    legalStatus: "active",
    applicabilityStatus: "conditional",
    officialUrl: sourceUrl.nsr10,
    retrievedOn,
    redistribution: {
      decision: "external-only",
      rationale: "Se reutiliza la huella del corpus NSR-10 instalado; este dossier no duplica los bytes.",
    },
    mediaType: "application/pdf",
    pageCount: 206,
    sha256: "47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0",
    pages: [{ physicalPage: 42, printedPage: "A-28", rotationDegrees: 0, crop: full }],
  },
];

/** Columns of Figura 8.5: the table is transposed, one column per zone. */
const zones = [
  {
    id: "zone-a",
    label: "Zona A",
    material: "Cenizas — depósitos de caída piroclástica de espesor variable",
    x: [558.8, 579.6],
    legend: [1483.0, 1171.0, 1660.0, 1186.0],
    values: { to: 0.1, tc: 0.65, tl: 3.25, am: 0.44, an: 0.44, fa: 1.0, fv: 1.63 },
    tokens: ["0.10", "0.65", "3.25", "0.44", "0.44", "1.00", "1.63"],
  },
  {
    id: "zone-b",
    label: "Zona B",
    material: "Rellenos",
    x: [624.0, 644.9],
    legend: [1483.0, 1209.5, 1660.0, 1224.5],
    values: { to: 0.1, tc: 0.5, tl: 2.5, am: 0.4, an: 0.4, fa: 1.0, fv: 1.25 },
    tokens: ["0.10", "0.50", "2.50", "0.40", "0.40", "1.00", "1.25"],
  },
  {
    id: "zone-c",
    label: "Zona C",
    material: "Rocas, flujos y depósitos de poco espesor",
    x: [689.2, 710.1],
    legend: [1483.0, 1248.2, 1700.0, 1263.3],
    values: { to: 0.1, tc: 0.5, tl: 2.5, am: 0.3, an: 0.3, fa: 1.0, fv: 1.25 },
    tokens: ["0.10", "0.50", "2.50", "0.30", "0.30", "1.00", "1.25"],
  },
];

/** Rows of Figura 8.5, top/bottom of each printed line. */
const fields = [
  ["to", "s", 383.9, 394.4],
  ["tc", "s", 398.2, 408.7],
  ["tl", "s", 411.7, 422.2],
  ["am", "g", 425.9, 436.4],
  ["an", "g", 439.4, 449.9],
  ["fa", null, 453.7, 464.2],
  ["fv", null, 467.2, 477.7],
];

const citations = [
  {
    id: "figura-8.5",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "table",
    physicalPage: 201,
    printedPage: null,
    reference: "Figura 8.5 — Espectros de diseño sísmico, parámetros por zona",
    rect: sheet(486, 364, 718, 482),
    extractedToken:
      "Zona A Zona B Zona C To 0.10 0.10 0.10 Tc 0.65 0.50 0.50 TL 3.25 2.50 2.50 Am 0.44 0.40 0.30 An 0.44 0.40 0.30 Fa 1.00 1.00 1.00 Fv 1.63 1.25 1.25",
    unit: null,
    transformation: null,
    requiredTokens: ["Zona A", "To", "Fv", "1.63"],
  },
  {
    id: "damping-five-percent",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 201,
    printedPage: null,
    reference: "Figura 8.5, rótulo de amortiguamiento",
    rect: sheet(255, 198, 362, 231),
    extractedToken: "Amortiguamiento x=5% con respecto al crítico",
    unit: null,
    transformation: null,
    requiredTokens: ["Amortiguamiento", "5%"],
  },
  {
    id: "equation-entrance",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, rama de entrada de la forma espectral",
    rect: plate(1450, 708, 1600, 757),
    extractedToken: "Sa = Am + (Am/To)(2.5Fa − 1) T",
    unit: "g",
    transformation: null,
    requiredTokens: ["Sa", "Am", "To"],
  },
  {
    id: "equation-plateau",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, meseta de la forma espectral",
    rect: plate(1520, 538, 1632, 566),
    extractedToken: "Sa = 2.5AmFa",
    unit: "g",
    transformation: null,
    requiredTokens: ["2.5AmFa"],
  },
  {
    id: "equation-inverse",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, rama descendente de la forma espectral",
    rect: plate(1645, 585, 1725, 625),
    extractedToken: "Sa = AnFv / T",
    unit: "g",
    transformation: null,
    requiredTokens: ["AnFv"],
  },
  {
    id: "equation-floor",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, rama de período largo de la forma espectral",
    rect: plate(1722, 648, 1800, 688),
    extractedToken: "Sa = Am / 2",
    unit: "g",
    transformation: null,
    requiredTokens: ["Am"],
  },
  {
    id: "branch-limits",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, abscisas To, Tc y TL de la forma espectral",
    rect: plate(1445, 770, 1800, 795),
    extractedToken: "To Tc TL",
    unit: "s",
    transformation: null,
    requiredTokens: ["To", "Tc", "TL"],
  },
  {
    id: "consideration-a-complementary",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, consideración de diseño (a)",
    rect: plate(1890, 592, 2505, 638),
    extractedToken:
      "(a) Todas las recomendaciones de diseño aquí establecidas son complementarias a las dadas en las Normas Colombianas de Diseño y Construcción Sismo Resistentes … y en ningún caso podrá tomarse un requisito inferior al establecido por la Norma.",
    unit: null,
    transformation: null,
    requiredTokens: ["complementarias", "requisito inferior"],
  },
  {
    id: "consideration-b-damping",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, consideración de diseño (b)",
    rect: plate(1890, 638, 2505, 675),
    extractedToken:
      "(b) Todos los espectros de diseño recomendados son a nivel de la superficie del terreno para un amortiguamiento con respecto al crítico del 5% y para zonas sin efectos topográficos de consideración.",
    unit: null,
    transformation: null,
    requiredTokens: ["superficie del terreno", "5%"],
  },
  {
    id: "consideration-c-topographic",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, consideración de diseño (c)",
    rect: plate(1890, 675, 2505, 706),
    extractedToken:
      "(c) En las zonas con efectos topográficos de consideración … deben aplicarse … los factores de amplificación por efectos topográficos que se especifican más adelante.",
    unit: null,
    transformation: null,
    requiredTokens: ["efectos topográficos"],
  },
  {
    id: "warning-special-analysis",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, consideración de diseño (e)",
    rect: plate(1890, 738, 2505, 771),
    extractedToken:
      "(e) Para estructuras con períodos de vibración fundamental mayores o iguales a 2.0 seg deben adelantarse análisis sísmicos especiales que se salen del alcance de las presentes recomendaciones.",
    unit: null,
    transformation: null,
    requiredTokens: ["2.0", "análisis sísmicos especiales"],
  },
  {
    id: "warning-zone-c-justification",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, consideración de diseño (f)",
    rect: plate(1890, 771, 2505, 845),
    extractedToken:
      "(f) La utilización de los espectros de diseño correspondientes a la Zona C, Terreno firme, deberá ser justificada en forma explícita por el ingeniero geotécnico en todos los casos …",
    unit: null,
    transformation: null,
    requiredTokens: ["Zona C", "justificada"],
  },
  {
    id: "consideration-h-high-hazard",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, consideración de diseño (h)",
    rect: plate(1890, 930, 2505, 962),
    extractedToken:
      "(h) Para efectos de aplicación de requisitos complementarios de las NSR-98, la ciudad de Manizales sigue perteneciendo a una zona de Amenaza Sísmica Alta.",
    unit: null,
    transformation: null,
    requiredTokens: ["Amenaza Sísmica Alta"],
  },
  {
    id: "consideration-i-am-equivalent",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1, consideración de diseño (i)",
    rect: plate(1890, 962, 2505, 1009),
    extractedToken:
      "(i) Los coeficientes de aceleración Am establecen los valores equivalentes a Aa a nivel del terreno en las diferentes zonas …",
    unit: null,
    transformation: null,
    requiredTokens: ["Am", "Aa"],
  },
  {
    id: "zone-map",
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "applicability",
    physicalPage: 197,
    printedPage: null,
    reference: "Figura 8.1 — Mapa de zonificación sísmica, escala 1:30000",
    rect: plate(1440, 1150, 2545, 1330),
    extractedToken:
      "CONVENCIONES ZONA A - CENIZAS ZONA B - RELLENOS ZONA C - ROCAS, FLUJOS Y DEPÓSITOS DE POCO ESPESOR · MAPA DE ZONIFICACIÓN SÍSMICA · Escala 1:30000",
    unit: null,
    transformation: null,
    requiredTokens: ["ZONA A", "CENIZAS", "1:30000"],
  },
  {
    id: "selection-procedure",
    sourceDocumentId: "manizales-uniandes-2002",
    regionKind: "applicability",
    physicalPage: 157,
    printedPage: "152",
    reference: "Numeral 8.4 — procedimiento de selección de la zona sísmica",
    rect: full,
    extractedToken:
      "En caso de duda se deberán utilizar los espectros correspondientes a la Zona A. Una vez seleccionada la zona sísmica se tiene definido el espectro de diseño de acuerdo con las Figuras 8.5.",
    unit: null,
    transformation: null,
    requiredTokens: ["Zona A", "Figuras 8.5"],
  },
  {
    id: "three-zone-model",
    sourceDocumentId: "manizales-uniandes-2002",
    regionKind: "applicability",
    physicalPage: 153,
    printedPage: "148",
    reference: "Numeral 8.2 — zonas características y espectros de diseño propuestos",
    rect: full,
    extractedToken:
      "los espectros de respuesta obtenidos en los sondeos disponibles agrupados en cada una de las zonas características mencionadas, con los correspondientes espectros de diseño propuestos en cada una de ellas",
    unit: null,
    transformation: null,
    requiredTokens: ["zonas características", "espectros de diseño"],
  },
  {
    id: "nsr10-a.2.5-1",
    sourceDocumentId: "nsr10-title-a-2017",
    regionKind: "applicability",
    physicalPage: 42,
    printedPage: "A-28",
    reference: "Tabla A.2.5-1",
    rect: { left: 0.351307, top: 0.53030303, width: 0.294118, height: 0.145202 },
    extractedToken:
      "Valores del coeficiente de importancia I IV 1.50 III 1.25 II 1.10 I 1.00",
    unit: null,
    transformation: null,
    requiredTokens: ["1.50", "1.25", "1.10", "1.00"],
  },
];

for (const zone of zones) {
  const rowId = `row-${zone.id}`;
  citations.push({
    id: rowId,
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    regionKind: "row",
    physicalPage: 201,
    printedPage: null,
    reference: `Figura 8.5, columna ${zone.label}`,
    parentCitationId: "figura-8.5",
    rect: sheet(zone.x[0] - 6, 365, zone.x[1] + 6, 481),
    extractedToken: `${zone.label} ${zone.tokens.join(" ")}`,
    unit: null,
    transformation: null,
    requiredTokens: [zone.label, ...zone.tokens],
  });
  fields.forEach(([fieldId, unit, top, bottom], index) => {
    citations.push({
      id: `cell-${zone.id}-${fieldId}`,
      sourceDocumentId: "manizales-uniandes-2002-figuras",
      regionKind: "cell",
      physicalPage: 201,
      printedPage: null,
      reference: `Figura 8.5, ${zone.label}, ${fieldId}`,
      parentCitationId: rowId,
      rect: sheet(zone.x[0] - 2, top - 2, zone.x[1] + 2, bottom + 2),
      extractedToken: zone.tokens[index],
      normalizedValue: zone.values[fieldId],
      normalizedNumericValue: zone.values[fieldId],
      unit,
      transformation: "decimal parse",
      requiredTokens: [zone.tokens[index]],
    });
  });
}

const values = zones.flatMap((zone) =>
  fields.map(([fieldId, unit]) => ({
    id: `value-${zone.id}-design-${fieldId}`,
    optionId: zone.id,
    hazardId: "design",
    fieldId,
    value: zone.values[fieldId],
    unit,
    provenance: "direct-source",
    citationIds: [`cell-${zone.id}-${fieldId}`],
    transformation: "decimal parse",
  })),
);
const rawRows = zones.map((zone) => ({
  id: `raw-${zone.id}-design`,
  rowKey: `${zone.id}/design`,
  sourceDocumentId: "manizales-uniandes-2002-figuras",
  optionId: zone.id,
  hazardId: "design",
  citationIds: fields.map(([fieldId]) => `cell-${zone.id}-${fieldId}`),
  fields: zone.values,
}));
const canonicalRows = rawRows.map((row) => ({
  ...row,
  id: row.id.replace("raw-", "canonical-"),
  sourceRowIds: [row.id],
}));

const applicabilityCitationIds = [
  "damping-five-percent",
  "equation-entrance",
  "equation-plateau",
  "equation-inverse",
  "equation-floor",
  "branch-limits",
  "warning-special-analysis",
  "warning-zone-c-justification",
  "consideration-a-complementary",
  "consideration-b-damping",
  "consideration-c-topographic",
  "consideration-h-high-hazard",
  "consideration-i-am-equivalent",
  "zone-map",
  "selection-procedure",
  "three-zone-model",
  "nsr10-a.2.5-1",
];

const manifest = {
  schemaVersion: 1,
  studyId,
  title:
    "Microzonificación sísmica de Manizales (Uniandes 2002) — Figura 8.5 transcrita con las cuatro ramas de la Figura 8.1",
  sources,
  citations,
  applicabilityCitationIds,
  coverage: {
    optionIds: zones.map(({ id }) => id),
    hazardIds: ["design"],
    fieldIds: fields.map(([id]) => id),
  },
  values,
  rawRows,
  canonicalRows,
  overrides: [],
};

const canonical = {
  schemaVersion: 1,
  studyId,
  status: "calculation-supported-full-curve",
  municipality: "Manizales",
  technicalSource: "manizales-uniandes-2002-figuras",
  calculationAnchor: "manizales-uniandes-2002-figuras",
  selectionMode: "manual-zone-only",
  dampingRatio: 0.05,
  hazards: [
    {
      id: "design",
      label: "Diseño",
      returnPeriodYears: null,
      probability: null,
      dampingRatio: 0.05,
    },
  ],
  fields: Object.fromEntries(fields.map(([id, unit]) => [id, { unit }])),
  zones: zones.map(({ id, label, material }) => ({ id, label, material })),
  rows: zones.map(({ id, values: rowValues }) => ({
    optionId: id,
    hazardId: "design",
    fields: rowValues,
  })),
  presentation: {
    spectraPresentedThroughSeconds: 3,
    specialSeismicAnalysisRequiredAtOrAboveSeconds: 2,
    sampledThroughSeconds: 4,
  },
  localizedLimitations: [
    "The 2002 sheet states no return period or exceedance probability for the design spectra.",
    "Design consideration (e) requires special seismic analyses at or above a 2.0 s fundamental period.",
    "Design consideration (f) requires the geotechnical engineer to justify Zone C explicitly.",
    "Topographic amplification Ftop is printed on the plate but is not applied by this engine.",
    "The zone is chosen manually; automatic GIS selection is not implemented.",
  ],
  capabilities: {
    traceabilityViewer: true,
    municipalSpectrumCalculation: true,
    supportedInterval: "0 <= T",
    automaticZoneSelection: false,
    topographicAmplification: false,
  },
};

const sourceLocks = {
  schemaVersion: 1,
  retrievedOn,
  policy:
    "External-only; re-fetch the exact URLs and verify byte length, page count and SHA-256 before trusting any transcription.",
  locks: [
    {
      sourceDocumentId: "manizales-uniandes-2002",
      officialUrl: sourceUrl.report,
      retrievedOn,
      byteLength: 868103,
      pageCount: 160,
      sha256: sources[0].sha256,
      mediaType: "application/pdf",
      redistributionDecision: "external-only",
    },
    {
      sourceDocumentId: "manizales-uniandes-2002-figuras",
      officialUrl: sourceUrl.figures,
      retrievedOn,
      byteLength: 38939870,
      pageCount: 201,
      sha256: sources[1].sha256,
      mediaType: "application/pdf",
      redistributionDecision: "external-only-except-figures-8.1-and-8.5",
    },
    {
      sourceDocumentId: "nsr10-title-a-2017",
      officialUrl: sourceUrl.nsr10,
      retrievedOn,
      byteLength: 3486413,
      pageCount: 206,
      sha256: sources[2].sha256,
      mediaType: "application/pdf",
      redistributionDecision: "external-only",
    },
  ],
  mirrors: [
    {
      sourceDocumentId: "manizales-uniandes-2002",
      mirrorUrl:
        "https://repositorio.gestiondelriesgo.gov.co/bitstream/handle/20.500.11762/19861/MicrozonificacionSismicaManizales%28UAndes_2002%29.pdf?isAllowed=y&sequence=1",
      note: "Copia UNGRD byte a byte idéntica al lock; el host rechazó la conexión en la última verificación, por eso el localizador oficial es el de la UNAL/IDEA.",
    },
  ],
};

const extractionProfile = {
  schemaVersion: 1,
  extractor: {
    engine: "pdfplumber",
    version: "0.11.10",
    parameters: { xTolerance: 2, yTolerance: 2, useTextFlow: false, keepBlankChars: false },
  },
  renderer: { engine: "pypdfium2", purpose: "visual confirmation of the plate and the parameter sheet" },
  coordinateSystem:
    "normalized top-left in the rendered orientation: 792×612 for Figura 8.5, 2551×1417 for the Figura 8.1 plate",
  normalization: "Unicode NFC; whitespace collapse; decimal parse preserves the printed token",
  table: {
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    physicalPage: 201,
    citationId: "figura-8.5",
    optionCount: 3,
    fieldCount: 7,
    directCellCount: 21,
    layout: "transposed — one printed column per zone, one printed row per parameter",
  },
};

const attestPayload = {
  schemaVersion: 1,
  externalOnly: true,
  sourceHashes: Object.fromEntries(sources.map(({ id, sha256: digest }) => [id, digest])),
  coverage: {
    tables: 1,
    optionRows: 3,
    directCells: 21,
    formulaRegions: 5,
    applicabilityClaims: 17,
    percent: 100,
  },
  table: {
    citationId: "figura-8.5",
    rows: zones.map((zone) => ({
      optionId: zone.id,
      rowCitationId: `row-${zone.id}`,
      cells: fields.map(([fieldId], index) => ({
        fieldId,
        citationId: `cell-${zone.id}-${fieldId}`,
        token: zone.tokens[index],
        value: zone.values[fieldId],
      })),
    })),
  },
  visualChecks: [
    {
      citationId: "figura-8.5",
      method: "embedded text layer extracted with pdfplumber and the page rendered at 6× for visual confirmation",
      observed: "To/Tc/TL/Am/An/Fa/Fv for Zona A, Zona B and Zona C",
    },
    {
      citationId: "equation-plateau",
      method: "plate rendered at original resolution and inspected",
      observed: "Sa = 2.5AmFa, Sa = AnFv/T, Sa = Am/2 and the entrance branch on Figura 8.1",
    },
  ],
  internalConsistency: {
    method:
      "The printed branch limits must be the intersections of the printed branches; both identities were checked against the transcribed cells.",
    checks: [
      { identity: "Tc = An·Fv / (2.5·Am·Fa)", zoneA: "0.652 ≈ 0.65", zoneB: "0.50", zoneC: "0.50" },
      { identity: "TL = 2·An·Fv / Am", zoneA: "3.26 ≈ 3.25", zoneB: "2.50", zoneC: "2.50" },
    ],
    disposition:
      "Zone A rounds by one hundredth in both limits. The printed tokens govern; the identities are only a transcription check.",
  },
  nonInference:
    "The attestation binds the 21 printed cells of Figura 8.5 and the four printed branches of Figura 8.1. No coefficient is derived, interpolated or imported from any other study or from any reference website.",
};
const extractionAttestation = {
  ...attestPayload,
  payloadSha256: sha256(Buffer.from(stable(attestPayload))),
};

const formulaInventory = {
  schemaVersion: 1,
  status: "supported-full-curve",
  supportedInterval: "0 <= T",
  independentVariable: "period T (s)",
  output: "spectral acceleration",
  formulas: [
    {
      id: "manizales-entrance-branch",
      condition: "T <= To",
      expression: "Sa = Am × I + (Am × I / To) × (2.5 × Fa − 1) × T",
      citationId: "equation-entrance",
      dependencies: ["am", "to", "fa", "importanceFactor", "T"],
    },
    {
      id: "manizales-plateau-branch",
      condition: "To <= T <= Tc",
      expression: "Sa = 2.5 × Am × Fa × I",
      citationId: "equation-plateau",
      dependencies: ["am", "fa", "importanceFactor"],
    },
    {
      id: "manizales-inverse-branch",
      condition: "Tc < T <= TL",
      expression: "Sa = An × Fv × I / T",
      citationId: "equation-inverse",
      dependencies: ["an", "fv", "importanceFactor", "T"],
    },
    {
      id: "manizales-floor-branch",
      condition: "T > TL",
      expression: "Sa = Am × I / 2",
      citationId: "equation-floor",
      dependencies: ["am", "importanceFactor"],
    },
  ],
  unsupportedIntervals: [],
  coverage: { supportedBranches: 4, cited: 4, percent: 100 },
  decision:
    "Calculate the full municipal curve: the sheet prints all four branches and every parameter they consume. The importance coefficient multiplies the printed ordinate under design consideration (a).",
};

const claimsMatrix = {
  schemaVersion: 1,
  directMatrix: {
    expectedOptionHazardPairs: 3,
    exactCoveredPairs: 3,
    expectedFieldValues: 21,
    exactCoveredFieldValues: 21,
    directSourceValues: 21,
    coveragePercent: 100,
  },
  claimCoverage: {
    applicability: { expected: 17, cited: 17, percent: 100 },
    warnings: { expected: 2, cited: 2, percent: 100 },
  },
  claims: [
    {
      id: "three-zones",
      statement: "The 2002 study groups the city into three characteristic zones with a design spectrum each.",
      citationId: "three-zone-model",
    },
    {
      id: "zone-legend",
      statement: "Zone A is ash, Zone B is fill, Zone C is rock, flows and thin deposits.",
      citationId: "zone-map",
    },
    {
      id: "parameter-table",
      statement: "Figura 8.5 prints To, Tc, TL, Am, An, Fa and Fv for each of the three zones.",
      citationId: "figura-8.5",
    },
    {
      id: "damping",
      statement: "The published design spectra are for 5% of critical damping at ground surface.",
      citationId: "consideration-b-damping",
    },
    {
      id: "damping-label",
      statement: "The parameter sheet itself is labelled 5% of critical damping.",
      citationId: "damping-five-percent",
    },
    {
      id: "complementary-to-code",
      statement:
        "The recommendations complement the national code and no requirement may be taken below it — which is why the importance coefficient still multiplies the ordinate.",
      citationId: "consideration-a-complementary",
    },
    {
      id: "importance-anchor",
      statement: "The user-supplied importance factor follows the national table of importance coefficients.",
      citationId: "nsr10-a.2.5-1",
    },
    {
      id: "entrance-branch",
      statement: "The entrance branch below To is printed on Figura 8.1.",
      citationId: "equation-entrance",
    },
    {
      id: "plateau-branch",
      statement: "The plateau is Sa = 2.5·Am·Fa.",
      citationId: "equation-plateau",
    },
    {
      id: "inverse-branch",
      statement: "The descending branch is Sa = An·Fv/T.",
      citationId: "equation-inverse",
    },
    {
      id: "floor-branch",
      statement: "Beyond TL the sheet prints a constant floor Sa = Am/2.",
      citationId: "equation-floor",
    },
    {
      id: "branch-limits",
      statement: "To, Tc and TL are the printed abscissae that separate the branches.",
      citationId: "branch-limits",
    },
    {
      id: "special-analysis",
      statement: "Structures with a fundamental period at or above 2.0 s require special seismic analyses.",
      citationId: "warning-special-analysis",
    },
    {
      id: "zone-c-justification",
      statement: "Using the Zone C spectra must be explicitly justified by the geotechnical engineer.",
      citationId: "warning-zone-c-justification",
    },
    {
      id: "topographic-amplification",
      statement:
        "Sites near slope crests must additionally apply the topographic amplification factors, which this engine does not compute.",
      citationId: "consideration-c-topographic",
    },
    {
      id: "high-hazard",
      statement: "Manizales remains in a high seismic hazard zone for complementary code requirements.",
      citationId: "consideration-h-high-hazard",
    },
    {
      id: "am-equivalence",
      statement: "Am is the ground-surface equivalent of the national Aa coefficient.",
      citationId: "consideration-i-am-equivalent",
    },
    {
      id: "zone-of-doubt",
      statement: "When the zone is in doubt the study directs the engineer to use Zone A.",
      citationId: "selection-procedure",
    },
  ],
};

const uncertaintyLedger = {
  schemaVersion: 1,
  blocking: false,
  entries: [
    {
      id: "return-period-not-declared",
      severity: "localized-warning",
      issue:
        "Chapter 8 states no return period or exceedance probability for the design spectra, although the underlying uniform-hazard spectra elsewhere in the report are computed for several return periods.",
      disposition:
        "The hazard carries a null return period and the result warns about it. No national value is substituted.",
    },
    {
      id: "importance-factor-not-on-the-sheet",
      severity: "medium",
      issue:
        "Figura 8.5 prints the spectrum without an importance coefficient; the product multiplies the ordinate by I.",
      disposition:
        "Justified by design consideration (a): the recommendations are complementary to the national code and no requirement may fall below it. With I = 1.00 the curve is exactly the printed one, and the trace shows I as a separate cited step.",
    },
    {
      id: "topographic-amplification-not-applied",
      severity: "localized-warning",
      issue:
        "The plate prints Ftop for sites near slope crests; this engine does not know the slope height H or the distance to its edge.",
      disposition: "Not applied, and warned about with the citation to consideration (c).",
    },
    {
      id: "special-analysis-above-2s",
      severity: "localized-warning",
      issue: "Consideration (e) puts structures at or above 2.0 s outside the scope of these recommendations.",
      disposition:
        "The curve is still drawn — the branches are printed and attested — but the result warns from 2.0 s onward.",
    },
    {
      id: "zone-selection-is-manual",
      severity: "intentional-product-boundary",
      issue:
        "The product does not read the 1:30000 plate geographically; the responsible professional selects the zone.",
      disposition:
        "The drawer serves the plate so the selection can be checked by eye, and the result warns that the zone must be validated.",
    },
    {
      id: "figures-volume-redistribution",
      severity: "medium",
      issue:
        "public/manizales/uniandes-2002-figuras-8.1-8.5.pdf serves two rendered source pages of the figures volume, whose record grants no express redistribution licence.",
      disposition:
        "Shipped on the product owner's decision, scoped to the two pages that carry the model, and recorded in redistribution.json. Reverting means deleting the extract and setting localPath/localPageMap back to null.",
    },
    {
      id: "2014-harmonization-not-installed",
      severity: "medium",
      issue:
        "A 2014 NSR-10 harmonization and a 2015 raster update exist for Manizales; neither is installed here, and the UNGRD copies were unreachable at the last check.",
      disposition:
        "This study ships the 2002 zone model it can attest end to end. If a later model is adopted and published as a reproducible table, it supersedes this one — it does not silently amend it.",
    },
  ],
};

const conflictLedger = {
  schemaVersion: 1,
  entries: [
    {
      id: "rounded-branch-limits",
      status: "resolved-for-product",
      issue:
        "For Zone A the printed Tc and TL differ by one hundredth from the intersections implied by the printed Am, An, Fa and Fv.",
      resolution:
        "Transcribe the printed limits. The curve is drawn from the printed values, so it carries the same one-hundredth step the study published.",
    },
    {
      id: "importance-coefficient",
      status: "resolved-for-product",
      issue: "The sheet prints no I, but the national code the study complements defines one.",
      resolution:
        "Multiply by I under consideration (a), expose it as its own cited trace step, and record the decision in the uncertainty ledger.",
    },
    {
      id: "later-models-exist",
      status: "resolved-for-product",
      issue:
        "The 2014 harmonization and the 2015 update propose a point-wise Fa/Fv surface instead of three zones.",
      resolution:
        "Neither publishes a reproducible table; this study stays on the 2002 zones and says so in the mode description.",
    },
  ],
};

const referenceDifferences = {
  schemaVersion: 1,
  comparison: "Manizales versus EspectroCol (UX/behaviour only)",
  materialDifferences: [
    "The reference site offers five Manizales zones (Roca y Ladera Roca, Suelo Residual, Depósitos de Ladera, Planicie Aluvial, Rellenos Antrópicos); the official 2002 study defines three (A cenizas, B rellenos, C rocas).",
    "None of the reference site's five zone parameter sets matches Figura 8.5: its Am values run 0.20–0.25 against the study's 0.30–0.44.",
    "The reference site serves this same parameter sheet as its Manizales map, so its own displayed source does not carry the coefficients its calculator returns.",
    "This engine exposes the three official zones only, and draws every ordinate from Figura 8.5.",
  ],
  nonInference:
    "No coefficient, zone, formula or legal effect is imported from EspectroCol. It is used only to compare discoverability and behaviour, and the divergence above is recorded because a reader may reasonably expect the two to agree.",
};

const redistribution = {
  schemaVersion: 1,
  decision: "external-only-all-sources",
  committedSourceBytes: false,
  rationale: "No express redistribution authorization was found for the official PDFs.",
  prohibitedArtifacts: ["complete source PDFs", "other rendered pages", "map/GIS layers"],
  sources: sources.map(({ id, officialUrl }) => ({
    sourceDocumentId: id,
    officialUrl,
    decision: "external-only",
    rationale: externalOnly.rationale,
  })),
  tableExtractException: {
    sourceDocumentId: "manizales-uniandes-2002-figuras",
    committedArtifacts: ["public/manizales/uniandes-2002-figuras-8.1-8.5.pdf"],
    scope:
      "Páginas físicas 197 y 201 del volumen de figuras — la lámina de la Figura 8.1 con el mapa de zonificación, las cuatro ecuaciones y las consideraciones de diseño, y la Figura 8.5 con los siete parámetros de las tres zonas.",
    extractedFrom:
      "El PDF oficial de la UNAL/IDEA, re-descargado y verificado byte a byte contra el lock (38939870 bytes, SHA-256 fbcfa673…) antes de extraer.",
    permissionStatus: "not-established",
    ownerDecision:
      "Publicar las dos páginas: sin el mapa el ingeniero no puede ver en qué zona cae el predio, y sin la Figura 8.5 no puede ver el valor que la cita afirma.",
    reviewerAction:
      "Si el volumen de figuras no puede reproducirse, borrar el extracto y devolver localPath/localPageMap a null.",
  },
};

const review = {
  schemaVersion: 1,
  authorRole: "engine implementation",
  preparedOn: retrievedOn,
  independentReview: {
    status: "pending",
    reviewer: null,
    reviewedOn: null,
    scope: [
      "21-cell transcription of Figura 8.5",
      "four branch equations of Figura 8.1",
      "importance-coefficient decision under consideration (a)",
      "branch arithmetic and continuity at To, Tc and TL",
    ],
  },
  activationDecision: "calculation-supported-full-curve-with-localized-warnings",
  mergeDecision: "draft-pr-pending-independent-review",
};

const artifacts = {
  "data/canonical.json": canonical,
  "evidence/manifest.json": manifest,
  "evidence/source-locks.json": sourceLocks,
  "evidence/extraction-profile.json": extractionProfile,
  "evidence/extraction-attestation.json": extractionAttestation,
  "evidence/formula-inventory.json": formulaInventory,
  "evidence/claims-matrix.json": claimsMatrix,
  "evidence/uncertainty-ledger.json": uncertaintyLedger,
  "evidence/conflict-ledger.json": conflictLedger,
  "evidence/reference-site-differences.json": referenceDifferences,
  "evidence/redistribution.json": redistribution,
  "evidence/review-record.json": review,
};

const check = process.argv.includes("--check");
const mismatches = [];
for (const [relative, value] of Object.entries(artifacts)) {
  const path = resolve(root, relative);
  const bytes = stable(value);
  if (check) {
    if ((await readFile(path, "utf8").catch(() => null)) !== bytes) mismatches.push(relative);
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, "utf8");
  }
}
if (mismatches.length) {
  throw new Error(`Generated Manizales artifacts differ: ${mismatches.join(", ")}`);
}
process.stdout.write(
  `${check ? "checked" : "generated"} ${Object.keys(artifacts).length} Manizales artifacts\n`,
);
