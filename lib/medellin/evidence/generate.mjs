import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const studyRoot = resolve(here, "..");
const output = (path) => resolve(studyRoot, path);
const deterministicJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const fullPage = { left: 0, top: 0, width: 1, height: 1 };
const technicalSourceId = "medellin-dap-2011-support";
const options = [
  ["zone-01", "Zona homogénea 1", "Noroccidental"],
  ["zone-02", "Zona homogénea 2", "Centro occidental"],
  ["zone-03", "Zona homogénea 3", "Suroccidental"],
  ["zone-04", "Zona homogénea 4", "Flujos del sector occidental"],
  ["zone-05", "Zona homogénea 5", "Depósitos aluviales finos (margen izquierda río Medellín)"],
  ["zone-06", "Zona homogénea 6", "Depósitos aluviales gruesos"],
  ["zone-07", "Zona homogénea 7", "Depósitos aluviales finos (sector oriental)"],
  ["zone-08", "Zona homogénea 8", "Suelos residuales de dunita parte baja"],
  ["zone-09", "Zona homogénea 9", "Suelos residuales de anfibolita"],
  ["zone-10", "Zona homogénea 10", "Suelos residuales de dunita parte alta"],
  ["zone-11", "Zona homogénea 11", "Margen izquierda de la quebrada Santa Elena"],
  ["zone-12", "Zona homogénea 12", "Transición suelos residuales de gabro y anfibolita"],
  ["zone-13", "Zona homogénea 13", "Flujos parte alta de El Poblado"],
  ["zone-14", "Zona homogénea 14", "Flujos parte baja de El Poblado"],
];

const hazards = [
  {
    id: "damage-control",
    label: "Sismo de control de daños (también llamado de servicio)",
    dampingRatio: 0.02,
    returnPeriodYears: null,
    sourceColumnOffset: 0,
    rows: [
      [0.05, 4.50, 0.23, 0.10, 0.50, 1.43], [0.08, 2.80, 0.22, 0.10, 0.30, 1.17],
      [0.07, 3.57, 0.25, 0.10, 0.50, 1.48], [0.05, 3.60, 0.18, 0.10, 0.60, 1.46],
      [0.06, 3.66, 0.22, 0.10, 0.50, 1.42], [0.05, 2.81, 0.14, 0.10, 0.40, 1.11],
      [0.06, 3.66, 0.22, 0.10, 0.50, 1.42], [0.08, 2.25, 0.18, 0.10, 0.65, 1.52],
      [0.06, 3.75, 0.23, 0.10, 0.40, 1.31], [0.09, 2.78, 0.25, 0.10, 0.40, 1.35],
      [0.06, 3.75, 0.23, 0.10, 0.50, 1.43], [0.06, 4.16, 0.25, 0.10, 0.65, 1.67],
      [0.06, 4.16, 0.25, 0.10, 0.40, 1.35], [0.05, 2.81, 0.14, 0.10, 0.50, 1.23],
    ],
  },
  {
    id: "design",
    label: "Sismo de diseño",
    dampingRatio: 0.05,
    returnPeriodYears: null,
    sourceColumnOffset: 6,
    rows: [
      [0.27, 2.60, 0.70, 0.10, 0.60, 1.34], [0.34, 2.35, 0.80, 0.10, 0.40, 1.17],
      [0.30, 2.66, 0.80, 0.20, 0.70, 1.52], [0.23, 2.17, 0.50, 0.10, 0.65, 1.22],
      [0.20, 3.00, 0.60, 0.10, 0.60, 1.26], [0.20, 2.50, 0.50, 0.10, 0.50, 1.07],
      [0.20, 3.00, 0.60, 0.10, 0.60, 1.26], [0.23, 2.40, 0.55, 0.10, 0.75, 1.37],
      [0.26, 2.70, 0.70, 0.10, 0.55, 1.28], [0.38, 2.10, 0.80, 0.10, 0.50, 1.29],
      [0.26, 2.88, 0.75, 0.10, 0.65, 1.43], [0.26, 3.07, 0.80, 0.15, 0.70, 1.52],
      [0.26, 3.07, 0.80, 0.10, 0.50, 1.29], [0.20, 3.00, 0.60, 0.10, 0.55, 1.21],
    ],
  },
];

