import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const out = (path) => resolve(root, path);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const full = { left: 0, top: 0, width: 1, height: 1 };

const options = [
  ["zone-1", "1", "Zona 1", null],
  ["zone-2", "2", "Zona 2", null],
  ["zone-3", "3", "Zona 3", null],
  ["zone-4a", "4a", "Zona 4A", null],
  ["zone-4b-tc", "4b Tc", "Zona 4B — componente Tc", "zone-4b"],
  ["zone-4b-tl", "4b TL", "Zona 4B — componente TL", "zone-4b"],
  ["zone-4c-tc", "4c Tc", "Zona 4C — componente Tc", "zone-4c"],
  ["zone-4c-tl", "4c TL", "Zona 4C — componente TL", "zone-4c"],
  ["zone-4d", "4d", "Zona 4D", null],
  ["zone-4e", "4e", "Zona 4E", null],
  ["zone-5-tc", "5 Tc", "Zona 5 — componente Tc", "zone-5"],
  ["zone-5-tl", "5 TL", "Zona 5 — componente TL", "zone-5"],
  ["zone-6", "6", "Zona 6", null],
];

const common = [
  [0.55, 0.86, 3.00, 0.99], [0.45, 1.20, 3.00, 1.13],
  [1.05, 1.36, 2.00, 2.98], [0.75, 1.20, 2.00, 1.88],
  [0.70, 1.04, 2.50, 1.52], [1.60, 0.80, 2.50, 2.67],
  [0.45, 1.60, 2.00, 1.50], [1.50, 1.04, 2.10, 3.25],
  [1.20, 0.99, 2.00, 2.48], [0.95, 0.91, 3.00, 1.81],
  [0.60, 1.12, 2.50, 1.40], [1.35, 0.83, 2.50, 2.34],
  [1.15, 1.09, 2.50, 2.61],
];
const minimum = [
  [0.55, 0.72, 3.00, 0.83], [0.40, 1.07, 3.00, 0.89],
  [0.85, 1.20, 2.00, 2.13], [0.65, 1.12, 2.00, 1.52],
  [0.50, 0.96, 2.50, 1.00], [1.50, 0.72, 2.50, 2.25],
  [0.35, 1.44, 2.00, 1.05], [1.30, 0.91, 2.10, 2.47],
  [1.00, 0.91, 2.00, 1.90], [0.80, 0.83, 3.00, 1.39],
  [0.50, 1.04, 2.50, 1.08], [1.20, 0.75, 2.50, 1.88],
  [1.10, 0.93, 2.50, 2.13],
];
const damageSource = [
  [0.99, 1.24, 0.62, 3.00], [1.13, 1.41, 0.70, 3.00],
  [2.98, 3.72, 1.86, 2.00], [1.88, 2.35, 1.18, 2.00],
  [2.67, 3.34, 1.67, 2.50], [3.25, 4.06, 2.03, 2.10],
  [2.48, 3.10, 1.55, 2.00], [1.81, 2.26, 1.13, 3.00],
  [2.34, 2.93, 1.46, 2.50], [2.61, 3.26, 1.63, 2.50],
];
const damageIndex = [0, 1, 2, 3, 4, 4, 5, 5, 6, 7, 8, 8, 9];
const pgaRows = [
  ["zone-1", "1", 0.26], ["zone-2", "2", 0.35], ["zone-3", "3", 0.35], ["zone-4a", "4a", 0.33],
  ["zone-4b", "4b", 0.28], ["zone-4c", "4c", 0.40], ["zone-4d", "4d", 0.28], ["zone-4e", "4e", 0.25],
  ["zone-5", "5", 0.28], ["zone-6", "6", 0.25],
];
const pgaBoundsPixels = [592,622,651,679,707,735,763,790,818,846,876];

