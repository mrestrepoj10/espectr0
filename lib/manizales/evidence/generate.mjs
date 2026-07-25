import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const target = (path) => resolve(root, path);
const encode = (value) => `${JSON.stringify(value, null, 2)}\n`;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const full = { left: 0, top: 0, width: 1, height: 1 };
const retrievedOn = "2026-07-25";

const articleId = "manizales-update-2015";
const reportId = "manizales-management-report-2016-2019";
const potStatusId = "manizales-pot-status-2025";

const sources = [
  {
    id: articleId,
    issuingAuthority: "Universidad de los Andes y Asociacion Colombiana de Ingenieria Sismica",
    officialTitle: "Actualizacion de la microzonificacion sismica de Manizales",
    edition: "Memorias del VII Congreso Nacional de Ingenieria Sismica, mayo de 2015",
    revision: null,
    adoptionInstrument: "No identificado; es una fuente tecnica y no un acto de adopcion",
    amendmentsAndErrata: [],
    legalStatus: "unknown",
    applicabilityStatus: "unknown",
    officialUrl: "https://upcommons.upc.edu/bitstreams/3355be9f-7fb3-475e-bf7a-46462cff7add/download",
    retrievedOn,
    redistribution: {
      decision: "external-only",
      rationale: "El repositorio institucional permite consulta abierta, pero la ficha no concede una licencia de redistribucion suficiente para incorporar los bytes.",
    },
    mediaType: "application/pdf",
    pageCount: 10,
    sha256: "55a8458cc211c83b3e13cf5feb7670dbd120535542c779512f1d2a86bd6628e3",
    pages: [1, 2, 8, 9].map((physicalPage) => ({ physicalPage, printedPage: null, rotationDegrees: 0, crop: full })),
  },
  {
    id: reportId,
    issuingAuthority: "Alcaldia de Manizales",
    officialTitle: "Informe de gestion Manizales Mas Oportunidades 2016-2019",
    edition: "Cierre de gobierno 2016-2019",
    revision: null,
    adoptionInstrument: "Informe oficial de gestion; no es un acto de adopcion",
    amendmentsAndErrata: [],
    legalStatus: "historical",
    applicabilityStatus: "historical",
    officialUrl: "https://manizales.gov.co/wp-content/uploads/Informe-Manizales-M%C3%A1s-Oportunidades-2016-2019.pdf",
    retrievedOn,
    redistribution: {
      decision: "external-only",
      rationale: "Documento oficial sin licencia expresa de redistribucion; se conservan huella, localizador y atestacion, no los bytes.",
    },
    mediaType: "application/pdf",
    pageCount: 151,
    sha256: "6345925e0afb5ba03d0f713a2a87e0c8ec6fa7da8128849f6095e26cefd6a373",
    pages: [{ physicalPage: 65, printedPage: null, rotationDegrees: 0, crop: full }],
  },
  {
    id: potStatusId,
    issuingAuthority: "Secretaria de Planeacion de Manizales",
    officialTitle: "Respuesta S-CO-SP-UDOT-2025-18777",
    edition: "5 de junio de 2025",
    revision: null,
    adoptionInstrument: "Comunicacion administrativa; acredita el POT citado, no adopta la microzonificacion",
    amendmentsAndErrata: [],
    legalStatus: "active",
    applicabilityStatus: "conditional",
    officialUrl: "https://manizales.gov.co/wp-content/uploads/piotnetforms/files/S-CO-SP-UDOT-2025-18777-E-CO-2025-13941-ANONIMO-1-68470f0813cfc.pdf",
    retrievedOn,
    redistribution: {
      decision: "external-only",
      rationale: "Comunicacion oficial sin licencia expresa de redistribucion; se conserva solo evidencia reproducible de procedencia.",
    },
    mediaType: "application/pdf",
    pageCount: 2,
    sha256: "13790747a041c6f7d80ae9229336174f3b18f6bcfc6cdde18b406b6ac643a2d8",
    pages: [{ physicalPage: 1, printedPage: null, rotationDegrees: 0, crop: full }],
  },
];