const fields = [
  ["ground_peak", "aSmax", "g"],
  ["short_amplification", "Fa", null],
  ["plateau_per_importance", "Samax/I", "g"],
  ["plateau_start", "T0", "s"],
  ["decay_start", "Tc", "s"],
  ["decay_exponent", "α", null],
];

const sources = [
  {
    id: technicalSourceId,
    issuingAuthority: "Departamento Administrativo de Planeación, Alcaldía de Medellín",
    officialTitle: "Descripción de zonas homogéneas — Microzonificación sísmica del área urbana de Medellín",
    edition: "Documentos de soporte, mayo de 2011",
    revision: null,
    adoptionInstrument: "Documento adjunto a la directiva DAP de 25 de abril de 2011; no es un decreto de adopción general",
    amendmentsAndErrata: [], legalStatus: "historical", applicabilityStatus: "conditional",
    officialUrl: "https://www.medellin.gov.co/irj/go/km/docs/wpccontent/Sites/Subportal%20del%20Ciudadano/Plan%20de%20Desarrollo/Secciones/Informaci%C3%B3n%20General/Documentos/POT/Recomendaciones%20Microzonificaci%C3%B3n%20S%C3%ADsmica/Microzonificaci%C3%B3n%20s%C3%ADsmica%20del%20%C3%A1rea%20urbana%20de%20Medell%C3%ADn.pdf",
    retrievedOn: "2026-07-22",
    redistribution: { decision: "external-only", rationale: "El portal oficial no publica licencia de redistribución; se conservan URL, tamaño, páginas y SHA-256, no los bytes." },
    mediaType: "application/pdf", pageCount: 24,
    sha256: "31376f731fdc838fd1341f253d62fd0bac4691cefe6fb9e93143780799468160",
    pages: [4,5,7,8,9,10,11,12,13,14,15,16,18,20,21,22,23,24].map((physicalPage) => ({ physicalPage, printedPage: null, rotationDegrees: 0, crop: fullPage })),
  },
  {
    id: "medellin-dap-letter-2011",
    issuingAuthority: "Departamento Administrativo de Planeación, Alcaldía de Medellín",
    officialTitle: "Oficio R-201100184890 — Cumplimiento de la NSR-2010 para edificaciones indispensables y de atención a la comunidad",
    edition: "25 de abril de 2011", revision: null,
    adoptionInstrument: "Directiva administrativa dirigida al alcalde y a entidades públicas, descentralizadas y Empresas Comerciales del Estado",
    amendmentsAndErrata: [], legalStatus: "unknown", applicabilityStatus: "conditional",
    officialUrl: "https://www.medellin.gov.co/irj/go/km/docs/wpccontent/Sites/Subportal%20del%20Ciudadano/Plan%20de%20Desarrollo/Secciones/Informaci%C3%B3n%20General/Documentos/POT/Recomendaciones%20Microzonificaci%C3%B3n%20S%C3%ADsmica/Oficio%20microzonificaci%C3%B3n%20s%C3%ADsmica.pdf",
    retrievedOn: "2026-07-22",
    redistribution: { decision: "external-only", rationale: "Oficio escaneado sin licencia expresa de redistribución; se conserva huella y transcripción verificable." },
    mediaType: "application/pdf", pageCount: 2,
    sha256: "baf1c46237b4529fb28a574813f995f70e6732e1050e4206fbd501c68962bed1",
    pages: [{ physicalPage: 1, printedPage: "1", rotationDegrees: 0, crop: fullPage }, { physicalPage: 2, printedPage: "2", rotationDegrees: 0, crop: fullPage }],
  },
  {
    id: "medellin-pot-evaluation-2014",
    issuingAuthority: "Departamento Administrativo de Planeación, Alcaldía de Medellín",
    officialTitle: "Revisión y Ajuste al Plan de Ordenamiento Territorial — Tomo IIIb, Evaluación y Seguimiento",
    edition: "2014", revision: null,
    adoptionInstrument: "Documento técnico de soporte del Acuerdo 48 de 2014; diagnóstico, no reglamentación sustitutiva NSR-10",
    amendmentsAndErrata: [], legalStatus: "historical", applicabilityStatus: "not-applicable",
    officialUrl: "https://www.medellin.gov.co/irj/go/km/docs/pccdesign/SubportaldelCiudadano_2/PlandeDesarrollo_0_17/ProgramasyProyectos/Shared%20Content/Documentos/2015/DTS_POT048/POT_IIIb_Evaluaci%C3%B3nSeguimiento.pdf",
    retrievedOn: "2026-07-22",
    redistribution: { decision: "external-only", rationale: "El portal oficial no publica licencia de redistribución; se conserva una huella de la fuente externa." },
    mediaType: "application/pdf", pageCount: 284,
    sha256: "895088861c0b9ce77a162c1a9927553835ceac4b6b5046312526d6f9bd161684",
    pages: [188,189,191,192].map((physicalPage) => ({ physicalPage, printedPage: String(physicalPage - 1), rotationDegrees: 0, crop: fullPage })),
  },
  {
    id: "medellin-pot-inputs-2026-v2",
    issuingAuthority: "Distrito Especial de Ciencia, Tecnología e Innovación de Medellín",
    officialTitle: "Insumos técnicos Tomo IIIA",
    edition: "Versión 2, marzo de 2026", revision: "Consulta oficial 22 de julio de 2026",
    adoptionInstrument: "Insumo de revisión POT; declara que el decreto de adopción de la microzonificación no ha sido adoptado",
    amendmentsAndErrata: [], legalStatus: "draft", applicabilityStatus: "not-applicable",
    officialUrl: "https://www.medellin.gov.co/es/wp-content/uploads/2026/03/Insumos_Tecnicos_TomoIIIA-v2.pdf",
    retrievedOn: "2026-07-22",
    redistribution: { decision: "external-only", rationale: "Documento oficial de trabajo sin licencia expresa de redistribución; se conserva huella y localizador." },
    mediaType: "application/pdf", pageCount: 944,
    sha256: "c92b571be8e4b48dfda77fe93d832aa27304a8dd36e5bd782052ede7d67526ce",
    pages: [{ physicalPage: 193, printedPage: "168", rotationDegrees: 0, crop: fullPage }],
  },
];