const hazards = [
  { id: "design", table: 2, page: 11, printed: "12", base: 0.25, damping: 0.05, returnYears: 475, rows: common,
    rect: { left: 0.16, top: 0.209, width: 0.66, height: 0.235 }, rowBoundsPixels: [552,577,602,627,653,684,716,748,780,805,830,862,894,922],
    cellLeft: [0.315, 0.419, 0.523, 0.674], cellWidth: [0.09, 0.09, 0.115, 0.12], caption: "Tabla 2. Coeficientes y curvas de diseño" },
  { id: "safety-limited", table: 3, page: 12, printed: "13", base: 0.15, damping: 0.05, returnYears: 225, rows: common,
    rect: { left: 0.185, top: 0.438, width: 0.605, height: 0.220 }, rowBoundsPixels: [995,1020,1045,1070,1095,1128,1160,1193,1225,1250,1275,1307,1338,1367],
    cellLeft: [0.330, 0.450, 0.570, 0.695], cellWidth: [0.095, 0.095, 0.095, 0.085], caption: "Tabla 3. Coeficientes y curvas de seguridad limitada" },
  { id: "damage-threshold", table: 4, page: 13, printed: "14", base: 0.09, damping: 0.02, returnYears: 31, rows: damageSource,
    rect: { left: 0.215, top: 0.634, width: 0.575, height: 0.165 }, rowBoundsPixels: [1403,1429,1455,1479,1504,1529,1554,1579,1604,1629,1660],
    cellLeft: [0.355, 0.465, 0.570, 0.690], cellWidth: [0.09, 0.09, 0.09, 0.09], caption: "Tabla 4. Coeficientes y curvas de umbral de daño" },
  { id: "site-specific-minimum", table: 6, page: 18, printed: "19", base: 0.25, damping: 0.05, returnYears: 475, rows: minimum,
    rect: { left: 0.185, top: 0.320, width: 0.605, height: 0.218 }, rowBoundsPixels: [749,775,800,824,849,881,913,944,976,1001,1026,1058,1089,1117],
    cellLeft: [0.320, 0.430, 0.550, 0.670], cellWidth: [0.09, 0.09, 0.09, 0.09], caption: "Tabla 6. Coeficientes y curvas mínimas de diseño" },
];
const fields = [
  ["column-1", "s"], ["column-2", null], ["column-3", "s"], ["column-4", null],
];
const decreeId = "cali-decree-0158-2014";
const historicalSourceId = "cali-ingeominas-dagma-2005-tomo6";
const historicalThreshold = {
  claimId: "historical-threshold",
  physicalPage: 147,
  printedFooter: "136",
  scanMarker: "747",
  reference: "Numeral 8; pie interno 136; marcador manuscrito 747",
  rect: { left: 0.16, top: 0.56, width: 0.72, height: 0.29 },
  scanMarkerRect: { left: 0.89, top: 0, width: 0.10, height: 0.07 },
  printedFooterRect: { left: 0.82, top: 0.87, width: 0.09, height: 0.06 },
  extractedToken: "Ad = 0.05g, el cual se calculó probabilísticamente para un periodo de retorno de 10 años",
  requiredTokens: ["Ad = 0.05g", "periodo de retorno de 10 años"],
  regionAttestationId: "historical-threshold-p147",
};
const rejectedHistoricalThreshold = {
  physicalPage: 136,
  printedFooter: "125",
  scanMarker: "736",
  reason: "La página muestra 7.1.8 Zona 4E: Abanico de Pance y la Figura 7.9; no contiene el numeral 8 sobre Ad=0.05g/10 años.",
};

