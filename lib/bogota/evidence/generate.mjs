import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const studyRoot = resolve(here, "..");
const output = (path) => resolve(studyRoot, path);
const deterministicJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const options = [
  ["cerros", "CERROS"],
  ["piedemonte-a", "PIEDEMONTE A"],
  ["piedemonte-b", "PIEDEMONTE B"],
  ["piedemonte-c", "PIEDEMONTE C"],
  ["lacustre-50", "LACUSTRE-50"],
  ["lacustre-100", "LACUSTRE-100"],
  ["lacustre-200", "LACUSTRE-200"],
  ["lacustre-300", "LACUSTRE-300"],
  ["lacustre-500", "LACUSTRE-500"],
  ["lacustre-aluvial-200", "LACUSTRE ALUVIAL-200"],
  ["lacustre-aluvial-300", "LACUSTRE ALUVIAL-300"],
  ["aluvial-50", "ALUVIAL-50"],
  ["aluvial-100", "ALUVIAL-100"],
  ["aluvial-200", "ALUVIAL-200"],
  ["aluvial-300", "ALUVIAL-300"],
  ["deposito-ladera", "DEPOSITO LADERA"],
];

const hazards = [
  {
    id: "design",
    label: "Diseño",
    returnPeriodYears: 475,
    probability: "10% en 50 años",
    dampingRatio: 0.05,
    baseAccelerations: { Aa: 0.15, Av: 0.20 },
    printedPage: "139",
    physicalPage: 155,
    tableReference: "Tabla 6-1. Coeficientes de diseño",
    sourceFields: ["fa", "fv", "transition_end", "long_period", "ground_peak"],
    rows: [
      [1.35,1.30,0.62,3.0,0.18],[1.65,2.00,0.78,3.0,0.22],[1.95,1.70,0.56,3.0,0.26],[1.80,1.70,0.60,3.0,0.24],
      [1.40,2.90,1.33,4.0,0.21],[1.30,3.20,1.58,4.0,0.20],[1.20,3.50,1.87,4.0,0.18],[1.05,2.90,1.77,5.0,0.16],
      [0.95,2.70,1.82,5.0,0.14],[1.10,2.80,1.63,4.0,0.17],[1.00,2.50,1.60,5.0,0.15],[1.35,1.80,0.85,3.5,0.20],
      [1.20,2.10,1.12,3.5,0.18],[1.05,2.10,1.28,3.5,0.16],[0.95,2.10,1.41,3.5,0.14],[1.65,1.70,0.66,3.0,0.22],
    ],
  },
  {
    id: "limited-safety",
    label: "Seguridad limitada",
    returnPeriodYears: 225,
    probability: "20% en 50 años",
    dampingRatio: 0.05,
    baseAccelerations: { Ae: 0.13 },
    printedPage: "140",
    physicalPage: 156,
    tableReference: "Tabla 6-2. Coeficientes de seguridad limitada",
    sourceFields: ["fa", "fv", "transition_end", "long_period", "ground_peak"],
    rows: [
      [1.40,1.50,0.51,3.0,0.16],[1.70,2.35,0.66,3.0,0.20],[2.00,1.95,0.47,3.0,0.23],[1.85,1.95,0.51,3.0,0.22],
      [1.45,3.40,1.13,4.0,0.19],[1.35,3.70,1.32,4.0,0.18],[1.25,4.00,1.54,4.0,0.16],[1.10,3.40,1.48,5.0,0.14],
      [1.00,3.10,1.49,5.0,0.13],[1.15,3.20,1.34,4.0,0.15],[1.05,2.90,1.33,5.0,0.14],[1.40,2.10,0.72,3.5,0.18],
      [1.25,2.50,0.96,3.5,0.16],[1.10,2.50,1.09,3.5,0.14],[1.00,2.50,1.20,3.5,0.13],[1.70,1.95,0.55,3.0,0.20],
    ],
  },
  {
    id: "damage-threshold",
    label: "Umbral de daño",
    returnPeriodYears: 31,
    probability: "80% en 50 años",
    dampingRatio: 0.02,
    baseAccelerations: { Ad: 0.06 },
    printedPage: "141",
    physicalPage: 157,
    tableReference: "Tabla 6-3. Coeficientes de umbral de daño",
    sourceFields: ["fa", "fv", "transition_start", "transition_end", "long_period", "ground_peak"],
    rows: [
      [1.50,1.70,0.11,0.57,3.0,0.08],[1.90,2.75,0.14,0.72,3.0,0.10],[2.20,2.25,0.10,0.51,3.0,0.12],[2.05,2.25,0.11,0.55,3.0,0.11],
      [1.55,4.00,0.26,1.29,4.0,0.09],[1.45,4.40,0.30,1.52,4.0,0.09],[1.35,4.75,0.35,1.76,4.0,0.08],[1.25,4.00,0.32,1.60,5.0,0.08],
      [1.10,3.75,0.34,1.70,5.0,0.07],[1.30,3.85,0.30,1.48,4.0,0.08],[1.20,3.50,0.29,1.46,5.0,0.07],[1.50,2.50,0.17,0.83,3.5,0.09],
      [1.40,2.90,0.21,1.04,3.5,0.08],[1.20,2.90,0.24,1.21,3.5,0.07],[1.10,2.90,0.26,1.32,3.5,0.07],[1.90,2.25,0.12,0.59,3.0,0.10],
    ],
  },
];