const tableCitation = {
  id: "table-historical-coefficients", sourceDocumentId: technicalSourceId, regionKind: "table",
  physicalPage: 22, printedPage: null, reference: "Tabla 0. Coeficientes espectrales",
  rect: { left: 0.12, top: 0.05, width: 0.65, height: 0.20 },
  extractedToken: "Tabla 0. Coeficientes espectrales para los sismos de control de daños y de diseño",
  unit: null, transformation: null, requiredTokens: ["Tabla 0", "control de daños", "diseño"],
};
const fieldX = [0.203,0.254,0.294,0.338,0.383,0.428,0.475,0.526,0.566,0.611,0.657,0.703];
const fieldWidths = [0.048,0.037,0.041,0.043,0.043,0.043,0.048,0.037,0.043,0.043,0.043,0.048];
const citations = [tableCitation];
const values = [];
const rawRows = [];
const canonicalRows = [];

for (const hazard of hazards) {
  hazard.rows.forEach((rowValues, rowIndex) => {
    const [optionId, sourceLabel] = options[rowIndex];
    const rowId = `row-${hazard.id}-${optionId}`;
    const top = 0.082 + rowIndex * 0.01095;
    const rowToken = `${rowIndex + 1} ${rowValues.map((value) => value.toFixed(2)).join(" ")}`;
    citations.push({
      id: rowId, sourceDocumentId: technicalSourceId, regionKind: "row", physicalPage: 22,
      printedPage: null, reference: `Tabla 0, ${sourceLabel}, ${hazard.label}`,
      parentCitationId: tableCitation.id, rect: { left: 0.125, top, width: 0.635, height: 0.0105 },
      extractedToken: rowToken, unit: null, transformation: null, requiredTokens: [String(rowIndex + 1)],
    });
    const fieldsObject = {};
    const cellIds = [];
    rowValues.forEach((value, fieldIndex) => {
      const [fieldId, sourceField, unit] = fields[fieldIndex];
      const cellId = `cell-${hazard.id}-${optionId}-${fieldId}`;
      const token = value.toFixed(2);
      const sourceColumn = hazard.sourceColumnOffset + fieldIndex;
      citations.push({
        id: cellId, sourceDocumentId: technicalSourceId, regionKind: "cell", physicalPage: 22,
        printedPage: null, reference: `Tabla 0, ${sourceLabel}, ${hazard.label}, ${sourceField}`,
        parentCitationId: rowId,
        rect: { left: fieldX[sourceColumn], top: top + 0.0002, width: fieldWidths[sourceColumn], height: 0.0099 },
        extractedToken: token, normalizedValue: value, normalizedNumericValue: value, unit,
        transformation: "decimal parse", requiredTokens: [token],
      });
      values.push({ id: `value-${hazard.id}-${optionId}-${fieldId}`, optionId, hazardId: hazard.id, fieldId, value, unit, provenance: "direct-source", citationIds: [cellId], transformation: "decimal parse" });
      fieldsObject[fieldId] = value;
      cellIds.push(cellId);
    });
    const rawId = `raw-${hazard.id}-${optionId}`;
    rawRows.push({ id: rawId, rowKey: `${optionId}/${hazard.id}`, sourceDocumentId: technicalSourceId, optionId, hazardId: hazard.id, citationIds: cellIds, fields: fieldsObject });
    canonicalRows.push({ id: `canonical-${hazard.id}-${optionId}`, rowKey: `${optionId}/${hazard.id}`, sourceDocumentId: technicalSourceId, optionId, hazardId: hazard.id, citationIds: cellIds, fields: fieldsObject, sourceRowIds: [rawId] });
  });
}