const citation = (id, sourceDocumentId, regionKind, physicalPage, reference, rect, extractedToken, extra = {}) => ({
  id,
  sourceDocumentId,
  regionKind,
  physicalPage,
  printedPage: null,
  reference,
  rect,
  extractedToken,
  unit: null,
  transformation: null,
  requiredTokens: [extractedToken],
  ...extra,
});

const citations = [
  citation("table-update-basis", articleId, "table", 1, "Resumen: base cuantitativa de la actualizacion", { left: 0.1, top: 0.43, width: 0.82, height: 0.19 }, "Una malla de cálculo compuesta por 1275 nodos"),
  citation("row-update-basis", articleId, "row", 1, "Resumen: fila del modelo candidato", { left: 0.115, top: 0.445, width: 0.795, height: 0.17 }, "para 475 años de periodo de retorno", { parentCitationId: "table-update-basis" }),
  citation("cell-node-count", articleId, "cell", 1, "Resumen: numero de nodos", { left: 0.413159, top: 0.469315, width: 0.036014, height: 0.016412 }, "1275", { parentCitationId: "row-update-basis", normalizedValue: 1275, normalizedNumericValue: 1275, unit: "count", transformation: "decimal parse" }),
  citation("cell-return-period", articleId, "cell", 1, "Resumen: periodo de retorno", { left: 0.165538, top: 0.545087, width: 0.028574, height: 0.016412 }, "475", { parentCitationId: "row-update-basis", normalizedValue: 475, normalizedNumericValue: 475, unit: "year", transformation: "decimal parse" }),
  citation("cell-spatial-model", articleId, "applicability", 1, "Resumen: representacion espacial", { left: 0.202766, top: 0.595685, width: 0.073904, height: 0.016412 }, "rasterizada,"),
  citation("app-original-three-zones", articleId, "applicability", 2, "Introduccion: reconciliacion con el estudio Uniandes 2002", { left: 0.1, top: 0.19, width: 0.82, height: 0.13 }, "la definición de espectros de diseño en 3 zonas"),
  citation("table-update-parameters", articleId, "table", 8, "Seccion 5.1: parametros del ajuste", { left: 0.1, top: 0.445, width: 0.82, height: 0.105 }, "Los espectros de diseño se calculan por medio de la definición de 5 parámetros: Aa, Av, I, Fa y Fv."),
  citation("row-update-parameters", articleId, "row", 8, "Seccion 5.1: fila de parametros", { left: 0.115, top: 0.46, width: 0.795, height: 0.08 }, "Aa = 0.25g y Av = 0.25g", { parentCitationId: "table-update-parameters" }),
  citation("cell-aa", articleId, "cell", 8, "Seccion 5.1: Aa", { left: 0.184572, top: 0.493125, width: 0.072316, height: 0.016412 }, "0.25", { parentCitationId: "row-update-parameters", normalizedValue: 0.25, normalizedNumericValue: 0.25, unit: "g", transformation: "decimal parse" }),
  citation("cell-av", articleId, "cell", 8, "Seccion 5.1: Av", { left: 0.265144, top: 0.493125, width: 0.075158, height: 0.016412 }, "0.25", { parentCitationId: "row-update-parameters", normalizedValue: 0.25, normalizedNumericValue: 0.25, unit: "g", transformation: "decimal parse" }),
  citation("cell-importance-fit", articleId, "cell", 8, "Seccion 5.1: factor de importancia asumido para el ajuste", { left: 0.57889, top: 0.493125, width: 0.038617, height: 0.016412 }, "1", { parentCitationId: "row-update-parameters", normalizedValue: 1, normalizedNumericValue: 1, unit: "dimensionless", transformation: "decimal parse" }),
  citation("cell-soil-parameters", articleId, "applicability", 8, "Seccion 5.1: parametros libres de suelo", { left: 0.682595, top: 0.467952, width: 0.058289, height: 0.016412 }, "Fa y Fv."),
  citation("warning-raster-not-zones", articleId, "applicability", 9, "Conclusiones, numeral 3", { left: 0.13, top: 0.55, width: 0.78, height: 0.08 }, "Los resultados no se presentan por zonas sino de manera rasterizada"),
  citation("app-building-compatibility", articleId, "applicability", 9, "Conclusiones, numeral 5", { left: 0.13, top: 0.69, width: 0.78, height: 0.1 }, "totalmente compatible con la normativa nacional"),
  citation("warning-adoption-pending-2019", reportId, "applicability", 65, "Temas que se encuentran en desarrollo", { left: 0.12, top: 0.47, width: 0.78, height: 0.32 }, "Adoptar e implementar la microzonificación Sísmica armonizada de Manizales"),
  citation("app-pot-current-2025", potStatusId, "applicability", 1, "Primer parrafo tecnico", { left: 0.12, top: 0.34, width: 0.7, height: 0.08 }, "Acuerdo 0958 de 2017 Plan de Ordenamiento Territorial de Manizales, POT Vigente"),
];