const fieldIds = ["fa", "fv", "transition_start", "transition_end", "long_period", "ground_peak"];
const fieldUnits = { fa: null, fv: null, transition_start: "s", transition_end: "s", long_period: "s", ground_peak: "g" };
const fullPage = { left: 0, top: 0, width: 1, height: 1 };

const sources = [
  {
    id: "fopae-2010-final-report-v1",
    issuingAuthority: "Fondo de Prevención y Atención de Emergencias de Bogotá D.C. (FOPAE)",
    officialTitle: "Zonificación de la Respuesta Sísmica de Bogotá para el Diseño Sismo Resistente de Edificaciones — Informe final, volumen 1",
    edition: "Informe final, volumen 1, octubre de 2010",
    revision: null,
    adoptionInstrument: "Contenido técnico acogido originalmente por el Decreto Distrital 523 de 2010 y compilado en el Decreto Distrital 670 de 2025",
    amendmentsAndErrata: [],
    legalStatus: "historical",
    applicabilityStatus: "conditional",
    officialUrl: "https://backbiblio.sire.gov.co/server/api/core/bitstreams/fa01603a-e5d2-454d-96b0-07f8a73f0d35/content",
    retrievedOn: "2026-07-22",
    redistribution: {
      decision: "external-only",
      rationale: "La portada atribuye los derechos patrimoniales al FOPAE y exige autorización escrita para reproducción total o parcial; se conserva solo la huella verificable.",
    },
    mediaType: "application/pdf",
    pageCount: 168,
    sha256: "74ba7a6a8d038dce4a81eedc62a47fa2ed0f0a208481ff62dbbdb40dfaac6dc3",
    pages: [
      { physicalPage: 18, printedPage: "2", rotationDegrees: 0, crop: fullPage },
      { physicalPage: 140, printedPage: "124", rotationDegrees: 0, crop: fullPage },
      { physicalPage: 155, printedPage: "139", rotationDegrees: 0, crop: fullPage },
      { physicalPage: 156, printedPage: "140", rotationDegrees: 0, crop: fullPage },
      { physicalPage: 157, printedPage: "141", rotationDegrees: 0, crop: fullPage },
    ],
  },
  {
    id: "decreto-distrital-670-2025",
    issuingAuthority: "Alcaldía Mayor de Bogotá D.C.",
    officialTitle: "Decreto Distrital 670 de 2025 — Por medio del cual se expide el Decreto Único Distrital de Ordenamiento Territorial de Bogotá D.C.",
    edition: "Registro Distrital 8485 de 27 de diciembre de 2025",
    revision: "Texto SISJUR consultado el 22 de julio de 2026",
    adoptionInstrument: "Decreto Distrital 670 de 2025, Título 1, artículos 2 a 10",
    amendmentsAndErrata: [],
    legalStatus: "active",
    applicabilityStatus: "applicable",
    officialUrl: "https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?dt=S&i=191905",
    retrievedOn: "2026-07-22",
    redistribution: { decision: "external-only", rationale: "Página oficial dinámica y voluminosa; se fija por URL, fecha, longitud y SHA-256 sin incorporar una copia." },
    mediaType: "text/html",
    pageCount: 1,
    sha256: "dcf16893e8812c9ade0a2b7295f480b0b409e10e1bb6939a2b2eae73ef07e894",
    pages: [{ physicalPage: 1, printedPage: null, rotationDegrees: 0, crop: fullPage }],
  },
  {
    id: "decreto-distrital-523-2010",
    issuingAuthority: "Alcaldía Mayor de Bogotá D.C.",
    officialTitle: "Decreto Distrital 523 de 2010 — Por el cual se adopta la Microzonificación Sísmica de Bogotá D.C.",
    edition: "Registro Distrital 4566 de 24 de diciembre de 2010",
    revision: "Texto SISJUR consultado el 22 de julio de 2026",
    adoptionInstrument: "Decreto Distrital 523 de 2010",
    amendmentsAndErrata: [],
    legalStatus: "superseded",
    applicabilityStatus: "historical",
    officialUrl: "https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=40984",
    retrievedOn: "2026-07-22",
    redistribution: { decision: "external-only", rationale: "Página oficial histórica; se fija por URL, fecha, longitud y SHA-256 sin incorporar una copia." },
    mediaType: "text/html",
    pageCount: 1,
    sha256: "8b5e0e77d622af9dcd7d80a8a453500b5422b4385f4bad4c019a530cf3c943d7",
    pages: [{ physicalPage: 1, printedPage: null, rotationDegrees: 0, crop: fullPage }],
  },
];