const supportCitations = [
  ["applicability-directive-scope", "medellin-dap-letter-2011", "applicability", 2, "2", "Alcance de la directiva DAP", "las entidades públicas y descentralizadas o las Empresas Comerciales del Estado se ciñan para sus diseños", ["entidades públicas", "Empresas Comerciales del Estado"], { left: 0.10, top: 0.43, width: 0.82, height: 0.25 }],
  ["applicability-2014-not-regulatory", "medellin-pot-evaluation-2014", "applicability", 192, "191", "Ausencia de incorporación reglamentaria", "sus resultados no fueron incorporados como norma reglamentaria", ["no fueron incorporados", "norma reglamentaria"], { left: 0.08, top: 0.10, width: 0.84, height: 0.20 }],
  ["applicability-2014-repeal", "medellin-pot-evaluation-2014", "applicability", 188, "187", "Historia de D638/1999 y D143/2000", "Decreto 638 de 1999 reglamentó la obligatoriedad; pero fue derogado parcialmente mediante el Decreto 143 de 2000, al no tener el aval de la comisión asesora permanente", ["Decreto 638", "Decreto 143", "aval"], { left: 0.08, top: 0.48, width: 0.84, height: 0.18 }],
  ["applicability-2026-not-adopted", "medellin-pot-inputs-2026-v2", "applicability", 193, "168", "Estado del estudio de armonización 2019", "Aunque actualmente el Decreto para adoptar las disposiciones de la microzonificación sísmica no ha sido adoptado", ["Decreto", "no ha sido adoptado"], { left: 0.08, top: 0.43, width: 0.84, height: 0.13 }],
  ["warning-damping", technicalSourceId, "warning", 21, null, "Amortiguamiento", "sismos de servicio (fracción de amortiguamiento crítico del 2%) y de diseño (fracción de amortiguamiento crítico del 5%)", ["2%", "5%"], { left: 0.15, top: 0.42, width: 0.70, height: 0.15 }],
  ["warning-period-domain", technicalSourceId, "warning", 22, null, "Dominio máximo", "Todos los espectros son válidos solamente hasta un período máximo de cuatro segundos", ["cuatro segundos"], { left: 0.12, top: 0.53, width: 0.76, height: 0.07 }],
  ["warning-fills", technicalSourceId, "warning", 23, null, "Rellenos artificiales", "rellenos artificiales con espesores superiores a 5m debe definirse un espectro de diseño", ["superiores a 5m", "espectro de diseño"], { left: 0.12, top: 0.66, width: 0.78, height: 0.10 }],
  ["warning-transition", technicalSourceId, "warning", 23, null, "Franja de transición", "franja de transición de 125 m, a cada lado del límite", ["125 m", "cada lado"], { left: 0.12, top: 0.77, width: 0.78, height: 0.12 }],
  ["warning-unstable", technicalSourceId, "warning", 23, null, "Zonas inestables", "En zonas inestables o declaradas como tal por el Municipio, no son válidos los espectros", ["zonas inestables", "no son válidos"], { left: 0.12, top: 0.91, width: 0.78, height: 0.06 }],
  ["warning-soil-profile", technicalSourceId, "warning", 24, null, "Perfil de suelo por estudio geotécnico", "cada edificación deberá asignarse al tipo de perfil de suelo según el estudio geotécnico y no según al mapa de microzonificación sísmica", ["estudio geotécnico", "no según"], { left: 0.10, top: 0.13, width: 0.82, height: 0.18 }],
  ["equation-plateau", technicalSourceId, "equation", 21, null, "Figura 0, ordenada de la meseta", "Smax = Fa aSmax I", ["Smax", "Fa", "aSmax", "I"], { left: 0.39, top: 0.57, width: 0.28, height: 0.08 }],
  ["equation-tail", technicalSourceId, "equation", 21, null, "Figura 0, rama decreciente", "Sa = Smax (Tc/T)^α", ["Sa", "Smax", "Tc", "T"], { left: 0.49, top: 0.63, width: 0.28, height: 0.10 }],
  ["figure-spectrum-branches", technicalSourceId, "figure", 21, null, "Figura 0. Espectro generalizado", "Figura 0. Espectro generalizado: tramo creciente, meseta T0 a Tc y rama decreciente", ["Figura 0", "T0", "Tc"], { left: 0.30, top: 0.54, width: 0.39, height: 0.29 }],
  ["equation-rc", technicalSourceId, "equation", 23, null, "Variación del coeficiente de disipación", "Rc = 1 + (R - 1)[2T/(T0 + Tc)] ≤ R", ["Rc", "T0", "Tc"], { left: 0.31, top: 0.54, width: 0.42, height: 0.12 }],
];
const applicabilityCitations = supportCitations.filter(([, , regionKind]) => regionKind === "applicability");
for (const [id, sourceDocumentId, regionKind, physicalPage, printedPage, reference, extractedToken, requiredTokens, rect] of applicabilityCitations) {
  citations.push({ id, sourceDocumentId, regionKind, physicalPage, printedPage, reference, rect, extractedToken, unit: null, transformation: null, requiredTokens });
}