const sources = [
  {
    id: decreeId, issuingAuthority: "Alcaldía de Santiago de Cali", officialTitle: "Decreto 411.0.20.0158 de 2014 — Por el cual se adopta la microzonificación sísmica de Santiago de Cali",
    edition: "18 de marzo de 2014", revision: null, adoptionInstrument: "Decreto Municipal 411.0.20.0158 de 2014",
    amendmentsAndErrata: [], legalStatus: "active", applicabilityStatus: "applicable",
    officialUrl: "https://www.cali.gov.co/aplicaciones/boletin_publicaciones/imagenes_documentos/documentoId7429.pdf", retrievedOn: "2026-07-25",
    redistribution: { decision: "external-only", rationale: "El portal oficial no expresa una licencia de redistribución; se conservan URL, huella, geometría y atestación, no los bytes." },
    mediaType: "application/pdf", pageCount: 20, sha256: "8c58d68e34b1f79b5227beb98b58ca6fc8fb24031cb8d2c64ebecf71873ce9d6",
    pages: [1,9,11,12,13,14,15,16,17,18,19,20].map((physicalPage) => ({ physicalPage, printedPage: String(physicalPage + 1), rotationDegrees: 0, crop: full })),
  },
  {
    id: "cali-pot-0373-2014", issuingAuthority: "Concejo de Santiago de Cali", officialTitle: "Acuerdo 0373 de 2014 — revisión ordinaria del Plan de Ordenamiento Territorial",
    edition: "2014", revision: null, adoptionInstrument: "Acuerdo Municipal 0373 de 2014", amendmentsAndErrata: [], legalStatus: "active", applicabilityStatus: "applicable",
    officialUrl: "https://www.minvivienda.gov.co/sites/default/files/10%20A%20Acuerdo%200373%20de%202014.pdf", retrievedOn: "2026-07-25",
    redistribution: { decision: "external-only", rationale: "Copia oficial sin licencia expresa de redistribución; se conserva huella y localizador." },
    mediaType: "application/pdf", pageCount: 433, sha256: "f631e3e58bb8c2f9893a32d37845f85595f2c894a935cc141e0ece51c418e94b",
    pages: [{ physicalPage: 51, printedPage: "51/435", rotationDegrees: 0, crop: full }],
  },
  {
    id: "nsr10-title-a-2017", issuingAuthority: "Comisión Asesora Permanente para el Régimen de Construcciones Sismo Resistentes", officialTitle: "Reglamento Colombiano de Construcción Sismo Resistente NSR-10 — Título A",
    edition: "Actualización 2017", revision: "Decreto 945 de 2017", adoptionInstrument: "Decreto 926 de 2010 y modificaciones", amendmentsAndErrata: [], legalStatus: "active", applicabilityStatus: "applicable",
    officialUrl: "https://www.minvivienda.gov.co/sites/default/files/documentos/titulo-a-nsr-100.pdf", retrievedOn: "2026-07-25",
    redistribution: { decision: "external-only", rationale: "Esta investigación conserva un bloqueo externo independiente; el repositorio general administra por separado cualquier copia autorizada." },
    mediaType: "application/pdf", pageCount: 206, sha256: "47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0",
    pages: [30,116,134,136,151].map((physicalPage) => ({ physicalPage, printedPage: `A-${physicalPage - 14}`, rotationDegrees: 0, crop: full })),
  },
  {
    id: historicalSourceId, issuingAuthority: "INGEOMINAS y DAGMA", officialTitle: "Estudio de Microzonificación Sísmica de Santiago de Cali — Tomo 6, Convenio 02 de 2002",
    edition: "2005", revision: null, adoptionInstrument: "Soporte técnico histórico citado por el artículo 11 del Decreto 0158 de 2014", amendmentsAndErrata: [], legalStatus: "historical", applicabilityStatus: "historical",
    officialUrl: "https://web1.cali.gov.co/publico2/documentos/dagma/estudios_ambientales/CONTRATO022002/TOMO6CONVENIO022002.pdf", retrievedOn: "2026-07-25",
    redistribution: { decision: "external-only", rationale: "Informe técnico oficial sin licencia expresa de redistribución; se conserva huella y localizador." },
    mediaType: "application/pdf", pageCount: 159, sha256: "c6d45337349043f6b816146952b79d3d4c27e6f414e9d692d2bd30566de378e1",
    pages: [{ physicalPage: historicalThreshold.physicalPage, printedPage: historicalThreshold.printedFooter, rotationDegrees: 0, crop: full }],
  },
];
const matrixHazards = hazards.filter(({ id }) => id !== "site-specific-minimum");
const minimumTable = hazards.find(({ id }) => id === "site-specific-minimum");

const citation = (id, sourceDocumentId, regionKind, physicalPage, printedPage, reference, rect, extractedToken, extra = {}) => ({
  id, sourceDocumentId, regionKind, physicalPage, printedPage, reference, rect, extractedToken,
  unit: null, transformation: null, requiredTokens: [extractedToken], ...extra,
});
const citations = [
  citation("app-decree-adoption", decreeId, "applicability", 1, "2", "Encabezado y artículo primero", { left: 0.09, top: 0.12, width: 0.82, height: 0.75 }, "Se adopta la Microzonificación Sísmica de Santiago de Cali"),
  citation("app-pot-art55", "cali-pot-0373-2014", "applicability", 51, "51/435", "Artículo 55", { left: 0.08, top: 0.43, width: 0.84, height: 0.27 }, "promoverá y vigilará la aplicación del Decreto Municipal 0158 del 18 de marzo de 2014"),
  citation("app-nsr-return-periods", "nsr10-title-a-2017", "applicability", 151, "A-137", "Definiciones de movimientos sísmicos", full, "475 años; 225 años; 31 años"),
  citation(
    "app-study-historical",
    historicalSourceId,
    "applicability",
    historicalThreshold.physicalPage,
    historicalThreshold.printedFooter,
    historicalThreshold.reference,
    historicalThreshold.rect,
    historicalThreshold.extractedToken,
    { requiredTokens: historicalThreshold.requiredTokens },
  ),
];
const values = [];
const rawRows = [];
const canonicalRows = [];