function tableGeometry(hazard, rowIndex, fieldIndex) {
  const damage = hazard.id === "damage-threshold";
  const table = damage
    ? { left: 0.145, top: 0.135, width: 0.71, height: 0.25 }
    : { left: 0.185, top: 0.128, width: 0.63, height: 0.25 };
  const rowTop = (damage ? 0.174 : 0.166) + rowIndex * 0.01235;
  const row = { left: table.left + 0.004, top: rowTop, width: table.width - 0.008, height: 0.0115 };
  const numericStart = damage ? 0.353 : 0.395;
  const numericEnd = damage ? 0.845 : 0.808;
  const count = hazard.sourceFields.length;
  const cellWidth = (numericEnd - numericStart) / count;
  const cell = { left: numericStart + fieldIndex * cellWidth + 0.001, top: rowTop + 0.0005, width: cellWidth - 0.002, height: 0.0105 };
  return { table, row, cell };
}

const citations = [];
const values = [];
const rawRows = [];
const canonicalRows = [];

for (const hazard of hazards) {
  const tableId = `table-${hazard.id}`;
  const tableRect = tableGeometry(hazard, 0, 0).table;
  citations.push({
    id: tableId,
    sourceDocumentId: "fopae-2010-final-report-v1",
    regionKind: "table",
    physicalPage: hazard.physicalPage,
    printedPage: hazard.printedPage,
    reference: hazard.tableReference,
    rect: tableRect,
    extractedToken: `${hazard.tableReference}: 16 zonas y ${hazard.sourceFields.length} coeficientes por zona`,
    unit: null,
    transformation: null,
    requiredTokens: [hazard.tableReference],
  });

  if (hazard.id !== "damage-threshold") {
    citations.push({
      id: `equation-${hazard.id}-starts-at-zero`,
      sourceDocumentId: "fopae-2010-final-report-v1",
      regionKind: "equation",
      physicalPage: hazard.physicalPage,
      printedPage: hazard.printedPage,
      reference: `${hazard.tableReference}, gráfica y primer tramo`,
      rect: { left: 0.12, top: 0.39, width: 0.76, height: 0.30 },
      extractedToken: "T_initial = 0 s; the constant-acceleration branch begins at the graph origin",
      unit: null,
      transformation: null,
      requiredTokens: ["T_initial = 0 s"],
    });
  }

  hazard.rows.forEach((numbers, rowIndex) => {
    const [optionId, sourceLabel] = options[rowIndex];
    const rowId = `row-${hazard.id}-${optionId}`;
    const geometry = tableGeometry(hazard, rowIndex, 0);
    citations.push({
      id: rowId,
      sourceDocumentId: "fopae-2010-final-report-v1",
      regionKind: "row",
      physicalPage: hazard.physicalPage,
      printedPage: hazard.printedPage,
      reference: `${hazard.tableReference}, fila ${sourceLabel}`,
      parentCitationId: tableId,
      rect: geometry.row,
      extractedToken: `${sourceLabel} ${numbers.map((value) => Number(value).toFixed(value === 3 || value === 4 || value === 5 || value === 3.5 ? 1 : 2)).join(" ")}`,
      unit: null,
      transformation: null,
      requiredTokens: [sourceLabel],
    });

    const fields = {};
    const rowCitationIds = [];
    hazard.sourceFields.forEach((fieldId, fieldIndex) => {
      const value = numbers[fieldIndex];
      const citationId = `cell-${hazard.id}-${optionId}-${fieldId}`;
      const cell = tableGeometry(hazard, rowIndex, fieldIndex).cell;
      const printed = (fieldId === "long_period" && Number.isInteger(value)) ? value.toFixed(1) : value.toFixed(2);
      citations.push({
        id: citationId,
        sourceDocumentId: "fopae-2010-final-report-v1",
        regionKind: "cell",
        physicalPage: hazard.physicalPage,
        printedPage: hazard.printedPage,
        reference: `${hazard.tableReference}, ${sourceLabel}, ${fieldId}`,
        parentCitationId: rowId,
        rect: cell,
        extractedToken: printed,
        normalizedValue: value,
        normalizedNumericValue: value,
        unit: fieldUnits[fieldId],
        transformation: "decimal parse",
        requiredTokens: [printed],
      });
      values.push({
        id: `value-${hazard.id}-${optionId}-${fieldId}`,
        optionId,
        hazardId: hazard.id,
        fieldId,
        value,
        unit: fieldUnits[fieldId],
        provenance: "direct-source",
        citationIds: [citationId],
        transformation: "decimal parse",
      });
      fields[fieldId] = value;
      rowCitationIds.push(citationId);
    });

    if (hazard.id !== "damage-threshold") {
      const dependencyValueId = `value-${hazard.id}-${optionId}-fa`;
      const dependencyCitationId = `cell-${hazard.id}-${optionId}-fa`;
      fields.transition_start = 0;
      values.push({
        id: `value-${hazard.id}-${optionId}-transition_start`,
        optionId,
        hazardId: hazard.id,
        fieldId: "transition_start",
        value: 0,
        unit: "s",
        provenance: "derived",
        citationIds: [],
        transformation: null,
        derivedLineage: {
          dependencies: [{ valueId: dependencyValueId, inputCitationIds: [dependencyCitationId] }],
          formulaCitationId: `equation-${hazard.id}-starts-at-zero`,
          formula: "T_initial = 0 s",
          substitution: "The published first branch begins at T = 0 s; Fa identifies the selected row.",
          result: 0,
          unit: "s",
        },
      });
    }

    const orderedFields = Object.fromEntries(fieldIds.map((fieldId) => [fieldId, fields[fieldId]]));
    const raw = {
      id: `raw-${hazard.id}-${optionId}`,
      rowKey: `${optionId}/${hazard.id}`,
      sourceDocumentId: "fopae-2010-final-report-v1",
      optionId,
      hazardId: hazard.id,
      citationIds: rowCitationIds,
      fields: orderedFields,
    };
    rawRows.push(raw);
    canonicalRows.push({ ...raw, id: `canonical-${hazard.id}-${optionId}`, sourceRowIds: [raw.id] });
  });
}