const fields = [
  ["node-count", 1275, "count", "cell-node-count", "decimal parse"],
  ["return-period", 475, "year", "cell-return-period", "decimal parse"],
  ["aa", 0.25, "g", "cell-aa", "decimal parse"],
  ["av", 0.25, "g", "cell-av", "decimal parse"],
  ["importance-factor-fit", 1, "dimensionless", "cell-importance-fit", "decimal parse"],
];
const optionId = "updated-raster-grid";
const hazardId = "uniform-hazard-475y";
const rowFields = Object.fromEntries(fields.map(([fieldId, value]) => [fieldId, value]));
const rowCitationIds = fields.map(([, , , citationId]) => citationId);
const values = fields.map(([fieldId, value, unit, citationId, transformation]) => ({
  id: `value-${fieldId}`,
  optionId,
  hazardId,
  fieldId,
  value,
  unit,
  provenance: "direct-source",
  citationIds: [citationId],
  transformation,
}));
const rawRow = { id: "raw-updated-raster-grid-475y", rowKey: `${optionId}/${hazardId}`, sourceDocumentId: articleId, optionId, hazardId, citationIds: rowCitationIds, fields: rowFields };
const canonicalRow = { ...rawRow, id: "canonical-updated-raster-grid-475y", sourceRowIds: [rawRow.id] };

const manifest = {
  schemaVersion: 1,
  studyId: "manizales-microzonation",
  title: "Microzonificacion sismica de Manizales - evidencia de investigacion bloqueada",
  sources,
  citations,
  applicabilityCitationIds: ["cell-spatial-model", "app-original-three-zones", "cell-soil-parameters", "warning-raster-not-zones", "app-building-compatibility", "warning-adoption-pending-2019", "app-pot-current-2025"],
  coverage: { optionIds: [optionId], hazardIds: [hazardId], fieldIds: fields.map(([id]) => id) },
  values,
  rawRows: [rawRow],
  canonicalRows: [canonicalRow],
  overrides: [],
};

const canonical = {
  schemaVersion: 1,
  studyId: manifest.studyId,
  status: "research-only-activation-blocked",
  activationAllowed: false,
  mergeIntoEngineAllowed: false,
  blockers: [
    "No se recupero un acto primario vigente que adopte la actualizacion armonizada; el informe municipal de cierre 2016-2019 aun ubicaba su adopcion en desarrollo.",
    "El modelo actualizado es rasterizado por puntos y no ofrece zonas para un selector manual sin GIS.",
    "La fuente tecnica bloqueada no publica los 1275 pares Fa/Fv ni una tabla discreta que permita reproducirlos.",
    "La fuente tecnica no publica la formula espectral operacional completa, sus limites de rama ni el amortiguamiento del espectro de salida.",
    "La revision humana independiente esta pendiente.",
  ],
  historicalModel: {
    year: 2002,
    status: "historical-not-activated",
    designZones: [
      { id: "zone-a", label: "Zona A", description: "Depositos de caida piroclastica (ceniza), de espesor variable" },
      { id: "zone-b", label: "Zona B", description: "Depositos de relleno" },
      { id: "zone-c", label: "Zona C", description: "Formaciones rocosas o suelos de poco espesor" },
    ],
    evidenceBasis: "Reconciliacion publicada por los autores de la actualizacion de 2015; el PDF original de 2002 no pudo bloquearse en esta ejecucion.",
  },
  governingTechnicalCandidate: {
    id: optionId,
    model: "1275-node-raster-grid",
    manualSelectorCompatible: false,
    locationResolution: "requires-spatial-model-not-in-product-scope",
    hazard: { id: hazardId, averageReturnPeriodYears: 475, dampingRatio: null },
    fixedFitParameters: { aaG: 0.25, avG: 0.25, importanceFactor: 1 },
    spatialOutputs: ["Fa", "Fv"],
    formulaStatus: "missing-operational-piecewise-formula-and-branch-limits",
  },
  rows: [{ optionId, hazardId, fields: rowFields }],
  buildingCompatibility: {
    technicalStatement: "La publicacion afirma compatibilidad tecnica con la NSR-10 para edificaciones nuevas una vez definido el espectro del sitio.",
    legalQualification: "La compatibilidad tecnica no equivale a adopcion municipal ni demuestra vigencia.",
  },
};