for (const hazard of matrixHazards) {
  const tableId = `table-${hazard.id}`;
  citations.push(citation(tableId, decreeId, "table", hazard.page, hazard.printed, `Tabla ${hazard.table}`, hazard.rect, hazard.caption));
  const firstRowTop = hazard.rowBoundsPixels[0] / 2080;
  const baseRect = {
    left: hazard.rect.left,
    top: hazard.rect.top,
    width: hazard.rect.width,
    height: firstRowTop - hazard.rect.top,
  };
  citations.push(citation(
    `base-${hazard.id}`,
    decreeId,
    "applicability",
    hazard.page,
    hazard.printed,
    `Tabla ${hazard.table}, aceleración base`,
    baseRect,
    hazard.base.toFixed(2),
    {
      normalizedValue: hazard.base,
      normalizedNumericValue: hazard.base,
      unit: "g",
      transformation: "decimal parse",
    },
  ));
  options.forEach(([optionId, sourceLabel], optionIndex) => {
    const sourceIndex = hazard.id === "damage-threshold" ? damageIndex[optionIndex] : optionIndex;
    const sourceValues = hazard.rows[sourceIndex];
    const rowId = `row-${hazard.id}-${optionId}`;
    const top = hazard.rowBoundsPixels[sourceIndex] / 2080;
    const rowHeight = (hazard.rowBoundsPixels[sourceIndex + 1] - hazard.rowBoundsPixels[sourceIndex]) / 2080;
    const rowRect = { left: hazard.rect.left, top, width: hazard.rect.width, height: rowHeight };
    const rowToken = `${sourceLabel} ${sourceValues.map((value) => value.toFixed(2)).join(" ")}`;
    citations.push(citation(rowId, decreeId, "row", hazard.page, hazard.printed, `Tabla ${hazard.table}, ${sourceLabel}`, rowRect, rowToken, { parentCitationId: tableId }));
    const rowCitations = [];
    const rowFields = {};
    fields.forEach(([fieldId, unit], fieldIndex) => {
      const value = sourceValues[fieldIndex];
      const cellId = `cell-${hazard.id}-${optionId}-${fieldId}`;
      const cellRect = { left: hazard.cellLeft[fieldIndex], top, width: hazard.cellWidth[fieldIndex], height: rowHeight };
      const token = value.toFixed(2);
      citations.push(citation(cellId, decreeId, "cell", hazard.page, hazard.printed, `Tabla ${hazard.table}, ${sourceLabel}, columna ${fieldIndex + 1}`, cellRect, token, {
        parentCitationId: rowId, normalizedValue: value, normalizedNumericValue: value, unit, transformation: "decimal parse",
      }));
      values.push({ id: `value-${hazard.id}-${optionId}-${fieldId}`, optionId, hazardId: hazard.id, fieldId, value, unit, provenance: "direct-source", citationIds: [cellId], transformation: "decimal parse" });
      rowCitations.push(cellId);
      rowFields[fieldId] = value;
    });
    const rawId = `raw-${hazard.id}-${optionId}`;
    rawRows.push({ id: rawId, rowKey: `${optionId}/${hazard.id}`, sourceDocumentId: decreeId, optionId, hazardId: hazard.id, citationIds: rowCitations, fields: rowFields });
    canonicalRows.push({ id: `canonical-${hazard.id}-${optionId}`, rowKey: `${optionId}/${hazard.id}`, sourceDocumentId: decreeId, optionId, hazardId: hazard.id, citationIds: rowCitations, fields: rowFields, sourceRowIds: [rawId] });
  });
}

const manifest = {
  schemaVersion: 1, studyId: "cali-microzonation", title: "Microzonificación sísmica de Santiago de Cali — evidencia de investigación",
  sources,
  citations,
  applicabilityCitationIds: [
    "app-decree-adoption",
    "app-pot-art55",
    "app-nsr-return-periods",
    "app-study-historical",
    ...matrixHazards.map(({ id }) => `base-${id}`),
  ],
  coverage: { optionIds: options.map(([id]) => id), hazardIds: matrixHazards.map(({ id }) => id), fieldIds: fields.map(([id]) => id) },
  values, rawRows, canonicalRows, overrides: [],
};