const applicabilityCitations = [
  {
    id: "applicability-current-decree-670-title-1",
    sourceDocumentId: "decreto-distrital-670-2025",
    regionKind: "applicability",
    physicalPage: 1,
    printedPage: null,
    reference: "Título 1, artículos 2 a 10; artículos 1520 a 1526",
    rect: { left: 0, top: 0, width: 1, height: 1 },
    extractedToken: "El Decreto 670 de 2025 compila en el Título 1 las disposiciones de microzonificación; el artículo 1526 deroga expresamente el Decreto 523 de 2010 y el artículo 1525 conserva los mapas como anexos.",
    unit: null,
    transformation: null,
    requiredTokens: ["Decreto 670 de 2025", "Decreto 523 de 2010"],
  },
  {
    id: "applicability-historical-decree-523-adoption",
    sourceDocumentId: "decreto-distrital-523-2010",
    regionKind: "applicability",
    physicalPage: 1,
    printedPage: null,
    reference: "Artículos 1, 4 y 10",
    rect: { left: 0, top: 0, width: 1, height: 1 },
    extractedToken: "El Decreto 523 de 2010 adoptó la microzonificación y sus tablas; su artículo 10 derogó el Decreto 193 de 2006. Hoy es antecedente histórico por la derogatoria compilatoria del Decreto 670 de 2025.",
    unit: null,
    transformation: null,
    requiredTokens: ["Decreto 523 de 2010", "Decreto 193 de 2006"],
  },
];
citations.push(...applicabilityCitations);