const sourceLocks = {
  schemaVersion: 1,
  retrievedOn,
  locks: [
    [articleId, sources[0].officialUrl, sources[0].sha256, 10, 1229511],
    [reportId, sources[1].officialUrl, sources[1].sha256, 151, 3871932],
    [potStatusId, sources[2].officialUrl, sources[2].sha256, 2, 563357],
  ].map(([sourceDocumentId, officialUrl, sha256, pageCount, byteLength]) => ({ sourceDocumentId, officialUrl, sha256, pageCount, byteLength, redistributionDecision: "external-only" })),
  unavailableSources: [
    {
      id: "manizales-uniandes-2002",
      officialUrl: "https://repositorio.gestiondelriesgo.gov.co/handle/20.500.11762/19861",
      expectedTitle: "Microzonificacion Sismica de la Ciudad de Manizales",
      status: "unavailable-for-byte-lock",
      reason: "El repositorio oficial redirigio la descarga a un puerto no accesible desde el entorno; no se inventa SHA-256, longitud ni paginacion.",
    },
    {
      id: "manizales-harmonization-2014",
      officialUrl: "https://repositorio.gestiondelriesgo.gov.co/handle/20.500.11762/36862",
      expectedTitle: "Armonizacion de la microzonificacion sismica con las normas NSR-10",
      status: "unavailable-for-byte-lock",
      reason: "La descarga primaria no fue recuperable desde el entorno; la publicacion de 2015 se usa como unica fuente tecnica bloqueada de la actualizacion.",
    },
    {
      id: "manizales-adoption-instrument",
      officialUrl: "https://manizales.gov.co/transparencia-y-acceso-informacion-publica/normatividad/decretos/",
      expectedTitle: "Acto de adopcion o certificacion oficial de inexistencia",
      status: "not-retrieved-material-blocker",
      reason: "La coleccion oficial enlaza a un SharePoint con autenticacion y no se recupero un decreto de adopcion, modificacion o derogatoria.",
    },
  ],
};

const formulas = {
  schemaVersion: 1,
  status: "incomplete-blocks-activation",
  independentVariable: "period T (s)",
  output: "spectral acceleration",
  inventoryCoverage: { expectedItems: 4, dispositionedItems: 4, coveragePercent: 100, operationalFormulaCoveragePercent: 0 },
  formulas: [
    {
      id: "nsr10-design-spectrum-shape",
      status: "blocked-formula-not-published",
      finding: "La fuente indica que ajusta una forma NSR-10 con Aa, Av, I, Fa y Fv, pero no imprime la ecuacion por tramos.",
      citation: { sourceDocumentId: articleId, physicalPage: 8, printedPage: null, reference: "Seccion 5.1", rect: { left: 0.1, top: 0.42, width: 0.82, height: 0.16 } },
    },
    {
      id: "branch-limits",
      status: "blocked-limits-not-published",
      finding: "No se publican limites de rama ni politica de frontera para el espectro operacional.",
      citation: { sourceDocumentId: articleId, physicalPage: 8, printedPage: null, reference: "Seccion 5.1", rect: { left: 0.1, top: 0.42, width: 0.82, height: 0.16 } },
    },
    {
      id: "fa-fv-node-fit",
      status: "method-only-no-node-table",
      finding: "Fa y Fv se ajustan como parametros libres mediante algoritmo genetico para cada nodo; el articulo no tabula los 1275 resultados.",
      citation: { sourceDocumentId: articleId, physicalPage: 8, printedPage: null, reference: "Secciones 5.1 y 5.2", rect: { left: 0.1, top: 0.45, width: 0.82, height: 0.46 } },
    },
    {
      id: "spectrum-damping",
      status: "blocked-output-damping-not-stated",
      finding: "No se identifica en la publicacion el amortiguamiento del espectro de amenaza uniforme o del espectro de diseno entregado; no se confunde con amortiguamiento interno del modelo de suelo.",
      citation: { sourceDocumentId: articleId, physicalPage: 1, printedPage: null, reference: "Resumen", rect: { left: 0.1, top: 0.37, width: 0.82, height: 0.26 } },
    },
  ],
};