const study = {
  schemaVersion: 1,
  studyId: "medellin-microzonation",
  title: "Medellín historical microzonation research evidence (not adopted; activation blocked)",
  sources, citations,
  applicabilityCitationIds: applicabilityCitations.map(([id]) => id),
  coverage: { optionIds: options.map(([id]) => id), hazardIds: hazards.map(({ id }) => id), fieldIds: fields.map(([id]) => id) },
  values, rawRows, canonicalRows, overrides: [],
};

const canonical = {
  schemaVersion: 1, studyId: study.studyId, status: "research-only-activation-blocked",
  governingConclusion: "No municipal substitute to NSR-10 is demonstrated as adopted as of the March 2026 official POT input.",
  controllingBuildingStandard: "NSR-10 national workflow; historical Medellín coefficients must not replace A.2.4/A.2.6 in this product.",
  historicalTechnicalEdition: "1999 study as republished in DAP support dated May 2011",
  blockers: ["no-adopted-decree", "return-periods-not-stated-in-locked-primary-sources", "rising-branch-equation-not-stated", "referenced-site-specific-method-not-present"],
  options: options.map(([id, sourceLabel, description]) => ({ id, sourceLabel, description })),
  hazards: hazards.map(({ id, label, dampingRatio, returnPeriodYears }) => ({ id, label, dampingRatio, returnPeriodYears })),
  fieldSemantics: Object.fromEntries(fields.map(([id, sourceLabel, unit]) => [id, { sourceLabel, unit }])),
  rows: canonicalRows.map(({ optionId, hazardId, fields: rowFields }) => ({ optionId, hazardId, fields: rowFields })),
};