const study = {
  schemaVersion: 1,
  studyId: "bogota-microzonation",
  title: "Bogotá D.C. — microzonificación sísmica, dossier de investigación",
  sources,
  citations,
  applicabilityCitationIds: applicabilityCitations.map(({ id }) => id),
  coverage: { optionIds: options.map(([id]) => id), hazardIds: hazards.map(({ id }) => id), fieldIds },
  values,
  rawRows,
  canonicalRows,
  overrides: [],
};

const canonical = {
  schemaVersion: 1,
  studyId: study.studyId,
  status: "research-only-not-activated",
  controllingInstrument: "decreto-distrital-670-2025",
  historicalAdoptionInstrument: "decreto-distrital-523-2010",
  technicalSource: "fopae-2010-final-report-v1",
  fieldSemantics: {
    fa: "Dimensionless short-period amplification coefficient",
    fv: "Dimensionless intermediate-period amplification coefficient",
    transition_start: "Start of the plateau branch; T=0 for design/limited-safety and tabulated T0d for damage-threshold",
    transition_end: "Tabulated Tc or Tcd in seconds; table value is the canonical branch boundary",
    long_period: "Tabulated TL or TLd in seconds",
    ground_peak: "Tabulated A0 or A0d in g",
  },
  options: options.map(([id, sourceLabel]) => ({ id, sourceLabel })),
  hazards: hazards.map((hazard) => ({
    id: hazard.id,
    label: hazard.label,
    returnPeriodYears: hazard.returnPeriodYears,
    probability: hazard.probability,
    dampingRatio: hazard.dampingRatio,
    baseAccelerations: hazard.baseAccelerations,
    printedPage: hazard.printedPage,
    physicalPage: hazard.physicalPage,
    tableReference: hazard.tableReference,
    sourceFields: hazard.sourceFields,
  })),
  rows: canonicalRows.map(({ optionId, hazardId, fields }) => ({ optionId, hazardId, fields })),
};

const sourceLocks = {
  schemaVersion: 1,
  policy: "All three official-source files remain external-only. Re-fetch from the exact URL and compare length and SHA-256 before independent review.",
  locks: [
    { sourceDocumentId: "fopae-2010-final-report-v1", officialUrl: sources[0].officialUrl, retrievedOn: "2026-07-22", byteLength: 12386790, sha256: sources[0].sha256, md5FromRepositoryMetadata: "2ba849ac3b7098c1d2da81846b0ee564", mediaType: "application/pdf", pageCount: 168, redistributionDecision: "external-only" },
    { sourceDocumentId: "decreto-distrital-670-2025", officialUrl: sources[1].officialUrl, retrievedOn: "2026-07-22", byteLength: 13078215, sha256: sources[1].sha256, mediaType: "text/html", virtualPageCount: 1, redistributionDecision: "external-only" },
    { sourceDocumentId: "decreto-distrital-523-2010", officialUrl: sources[2].officialUrl, retrievedOn: "2026-07-22", byteLength: 130472, sha256: sources[2].sha256, mediaType: "text/html", virtualPageCount: 1, redistributionDecision: "external-only" },
  ],
};

const extractionProfile = {
  schemaVersion: 1,
  sourceDocumentId: "fopae-2010-final-report-v1",
  renderer: { engine: "Poppler pdftoppm", dpi: 144, renderedPixels: { width: 1224, height: 1584 }, rotationDegrees: 0 },
  coordinateSystem: "normalized top-left origin; rect = left/top/width/height divided by rendered page width/height",
  tables: hazards.map((hazard) => ({ hazardId: hazard.id, physicalPage: hazard.physicalPage, printedPage: hazard.printedPage, reference: hazard.tableReference, rect: tableGeometry(hazard, 0, 0).table, rowCount: 16, numericColumnCount: hazard.sourceFields.length })),
  qualityControls: ["Two decimal digits preserved where printed; TL/TLd preserve one decimal digit.", "Each direct value has one cell citation nested in its exact row and table.", "Coordinates were visually checked against the 1224×1584 render; no OCR-derived numeric value was accepted without visual transcription."],
};