const claims = {
  schemaVersion: 1,
  exactOptionHazardMatrix: { options: 1, hazards: 1, fieldsPerRow: 5, expectedFieldValues: 5, exactCoveredFieldValues: 5, coveragePercent: 100 },
  categoryCoverage: {
    direct: { expected: 5, cited: 5, coveragePercent: 100 },
    formulaInventory: { expected: 4, dispositioned: 4, coveragePercent: 100, operationalFormulaCoveragePercent: 0 },
    warning: { expected: 6, citedOrExplicitlyBlocked: 6, coveragePercent: 100 },
    applicability: { expected: 5, citedOrExplicitlyBlocked: 5, coveragePercent: 100 },
  },
  claims: [
    { id: "historical-zones", kind: "lineage", statement: "La actualizacion describe el estudio 2002 con tres zonas de diseno A, B y C.", citation: { sourceDocumentId: articleId, physicalPage: 2, printedPage: null, reference: "Introduccion" } },
    { id: "updated-governing-model", kind: "direct", statement: "La actualizacion calcula 1275 sitios y presenta resultados rasterizados, no por zonas.", citation: { sourceDocumentId: articleId, physicalPage: 9, printedPage: null, reference: "Conclusiones, numeral 3" } },
    { id: "hazard-return", kind: "direct", statement: "El unico periodo de retorno cuantificado para el espectro de amenaza uniforme es 475 anos.", citation: { sourceDocumentId: articleId, physicalPage: 1, printedPage: null, reference: "Resumen" } },
    { id: "fit-parameters", kind: "direct", statement: "El ajuste fija Aa=0.25g, Av=0.25g e I=1, y deja Fa/Fv como parametros libres de suelo.", citation: { sourceDocumentId: articleId, physicalPage: 8, printedPage: null, reference: "Seccion 5.1" } },
    { id: "building-compatibility", kind: "applicability", statement: "La compatibilidad con la NSR-10 se formula para espectros de edificaciones nuevas una vez definido el espectro local.", citation: { sourceDocumentId: articleId, physicalPage: 9, printedPage: null, reference: "Conclusiones, numeral 5" } },
    { id: "adoption-pending-2019", kind: "warning", statement: "El informe municipal de cierre 2016-2019 ubica adoptar e implementar la microzonificacion armonizada entre los temas en desarrollo.", citation: { sourceDocumentId: reportId, physicalPage: 65, printedPage: null, reference: "Temas que se encuentran en desarrollo" } },
    { id: "pot-current-2025", kind: "applicability", statement: "Una comunicacion oficial de 2025 denomina vigente al POT adoptado por Acuerdo 0958 de 2017; esto no acredita por si solo la adopcion de la microzonificacion.", citation: { sourceDocumentId: potStatusId, physicalPage: 1, printedPage: null, reference: "Primer parrafo tecnico" } },
  ],
};

const uncertainties = {
  schemaVersion: 1,
  blocking: true,
  entries: [
    { id: "adoption-currentness", severity: "blocker", scope: "legal-status", finding: "No se recupero el acto de adopcion, vigencia, modificacion o derogatoria de la actualizacion armonizada.", disposition: "No activar. Exigir instrumento primario completo y busqueda de vigencia repetible." },
    { id: "manual-location-model", severity: "blocker", scope: "selector", finding: "El modelo tecnico gobernante es espacial por puntos; un selector manual de zonas alteraria el modelo.", disposition: "No discretizar, interpolar ni reutilizar A/B/C como si fueran la actualizacion." },
    { id: "missing-node-values", severity: "blocker", scope: "coefficients", finding: "No se dispone de los 1275 pares Fa/Fv en una fuente tabular bloqueada.", disposition: "Exigir tabla oficial completa o instrumento de consulta oficial reproducible." },
    { id: "missing-formula", severity: "blocker", scope: "formula", finding: "Faltan ecuacion operacional, limites de rama y amortiguamiento del espectro.", disposition: "No importar automaticamente formulas NSR-10 desde otra fuente como si fueran publicadas por el estudio." },
    { id: "original-byte-lock", severity: "blocker", scope: "lineage", finding: "El PDF original 2002 no pudo bloquearse; las advertencias indexadas no se canonizan.", disposition: "Recuperar y revisar el original antes de cualquier uso historico." },
    { id: "independent-review", severity: "blocker", scope: "review", finding: "No existe revision humana independiente firmada del dossier.", disposition: "Mantener no-merge/no-activation." },
  ],
};