const canonical = {
  schemaVersion: 1, studyId: manifest.studyId, status: "research-only-activation-blocked",
  blockers: [
    "La curva de umbral de daño usa A0d y Fa en las ramas T≤Tcd, pero el Decreto 0158 no publica esos valores en la Tabla 4.",
    "La revisión humana independiente del paquete de evidencia está pendiente.",
  ],
  geographicOptions: ["zone-1","zone-2","zone-3","zone-4a","zone-4b","zone-4c","zone-4d","zone-4e","zone-5","zone-6"],
  curveComponents: options.map(([id, sourceLabel, label, concurrentGroup]) => ({ id, sourceLabel, label, concurrentGroup })),
  groupingRule: "Los componentes Tc/TL de las zonas 4B, 4C y 5 son curvas concurrentes de una misma opción geográfica; el artículo 5(6) exige verificar ambas independientemente.",
  fieldSemantics: {
    design: { "column-1": "Tc", "column-2": "Fa", "column-3": "TL", "column-4": "Fv" },
    "safety-limited": { "column-1": "Tc", "column-2": "Fa", "column-3": "TL", "column-4": "Fv" },
    "damage-threshold": { "column-1": "Fv", "column-2": "S", "column-3": "Tcd", "column-4": "TLd" },
  },
  hazards: matrixHazards.map(({ id, base, damping, returnYears }) => ({ id, baseAccelerationG: base, dampingRatio: damping, averageReturnPeriodYears: returnYears })),
  rows: canonicalRows.map(({ optionId, hazardId, fields }) => ({ optionId, hazardId, fields })),
  ancillary: {
    surfacePgaDesign: {
      id: "surface-pga-design", relation: "ancillary-ground-surface-design-pga-not-a-spectrum-hazard-axis",
      sourceDocumentId: decreeId, physicalPage: 15, printedPage: "16", reference: "Tabla 5", unit: "g",
      rows: pgaRows.map(([optionId, sourceLabel, value], index) => ({
        optionId, sourceLabel, value,
        cell: { id:`pga-${optionId}`, token:value.toFixed(2), normalizedValue:value,
          rect:{ left:0.52, top:pgaBoundsPixels[index]/2080, width:0.16, height:(pgaBoundsPixels[index+1]-pgaBoundsPixels[index])/2080 } },
      })),
    },
    transitionBandMetersEachSide: 200, lateralSpreadingBandMeters: 300, uncontrolledFillAmplification: 1.20,
    siteSpecificDesignMinimum: {
      id: "site-specific-design-minimum", relation: "lower-bound-for-site-specific-design-curve-not-a-hazard",
      sourceDocumentId: decreeId, physicalPage: minimumTable.page, printedPage: minimumTable.printed,
      reference: minimumTable.caption, baseAccelerationG: minimumTable.base, dampingRatio: minimumTable.damping,
      fieldSemantics: { "column-1": "Tc", "column-2": "Fa", "column-3": "TL", "column-4": "Fv" },
      rows: options.map(([optionId, sourceLabel], optionIndex) => {
        const top = minimumTable.rowBoundsPixels[optionIndex] / 2080;
        const height = (minimumTable.rowBoundsPixels[optionIndex + 1] - minimumTable.rowBoundsPixels[optionIndex]) / 2080;
        return {
          optionId, sourceLabel,
          fields: Object.fromEntries(fields.map(([fieldId], fieldIndex) => [fieldId, minimumTable.rows[optionIndex][fieldIndex]])),
          cells: fields.map(([fieldId], fieldIndex) => ({
            id: `minimum-${optionId}-${fieldId}`, fieldId, token: minimumTable.rows[optionIndex][fieldIndex].toFixed(2),
            normalizedValue: minimumTable.rows[optionIndex][fieldIndex],
            rect: { left: minimumTable.cellLeft[fieldIndex], top, width: minimumTable.cellWidth[fieldIndex], height },
          })),
        };
      }),
    },
  },
};

const sourceLocks = { schemaVersion: 1, retrievedOn: "2026-07-25", locks: sources.map((source) => ({
  sourceDocumentId: source.id, officialUrl: source.officialUrl, sha256: source.sha256, pageCount: source.pageCount,
  byteLength: ({ [decreeId]:7754229, "cali-pot-0373-2014":2109799, "nsr10-title-a-2017":3486413, [historicalSourceId]:13469947 })[source.id],
  redistributionDecision: source.redistribution.decision,
})) };