const formulaInventory = {
  schemaVersion: 1,
  boundaryPolicy: "Use the published tabulated Tc/Tcd/T0d/TL/TLd values as branch boundaries. Formula-derived boundary values are audit witnesses only because the tables round to two decimals.",
  variables: { T: "s", Sa: "g", Sad: "g", I: "dimensionless", Aa: "0.15 g", Av: "0.20 g", Ae: "0.13 g", Ad: "0.06 g" },
  formulas: [
    ["design-plateau", "design", "0 <= T <= Tc", "Sa = 2.5 * Aa * Fa * I", 155, "139"],
    ["design-decay", "design", "Tc < T <= TL", "Sa = 1.2 * Av * Fv * I / T", 155, "139"],
    ["design-long", "design", "T > TL", "Sa = 1.2 * Av * Fv * TL * I / T^2", 155, "139"],
    ["design-tc-audit", "design", "audit only", "Tc_formula = 0.48 * Av * Fv / (Aa * Fa)", 155, "139"],
    ["limited-plateau", "limited-safety", "0 <= T <= Tc", "Sa = 2.5 * Ae * Fa * I", 156, "140"],
    ["limited-decay", "limited-safety", "Tc < T <= TL", "Sa = 1.2 * Ae * Fv * I / T", 156, "140"],
    ["limited-long", "limited-safety", "T > TL", "Sa = 1.2 * Ae * Fv * TL * I / T^2", 156, "140"],
    ["limited-tc-audit", "limited-safety", "audit only", "Tc_formula = 0.48 * Fv / Fa", 156, "140"],
    ["damage-ramp", "damage-threshold", "0 <= T < T0d", "Sad = A0d + ((3 * Ad * Fa - A0d) / T0d) * T", 157, "141"],
    ["damage-plateau", "damage-threshold", "T0d <= T <= Tcd", "Sad = 3 * Ad * Fa", 157, "141"],
    ["damage-decay", "damage-threshold", "Tcd < T <= TLd", "Sad = 1.5 * Ad * Fv / T", 157, "141"],
    ["damage-long", "damage-threshold", "T > TLd", "Sad = 1.5 * Ad * Fv * TLd / T^2", 157, "141"],
    ["damage-t0d-audit", "damage-threshold", "audit only", "T0d_formula = 0.1 * Fv / Fa", 157, "141"],
    ["damage-tcd-audit", "damage-threshold", "audit only", "Tcd_formula = 0.5 * Fv / Fa", 157, "141"],
  ].map(([id, hazardId, domain, expression, physicalPage, printedPage]) => ({ id, hazardId, domain, expression, citation: { sourceDocumentId: "fopae-2010-final-report-v1", physicalPage, printedPage, reference: `${hazards.find((hazard) => hazard.id === hazardId).tableReference}, curva y ecuaciones`, rect: { left: 0.12, top: 0.38, width: 0.76, height: 0.34 } } })),
};