const conflicts = {
  schemaVersion: 1,
  entries: [
    { id: "zones-vs-raster", status: "resolved-research-only", original: "Tres zonas A/B/C en el estudio de 2002.", update: "Modelo rasterizado de 1275 puntos en la actualizacion de 2015.", resolution: "La actualizacion gobierna la representacion tecnica candidata; las zonas quedan solo como historia y no se ofrecen al producto." },
    { id: "technical-vs-legal", status: "unresolved-blocker", original: "La publicacion declara compatibilidad tecnica con NSR-10.", update: "No se recupero un acto municipal vigente de adopcion; en 2019 el proceso seguia en desarrollo.", resolution: "La compatibilidad tecnica no suple adopcion ni vigencia." },
    { id: "manual-selector-vs-spatial-model", status: "unresolved-blocker", original: "El producto exige selector manual sin GIS.", update: "Fa/Fv dependen de un nodo o ubicacion del modelo raster.", resolution: "No existe transformacion primaria autorizada a categorias manuales." },
  ],
};

const differences = {
  schemaVersion: 1,
  referenceWebsiteRole: "comparison-only-not-regulatory-source",
  inspectedForRegulatoryValues: false,
  differences: [
    { id: "historical-zone-selector", status: "do-not-reproduce", finding: "Cualquier selector A/B/C representa el modelo historico 2002 y contradice el modelo raster actualizado si se presenta como vigente." },
    { id: "coefficients-or-formulas", status: "not-accepted", finding: "No se acepta ningun coeficiente, formula, limite, redondeo, valor por defecto o advertencia desde la web de referencia." },
  ],
  nonInference: "No se transfieren valores ni comportamientos de la web de referencia a la evidencia canonica.",
};

const redistribution = {
  schemaVersion: 1,
  decision: "external-only-all-locked-sources",
  committedSourceBytes: false,
  sources: sources.map(({ id, officialUrl, redistribution }) => ({ sourceDocumentId: id, officialUrl, decision: redistribution.decision, rationale: redistribution.rationale })),
  note: "Las capturas, recortes y PDFs usados para inspeccion fueron temporales y no forman parte del paquete versionado.",
};

const review = {
  schemaVersion: 1,
  authoringStatus: "complete-research-dossier",
  independentReview: { status: "pending", reviewer: null, reviewedOn: null },
  activationDecision: "blocked-no-merge-no-activation",
  reasons: canonical.blockers,
};

const profile = {
  schemaVersion: 1,
  renderer: "Poppler pdftoppm",
  renderDpi: 144,
  textExtractor: "pdfplumber word extraction",
  ocrUsed: false,
  coordinateSystem: "normalized PDF page coordinates, top-left origin",
  cropEncoding: "PNG RGB, Pillow compress_level=9, optimize=false",
};