const sourceLocks = { schemaVersion: 1, retrievedOn: "2026-07-22", locks: sources.map(({ id, officialUrl, sha256: hash, pageCount }) => ({ sourceDocumentId: id, officialUrl, sha256: hash, pageCount, byteLength: ({
  "medellin-dap-2011-support": 324222, "medellin-dap-letter-2011": 582721,
  "medellin-pot-evaluation-2014": 5715360, "medellin-pot-inputs-2026-v2": 38296454,
})[id], redistributionDecision: "external-only" })) };

const extractionProfile = { schemaVersion: 1, coordinateSystem: "normalized top-left [0,1]", tableSource: technicalSourceId, tablePhysicalPage: 22, renderedAtDpi: 180, renderedPixelSize: { width: 1530, height: 1980 }, method: "Human-verified transcription against Poppler rendering; source PDF text extraction used only as a cross-check.", ocr: { used: false, note: "The source letter is scanned, but no canonical numeric value comes from OCR." } };
const supportClaimById = new Map(supportCitations.map((claim) => [claim[0], claim]));
const locator = (citationId) => {
  const [, sourceDocumentId, regionKind, physicalPage, printedPage, reference, , , rect] = supportClaimById.get(citationId);
  return { citationId, sourceDocumentId, regionKind, physicalPage, printedPage, reference, rect };
};
const formulaInventory = { schemaVersion: 1, status: "incomplete-blocks-activation", formulas: [
  { id: "plateau-ordinate", expression: "Smax = Fa × aSmax × I", citation: locator("equation-plateau"), status: "source-stated" },
  { id: "plateau-branch", expression: "Sa = Smax for T0 ≤ T ≤ Tc", citation: locator("figure-spectrum-branches"), status: "graphically-stated" },
  { id: "decay-branch", expression: "Sa = Smax × (Tc / T)^α for T > Tc", citation: locator("equation-tail"), status: "source-stated" },
  { id: "short-period-branch", expression: null, citation: locator("figure-spectrum-branches"), status: "blocked-equation-absent", issue: "The figure draws a rising line from aSmax at T=0 to Smax at T0 but supplies no equation; linear interpolation is not silently assumed." },
  { id: "rc-short-period", expression: "Rc = min(R, 1 + (R - 1) × 2T/(T0 + Tc))", citation: locator("equation-rc"), status: "source-stated" },
] };
const claimsMatrix = { schemaVersion: 1, directMatrix: { options: 14, hazards: 2, fields: 6, exactCoveredPairs: 28, exactCoveredFieldValues: 168, coveragePercent: 100 }, claims: supportCitations.map(([id, sourceDocumentId, regionKind, physicalPage, printedPage, reference]) => ({ id, kind: regionKind, claim: reference, citation: { sourceDocumentId, physicalPage, printedPage, citationId: id } })) };
const uncertaintyLedger = { schemaVersion: 1, blocking: true, entries: [
  { id: "governing-status", severity: "blocker", status: "resolved-no-adoption", issue: "Whether the 1999/2011 material currently substitutes NSR-10.", resolution: "Official 2014 and March 2026 sources say it was not incorporated/adopted; activation is prohibited unless a later adoption instrument and CAP approval are produced." },
  { id: "return-periods", severity: "blocker", status: "open", issue: "Neither locked table/support nor official POT excerpts state return periods for the two historical hazards.", requiredResolution: "Obtain the primary 1999 report or 2019 harmonization report and an adopted instrument explicitly defining probabilities/return periods." },
  { id: "short-period-equation", severity: "blocker", status: "open", issue: "The rising branch 0 < T < T0 is drawn but not defined algebraically.", requiredResolution: "Obtain a primary source with the exact equation and branch inclusivity; do not infer linearity from the drawing." },
  { id: "directive-currentness", severity: "blocker", status: "open", issue: "The 2011 letter is scoped to public entities and its current administrative effect is not established.", requiredResolution: "Obtain a current legal determination; it cannot support a general building calculator." },
  { id: "site-specific-method", severity: "blocker", status: "open", issue: "The fill and transition clauses require a detailed/site-specific study under the ‘artículo cuarto del presente decreto’, but that article and its method are absent from the locked 24-page support package.", requiredResolution: "Obtain and lock the complete governing instrument or adopted technical annex containing the referenced method and acceptance criteria." },
] };
const conflictLedger = { schemaVersion: 1, entries: [
  { id: "1999-mandate-vs-2000-repeal", status: "resolved-for-product", officialEvidence: ["applicability-2014-repeal", "applicability-2014-not-regulatory"], resolution: "Treat coefficients as historical/research-only; NSR-10 remains governing in the product." },
  { id: "2011-note-vs-letter-scope", status: "resolved-for-product", officialEvidence: ["warning-damping", "applicability-directive-scope"], resolution: "The support text says all buildings, but the signed directive limits recipients to public/decentralized/state-commercial entities; it is not generalized." },
  { id: "2019-study-vs-adoption", status: "resolved-for-product", officialEvidence: ["applicability-2026-not-adopted"], resolution: "A later harmonization study exists but the official 2026 source says its adoption decree has not been adopted; do not mix its model with 1999 values." },
] };
const referenceDifferences = { schemaVersion: 1, benchmarkUse: "UX only", differences: ["Any reference-site activation of Medellín is unsupported by the currently locked official adoption chain.", "Reference-site return periods or short-period formulas must not fill the primary-source gaps.", "Product selection, if ever approved, must remain manual; GIS and address inference are out of scope."], nonInference: "No coefficient, period, formula, or legal status was copied from a reference calculator." };
const redistribution = { schemaVersion: 1, decision: "external-only-all-sources", sources: sources.map(({ id, officialUrl }) => ({ sourceDocumentId: id, officialUrl, decision: "external-only", rationale: "No express redistribution license located on the official delivery page." })), committedSourceBytes: false };
const reviewRecord = { schemaVersion: 1, authorRole: "research agent R3", preparedOn: "2026-07-22", independentReview: { status: "pending", reviewer: null, reviewedOn: null, requiredReproductions: ["all four source hashes", "selected cells in both six-column hazard blocks", "plateau product rounding", "Tc boundary and decay witness", "legal no-adoption chain"] }, activationDecision: "blocked-material-regulatory-and-formula-gaps", mergeRecommendation: "do-not-merge-until-independent-review; even after evidence review, do not activate without resolution of all blockers" };