const claimsMatrix = {
  schemaVersion: 1,
  claims: [
    ["legal-current", "The controlling current text is Decreto 670/2025, Title 1, Articles 2–10; D523/2010 is the named compilation origin, not a parallel current instrument.", "decreto-distrital-670-2025", "Título 1, artículos 2–10; artículo 1526, ítem 50"],
    ["legal-preservation", "Compilation/repeal does not erase consolidated effects or the technical motivations; maps are preserved as annexes.", "decreto-distrital-670-2025", "Artículos 1520–1522 y 1525"],
    ["scope-mandatory", "The Bogotá provisions are mandatory, substitute NSR-10 A.2.4 and A.2.6, apply to buildings in A.1.2.3, and cannot be used with NSR-98.", "decreto-distrital-670-2025", "Artículo 2"],
    ["scope-design", "Design coefficients apply to new, expanded, adapted, structurally modified, strengthened, or rehabilitated buildings; NSR-10 Title E construction is excluded.", "decreto-distrital-670-2025", "Artículo 5, párrafo inicial"],
    ["scope-limited", "Limited-safety coefficients apply to NSR-10 Title A.10 evaluation and intervention of existing buildings.", "decreto-distrital-670-2025", "Artículo 5, después de Tabla 3"],
    ["scope-damage", "Damage-threshold coefficients apply to Group IV and the stated Group III buildings under NSR-10 Title A.12.", "decreto-distrital-670-2025", "Artículo 5, antes de Tabla 5"],
    ["warning-professional-zone", "A geotechnical professional must classify the site from the official maps and the Title H geotechnical study; inconsistent ground requires expanded study.", "decreto-distrital-670-2025", "Artículo 6, numeral 5"],
    ["warning-transition", "Inside the 100 m transition band, use the period-dependent average acceleration of adjacent zones unless supported reclassification applies.", "decreto-distrital-670-2025", "Artículo 6, numeral 6"],
    ["warning-reclassification", "A supported alternate classification must be adjacent or at most one intervening zone away and within 500 m.", "decreto-distrital-670-2025", "Artículo 6, numeral 5"],
    ["warning-site-specific", "Fills thicker than 3 m and rigid-base fundamental periods above 2.5 s require a site-specific seismic response study.", "decreto-distrital-670-2025", "Artículo 7, numerales 1 y 2"],
    ["warning-resonance", "For building periods above 1.0 s, evaluate soil-building resonance within ±10% of the deposit period.", "decreto-distrital-670-2025", "Artículo 6, numeral 10"],
    ["warning-liquefaction", "Piedemonte, Aluvial, Llanura and channel/susceptible-soil settings require liquefaction assessment where applicable.", "decreto-distrital-670-2025", "Artículo 8"],
    ["warning-minimums", "Site-specific Fa/Fv cannot be below NSR-10 A.2.10.2.4 or 80% of the municipal values; higher values govern.", "decreto-distrital-670-2025", "Artículo 7, parágrafo"],
    ["technical-recurrence", "The three levels are 475 years/10% in 50 years/5%, 225 years/20% in 50 years/5%, and 31 years/80% in 50 years/2%.", "fopae-2010-final-report-v1", "Página física 140, impresa 124"],
    ["technical-building-only", "The published parameters are for building design and amplification factors are tied to NSR-10 formulations.", "fopae-2010-final-report-v1", "Página física 140, impresa 124"],
  ].map(([id, statement, sourceDocumentId, reference]) => ({ id, statement, citation: { sourceDocumentId, physicalPage: sourceDocumentId === "fopae-2010-final-report-v1" ? 140 : 1, printedPage: sourceDocumentId === "fopae-2010-final-report-v1" ? "124" : null, reference, rect: fullPage } })),
  directMatrix: { expectedOptionHazardPairs: 48, exactCoveredPairs: 48, expectedFieldValues: 288, exactCoveredFieldValues: 288, directSourceValues: 256, derivedValues: 32 },
};

const uncertaintyLedger = {
  schemaVersion: 1,
  activationStatus: "research-complete-review-pending",
  entries: [
    { id: "official-maps-not-ingested", severity: "intentional-product-boundary", issue: "The official geotechnical and seismic-response map layers were not ingested because the product brief excludes GIS automation. A manually selected zone must be verified by the responsible professional.", disposition: "No coordinate-to-zone lookup is authorized; the supported workflow is explicit manual zone selection with the regulatory warning." },
    { id: "current-article-annotation-check", severity: "low", issue: "The SISJUR page contains later amendment annotations elsewhere in the compiled decree.", disposition: "The retrieved current text showed no amendment annotation attached to Title 1 Articles 2–10; re-check the current official page at product activation." },
    { id: "external-source-reproducibility", severity: "medium", issue: "Copyright and dynamic-page constraints prevent bundling source bytes.", disposition: "Independent reviewer must re-fetch and verify the committed URL/length/SHA-256 locks." },
  ],
};