const cropHashes = {
  "table-update-basis": "acb00f71896725abda004a6f45ccf72887e7cec1fe6d6aae772eb6b75a2c3cd5",
  "row-update-basis": "39600e5377f1869297d6ad4c213c255935ad9212622f388938bf825f92c17c68",
  "cell-node-count": "668f878c9b83214666d8b6aa0d6f532976b7192d3394ff72c904db7471e98033",
  "cell-return-period": "d61241fb81e00468e4e0964e7fd29fef74267bb4e49cf451bd92db4eaaaf9946",
  "cell-spatial-model": "afb4d66d619b50d485b123d649448286b7e0d0302b8ad7c97a65688413f345d5",
  "app-original-three-zones": "0e355a3eb9be930c81cb85cfee01e1c1e48cb9847e210d31679e709823815a43",
  "table-update-parameters": "8e4506bbfc87a52de57fc45a2cee2b9689bfb309c6c5ed3156bef7d01b6d7b7f",
  "row-update-parameters": "eacc67c855d92d64a67e684b214828c7fe90edf3a709a01c9602b46b7f7b7814",
  "cell-aa": "f2959765948ec40534e6632cb20271c5de0e268f296a352e00d0bc4929e42a33",
  "cell-av": "f86c1a2be08d6980965140cb0142ed746e377ac6278da8fda4f7a040a2cdd973",
  "cell-importance-fit": "b549f7bc5770786682317046f89fb83cbefa5ae711eae9d6d77e7b4dd01792f9",
  "cell-soil-parameters": "95a3ffc64e0a7544eff43cdae444a6f30ee060a8f44d573046890ea1e2eb385e",
  "warning-raster-not-zones": "3c4e83f99f73d58ed231477e0b42f3962e603d5590c605598158d7b8444cacdb",
  "app-building-compatibility": "b746259dddc2f7223ebe48cbc560933676800c2ebce92800febac7b2d1bc93b1",
  "warning-adoption-pending-2019": "8b588e9cdc9c7214a98bfa238f805cc5eb7423263da4b0be074684625ea2814b",
  "app-pot-current-2025": "96e2e8fb591f5ceb639ee55b400d298a4430e33fba3ed2bf3df157dca84177fe",
};
const attestationPayload = {
  schemaVersion: 1,
  profile,
  sourceLocks: sourceLocks.locks.map(({ sourceDocumentId, sha256, pageCount, byteLength }) => ({ sourceDocumentId, sha256, pageCount, byteLength })),
  regions: citations.map((item) => ({
    citationId: item.id,
    sourceDocumentId: item.sourceDocumentId,
    physicalPage: item.physicalPage,
    rect: item.rect,
    tokenSha256: hash(Buffer.from(item.extractedToken, "utf8")),
    pngCropSha256: cropHashes[item.id],
  })),
  manualReview: { status: "complete", ocrUsed: false, reviewedPages: [`${articleId}:1`, `${articleId}:2`, `${articleId}:8`, `${articleId}:9`, `${reportId}:65`, `${potStatusId}:1`] },
};
const attestation = { ...attestationPayload, payloadSha256: hash(Buffer.from(encode(attestationPayload), "utf8")) };

const oracleInput = {
  schemaVersion: 1,
  studyId: manifest.studyId,
  status: "research-only-activation-blocked",
  candidate: { optionId, hazardId, fields: Object.fromEntries(fields.map(([id, value]) => [id, String(value)])) },
  candidateMetadata: { spatialModel: "rasterized", soilParameters: "Fa/Fv" },
  requiredForSpectrum: ["node-specific Fa", "node-specific Fv", "piecewise spectrum formula", "branch limits", "spectrum damping", "adoption instrument"],
};

const artifacts = {
  "data/canonical.json": canonical,
  "evidence/manifest.json": manifest,
  "evidence/source-locks.json": sourceLocks,
  "evidence/formula-inventory.json": formulas,
  "evidence/claims-matrix.json": claims,
  "evidence/uncertainty-ledger.json": uncertainties,
  "evidence/conflict-ledger.json": conflicts,
  "evidence/reference-site-differences.json": differences,
  "evidence/redistribution.json": redistribution,
  "evidence/review-record.json": review,
  "evidence/extraction-profile.json": profile,
  "evidence/extraction-attestation.json": attestation,
  "oracle/oracle-input.json": oracleInput,
};

const checkMode = process.argv.includes("--check");
for (const [path, value] of Object.entries(artifacts)) {
  const bytes = encode(value);
  if (checkMode) {
    if ((await readFile(target(path), "utf8")) !== bytes) throw new Error(`Generated artifact differs: ${path}`);
  } else {
    await mkdir(dirname(target(path)), { recursive: true });
    await writeFile(target(path), bytes, "utf8");
  }
}
console.log(`${checkMode ? "checked" : "generated"} Manizales evidence artifacts=${Object.keys(artifacts).length}`);