const artifacts = {
  "data/canonical.json": canonical, "evidence/manifest.json": study,
  "evidence/source-locks.json": sourceLocks, "evidence/extraction-profile.json": extractionProfile,
  "evidence/formula-inventory.json": formulaInventory, "evidence/claims-matrix.json": claimsMatrix,
  "evidence/uncertainty-ledger.json": uncertaintyLedger, "evidence/conflict-ledger.json": conflictLedger,
  "evidence/reference-site-differences.json": referenceDifferences, "evidence/redistribution.json": redistribution,
  "evidence/review-record.json": reviewRecord,
};
const checkOnly = process.argv.includes("--check");
const mismatches = [];
for (const [relativePath, value] of Object.entries(artifacts)) {
  const bytes = deterministicJson(value);
  if (checkOnly) {
    const existing = await readFile(output(relativePath), "utf8").catch(() => null);
    if (existing !== bytes) mismatches.push(relativePath);
  } else {
    await mkdir(dirname(output(relativePath)), { recursive: true });
    await writeFile(output(relativePath), bytes, "utf8");
  }
}
if (mismatches.length) throw new Error(`Generated Medellín artifacts differ: ${mismatches.join(", ")}`);
const hashes = Object.fromEntries(Object.entries(artifacts).map(([path, value]) => [path, sha256(Buffer.from(deterministicJson(value), "utf8"))]));
process.stdout.write(`${checkOnly ? "checked" : "generated"} ${Object.keys(artifacts).length} Medellín artifacts\n${deterministicJson(hashes)}`);