const conflictLedger = {
  schemaVersion: 1,
  entries: [
    { id: "compiled-versus-origin", status: "resolved", issue: "D523/2010 contains the original adoption but D670/2025 expressly repeals it while compiling its provisions.", resolution: "Cite D670/2025 as current controlling law and D523/2010 only as historical adoption provenance. Do not characterize the compilation as a technical supersession." },
    { id: "rounded-boundaries", status: "resolved-for-research-review-required-for-activation", issue: "Tabulated Tc/Tcd/T0d are rounded to two decimals, so recomputing the printed formulas can produce small differences and discontinuities at tabulated boundaries.", resolution: "Canonical branch selection uses the adopted direct table values. Exact formula-derived values remain audit witnesses in the independent oracle; no silent recomputation replaces the printed table." },
    { id: "limited-safety-label-typos", status: "resolved", issue: "Some HTML parameter labels in SISJUR are visibly garbled or duplicated due equation/image extraction.", resolution: "Use the legible official FOPAE PDF equations and tables as the technical source; use the decree for adoption and scope." },
  ],
};

const referenceSiteDifferences = {
  schemaVersion: 1,
  comparison: "Decreto 523/2010 vs current Decreto 670/2025 Title 1",
  unchangedTechnicalContent: ["16 response-zone rows", "Tables 3–5 numeric coefficients", "Three hazard-level curve families", "Core warnings and site-specific-study triggers"],
  observedAdministrativeUpdates: ["D670 Article 4 references Decreto 555/2021 Article 29 instead of D190/2004 Article 144.", "D670 names IDIGER/SIRE where the original instrument named FOPAE/SIRE.", "D670 renumbers D523 Articles 1–9 as Title 1 Articles 2–10 and carries parenthetical origin annotations."],
  legalEffect: "D670 Article 1526 expressly repeals the compiled D523 instrument; Articles 1520–1522 preserve consolidated legal effects and motivations, and Article 1525 preserves maps as annexes.",
  nonInference: "This comparison does not infer a new technical study, coefficient change, or technical supersession where none is stated.",
};

const redistribution = {
  schemaVersion: 1,
  decision: "external-only-all-sources",
  rationale: ["The FOPAE report cover requires written authorization for reproduction.", "The SISJUR pages are current/historical official dynamic records and are kept pathless to avoid stale vendored legal text.", "Only structured factual transcriptions, source fingerprints, and normalized coordinates are committed."],
  prohibitedArtifacts: ["Source PDF", "Rendered source pages", "Downloaded SISJUR HTML", "Formula JPEGs"],
};

const reviewRecord = {
  schemaVersion: 1,
  authorRole: "research agent R2",
  preparedOn: "2026-07-22",
  independentReview: { status: "pending", reviewer: null, reviewedOn: null, scope: ["source-lock re-fetch", "16×3 transcription", "formula branches", "legal currentness", "warning completeness", "rounded-boundary policy"] },
  activationDecision: "blocked-pending-independent-review",
};

const artifacts = {
  "data/canonical.json": canonical,
  "evidence/manifest.json": study,
  "evidence/source-locks.json": sourceLocks,
  "evidence/extraction-profile.json": extractionProfile,
  "evidence/formula-inventory.json": formulaInventory,
  "evidence/claims-matrix.json": claimsMatrix,
  "evidence/uncertainty-ledger.json": uncertaintyLedger,
  "evidence/conflict-ledger.json": conflictLedger,
  "evidence/reference-site-differences.json": referenceSiteDifferences,
  "evidence/redistribution.json": redistribution,
  "evidence/review-record.json": reviewRecord,
};

const checkOnly = process.argv.includes("--check");
const mismatches = [];
for (const [relativePath, value] of Object.entries(artifacts)) {
  const bytes = deterministicJson(value);
  const path = output(relativePath);
  if (checkOnly) {
    const existing = await readFile(path, "utf8").catch(() => null);
    if (existing !== bytes) mismatches.push(relativePath);
  } else {
    await writeFile(path, bytes, "utf8");
  }
}
if (mismatches.length) throw new Error(`Generated Bogotá artifacts differ: ${mismatches.join(", ")}`);

const hashes = Object.fromEntries(Object.entries(artifacts).map(([path, value]) => [path, sha256(Buffer.from(deterministicJson(value), "utf8"))]));
process.stdout.write(`${checkOnly ? "checked" : "generated"} ${Object.keys(artifacts).length} Bogotá artifacts\n${deterministicJson(hashes)}`);