const formulas = {
  schemaVersion: 1, status: "incomplete-blocks-activation", independentVariable: "T (s)", output: "spectral acceleration (g)",
  formulas: [
    { id:"design-safety-minimum-plateau", appliesTo:["design","safety-limited","site-specific-design-minimum"], range:"T ≤ Tc", equation:"Sa = 2.5 A Fa I", status:"complete", citation:{sourceDocumentId:decreeId,physicalPage:11,printedPage:"12",reference:"Gráfica de la Tabla 2",rect:{left:0.28,top:0.61,width:0.22,height:0.10}} },
    { id:"design-safety-minimum-inverse", appliesTo:["design","safety-limited","site-specific-design-minimum"], range:"Tc < T ≤ TL", equation:"Sa = 1.2 A Fv I / T", status:"complete", citation:{sourceDocumentId:decreeId,physicalPage:11,printedPage:"12",reference:"Gráfica de la Tabla 2",rect:{left:0.48,top:0.67,width:0.22,height:0.10}} },
    { id:"design-safety-minimum-inverse-square", appliesTo:["design","safety-limited","site-specific-design-minimum"], range:"T > TL", equation:"Sa = 1.2 A Fv TL I / T²", status:"complete", citation:{sourceDocumentId:decreeId,physicalPage:11,printedPage:"12",reference:"Gráfica de la Tabla 2",rect:{left:0.65,top:0.72,width:0.23,height:0.10}} },
    { id:"damage-ramp", appliesTo:["damage-threshold"], range:"T < T0d", equation:"Sad = A0d + [(3 Ad Fa − A0d) / T0d] T", status:"blocked-missing-a0d-fa", citation:{sourceDocumentId:decreeId,physicalPage:14,printedPage:"15",reference:"Gráfica de umbral de daño",rect:{left:0.24,top:0.25,width:0.38,height:0.18}} },
    { id:"damage-plateau", appliesTo:["damage-threshold"], range:"T0d ≤ T ≤ Tcd", equation:"Sad = 3 Ad Fa", status:"blocked-missing-fa", citation:{sourceDocumentId:decreeId,physicalPage:14,printedPage:"15",reference:"Gráfica de umbral de daño",rect:{left:0.34,top:0.22,width:0.20,height:0.11}} },
    { id:"damage-inverse", appliesTo:["damage-threshold"], range:"Tcd < T ≤ TLd", equation:"Sad = 1.5 Ad Fv / T", status:"complete", citation:{sourceDocumentId:decreeId,physicalPage:14,printedPage:"15",reference:"Gráfica de umbral de daño",rect:{left:0.49,top:0.27,width:0.20,height:0.12}} },
    { id:"damage-inverse-square", appliesTo:["damage-threshold"], range:"T > TLd", equation:"Sad = 1.5 Ad Fv TLd / T²", status:"complete", citation:{sourceDocumentId:decreeId,physicalPage:14,printedPage:"15",reference:"Gráfica de umbral de daño",rect:{left:0.64,top:0.33,width:0.24,height:0.12}} },
  ],
  boundaryPolicy: "Las desigualdades y los Tc/TL/Tcd/TLd tabulados seleccionan la rama; no se sustituyen puntos de quiebre recalculados cuando el redondeo produce pequeños residuos.",
};

const claims = {
  schemaVersion: 1,
  directMatrix: { expectedFieldValues:156, exactCoveredFieldValues:156, coveragePercent:100, distinctAttestedCells:144 },
  ancillaryMinimumTable: { expectedFieldValues:52, exactCoveredFieldValues:52, coveragePercent:100, distinctAttestedCells:52, relation:"design-lower-bound-not-hazard" },
  ancillaryPgaTable: { expectedFieldValues:10, exactCoveredFieldValues:10, coveragePercent:100, distinctAttestedCells:10, relation:"surface-design-pga-not-hazard" },
  claims: [
    { id:"adoption",kind:"applicability",statement:"El Decreto 0158 de 2014 adopta la microzonificación sísmica y entra en vigencia con su expedición y publicación.",citation:{sourceDocumentId:decreeId,physicalPage:20,printedPage:"21",reference:"Artículos 11 y 12"} },
    { id:"pot-continuity",kind:"applicability",statement:"El POT ordena promover y vigilar la aplicación del Decreto 0158 y gestionar su actualización cuando exista nueva información.",citation:{sourceDocumentId:"cali-pot-0373-2014",physicalPage:51,printedPage:"51/435",reference:"Artículo 55"} },
    { id:"return-periods",kind:"applicability",statement:"La NSR-10 define períodos medios de retorno aproximados de 475, 225 y 31 años para diseño, seguridad limitada y umbral de daño.",citation:{sourceDocumentId:"nsr10-title-a-2017",physicalPage:151,printedPage:"A-137",reference:"Definiciones"} },
    { id:"concurrent-curves",kind:"warning",statement:"En zonas con doble curva, ambas curvas y sus derivas se verifican independientemente.",citation:{sourceDocumentId:decreeId,physicalPage:15,printedPage:"16",reference:"Artículo 5, numeral 6"} },
    { id:"boundary-band",kind:"warning",statement:"En una franja de 200 m a cada lado de un límite se promedian espectros adyacentes período a período, salvo reclasificación mediante estudio geotécnico.",citation:{sourceDocumentId:decreeId,physicalPage:15,printedPage:"16",reference:"Artículo 5, numeral 5"} },
    { id:"fill-colluvium",kind:"warning",statement:"Rellenos no controlados mayores a 3 m y depósitos coluviales requieren aumentar Fa y Fv en 20%, salvo estudio específico, sin bajar de la zona.",citation:{sourceDocumentId:decreeId,physicalPage:16,printedPage:"17",reference:"Artículo 5, numerales 10 y 11"} },
    { id:"long-period",kind:"warning",statement:"Para períodos estructurales mayores a 2.5 s se exige estudio de respuesta sísmica local.",citation:{sourceDocumentId:decreeId,physicalPage:17,printedPage:"18",reference:"Artículo 5, numeral 12"} },
    { id:"liquefaction-spreading",kind:"warning",statement:"El decreto exige evaluaciones de licuación y de corrimiento lateral en las áreas indicadas, incluida la franja de 300 m asociada a ríos y canales.",citation:{sourceDocumentId:decreeId,physicalPage:16,printedPage:"17",reference:"Artículo 5, numerales 8 y 9"} },
    { id:"site-specific-floor",kind:"warning",statement:"Una curva de respuesta local alternativa no puede ser menor que la curva mínima de la Tabla 6.",citation:{sourceDocumentId:decreeId,physicalPage:18,printedPage:"19",reference:"Artículo 7"} },
    {
      id: historicalThreshold.claimId,
      kind: "lineage",
      statement: "El estudio de 2005 usó Ad=0.05 y retorno de 10 años; el Decreto 0158 armonizado con NSR-10 adopta después Ad=0.09.",
      citation: {
        sourceDocumentId: historicalSourceId,
        physicalPage: historicalThreshold.physicalPage,
        printedPage: historicalThreshold.printedFooter,
        scanMarker: historicalThreshold.scanMarker,
        reference: historicalThreshold.reference,
        rect: historicalThreshold.rect,
        extractedToken: historicalThreshold.extractedToken,
        requiredTokens: historicalThreshold.requiredTokens,
        regionAttestationId: historicalThreshold.regionAttestationId,
      },
    },
  ],
};

const historicalLocator = {
  schemaVersion: 1,
  sourceDocumentId: historicalSourceId,
  sourceSha256: sources.find(({ id }) => id === historicalSourceId).sha256,
  claim: historicalThreshold,
  rejectedLocator: rejectedHistoricalThreshold,
  verification: {
    method: "embedded-image-and-normalized-region-sha256",
    ocrUsed: false,
    attestationFile: "historical-locator-attestation.json",
  },
};

const uncertainties = { schemaVersion:1, blocking:true, entries:[
  { id:"missing-damage-inputs",severity:"blocker",scope:"activation",finding:"La Tabla 4 publica Fv, S, Tcd y TLd, pero no publica A0d ni Fa, aunque la gráfica los requiere para T≤Tcd.",disposition:"No inferir ni sustituir con NSR-10; activar solo tras aclaración normativa primaria." },
  { id:"legal-currentness",severity:"monitor",scope:"legal-status",finding:"No se localizó acto oficial posterior que derogue o modifique el Decreto 0158; el POT 2014 ordena aplicarlo y actualizarlo.",disposition:"Repetir búsqueda de vigencia en la fecha de una futura activación." },
  { id:"map-sheet-provenance",severity:"monitor",scope:"evidence",finding:"La plancha MZSC-R02 no aparece en el Tomo 6 bloqueado, cuyas 159 páginas son todas tamaño carta frente a los 2466×3770 pt de la plancha. La única copia recuperable devuelve exactamente 3 100 744 bytes y SHA-256 9749f92f… desde el espejo de espectrocol.com, que no es la entidad publicadora.",disposition:"Se conserva la huella y la URL del espejo en data/map-evidence.json para que un revisor reproduzca los recortes; falta localizar la URL del publicador antes de la activación." },
  { id:"independent-review",severity:"blocker",scope:"merge/activation",finding:"La transcripción manual y sus recortes deterministas aún no tienen firma de revisor independiente.",disposition:"Mantener estado research-only hasta revisión." },
] };
const conflicts = { schemaVersion:1, entries:[
  { id:"historical-vs-adopted-damage",issue:"El estudio técnico 2005 usa Ad=0.05/10 años; el decreto adoptado usa Ad=0.09 y la NSR-10 identifica 31 años.",resolution:"El Decreto 0158 de 2014 y la NSR-10 gobiernan el producto; el estudio queda como linaje histórico.",status:"resolved-for-research" },
  { id:"six-macrozones-ten-labels",issue:"La publicación resume seis macrozonas, mientras las tablas enumeran diez etiquetas de respuesta (1,2,3,4A–4E,5,6).",resolution:"Conservar diez opciones geográficas y trece componentes de curva; 4B, 4C y 5 emparejan dos curvas concurrentes.",status:"resolved-for-research" },
  { id:"damage-missing-a0d-fa",issue:"La gráfica exige A0d y Fa, ausentes de la Tabla 4.",resolution:"No resolver por analogía; bloquear la activación de la curva completa.",status:"unresolved-blocker" },
  { id:"map-sheet-tl-zone-4c-tl",issue:"La plancha MZSC-R02 de 2005 imprime TL = 2,0 s para la zona 4C en su componente ETL, mientras la Tabla 2 del Decreto 0158 de 2014 imprime 2,10 s para la misma fila (4c TL: 1.50 · 1.04 · 2.10 · 3.25). Las otras doce combinaciones zona-componente coinciden entre las dos fuentes, y la fila ETC de la misma zona 4C coincide en 2,00 s.",resolution:"Gobierna el decreto adoptado, como en historical-vs-adopted-damage: la plancha es el estudio de 2005 y queda como linaje histórico. Ambas lecturas se verificaron sobre el píxel de cada fuente antes de registrar el conflicto.",status:"resolved-for-research" },
] };
const differences = { schemaVersion:1, referenceSite:"Bogotá", differences:[
  "Cali adopta 10 etiquetas de respuesta y 13 componentes de curva; Bogotá usa su propia zonificación y no es fuente de coeficientes para Cali.",
  "Cali publica pares concurrentes para 4B, 4C y 5.",
  "La tabla de umbral de daño de Cali omite A0d y Fa aunque su ecuación los requiere.",
], nonInference:"No se transfieren coeficientes, fórmulas faltantes ni reglas de otra ciudad." };
const redistribution = { schemaVersion:1, decision:"external-only-all-sources", committedSourceBytes:false, rationale:"Las cuatro fuentes se fijan por URL oficial, tamaño, páginas y SHA-256; no se encontró licencia expresa que autorice republicación dentro de este dossier.", localVerification:"verify_official_pdf.py acepta una copia oficial del Decreto 0158 suministrada localmente y valida huellas de página y recortes.", mapSheetException:{ sourceDocumentId:"ingeominas-2005-mapa-mzsc-r02", committedArtifacts:["public/cali/mapa-mzsc-r02.png","public/cali/mapa-mzsc-r02-leyenda.png","public/cali/mapa-mzsc-r02-coeficientes.png"], scope:"Rásteres a resolución de pantalla de la plancha MZSC-R02, de su leyenda temática y de su tabla impresa de coeficientes espectrales, mostrados en el cajón de trazabilidad para ubicar la zona y contrastar los valores adoptados.", distinctFromLockedSources:"La plancha no es ninguna de las cuatro fuentes fijadas en source-locks.json, que siguen sin bytes en el repositorio.", permissionStatus:"not-established", ownerDecision:"Publicarla: sin la plancha el ingeniero no puede comprobar en qué zona cae el predio, que es lo único que la cita no puede respaldar.", reviewerAction:"Si la plancha no puede republicarse, borrar los tres PNG y dejar solo el enlace saliente." } };
const review = { schemaVersion:1, transcription:{method:"manual-double-entry-with-deterministic-image-crop-hashes",author:"Codex research pass",date:"2026-07-25",status:"complete"}, independentReview:{reviewer:null,date:null,status:"pending"}, activationDecision:"blocked-missing-damage-inputs-and-independent-review" };
const extractionProfile = { schemaVersion:1, sourceDocumentId:decreeId, method:"embedded-JPEG-manual-transcription", pageImage:{width:1280,height:2080,colorSpace:"RGB"}, hashing:{embeddedImageBytes:"sha256",cropPixels:"sha256(raw RGB bytes)",rectangles:"normalized coordinates rounded to image pixels"}, ocrUsed:false };
const oracleInput = {
  schemaVersion: 1,
  studyId: manifest.studyId,
  status: "partial-oracle-activation-blocked",
  importanceCoefficient: 1,
  fields: fields.map(([id]) => id),
  options: options.map(([id]) => id),
  hazards: Object.fromEntries(matrixHazards.map((hazard) => [hazard.id, {
    baseAccelerationG: hazard.base,
    rows: options.map(([, , ,], optionIndex) => {
      const sourceIndex = hazard.id === "damage-threshold" ? damageIndex[optionIndex] : optionIndex;
      return hazard.rows[sourceIndex];
    }),
  }])),
  ancillaryCurves: {
    "site-specific-design-minimum": { baseAccelerationG: minimumTable.base, rows: minimumTable.rows },
  },
};

const artifacts = new Map([
  ["evidence/manifest.json", manifest], ["data/canonical.json", canonical], ["evidence/source-locks.json", sourceLocks],
  ["evidence/formula-inventory.json", formulas], ["evidence/claims-matrix.json", claims], ["evidence/uncertainty-ledger.json", uncertainties],
  ["evidence/conflict-ledger.json", conflicts], ["evidence/reference-site-differences.json", differences], ["evidence/redistribution.json", redistribution],
  ["evidence/review-record.json", review], ["evidence/extraction-profile.json", extractionProfile], ["oracle/oracle-input.json", oracleInput],
  ["evidence/historical-locator.json", historicalLocator],
]);

const check = process.argv.includes("--check");
for (const [path, value] of artifacts) {
  const expected = json(value);
  if (check) {
    const actual = await readFile(out(path), "utf8");
    if (actual !== expected) throw new Error(`Cali generated artifact differs: ${path}`);
  } else {
    await mkdir(dirname(out(path)), { recursive: true });
    await writeFile(out(path), expected, "utf8");
  }
}
console.log(`${check ? "checked" : "generated"} ${artifacts.size} Cali evidence artifacts`);
