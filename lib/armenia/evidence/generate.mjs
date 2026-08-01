import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const studyRoot = resolve(here, "..");
const output = (path) => resolve(studyRoot, path);
const deterministicJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const statement = (text) => ({ text, sha256: sha256(Buffer.from(text, "utf8")) });
const fullPage = { left: 0, top: 0, width: 1, height: 1 };

const sourceSpecs = [
  {
    id: "crq-resolution-075-2006",
    issuingAuthority: "Corporación Autónoma Regional del Quindío",
    officialTitle: "Resolución 075 de 2006",
    edition: "2006",
    revision: null,
    adoptionInstrument: "Resolución CRQ 075 de 2006",
    legalStatus: "historical",
    applicabilityStatus: "applicable",
    officialUrl: "https://www.crq.gov.co/wp-content/uploads/2021/03/RESOLUCION075DE2006.pdf",
    mediaType: "application/pdf",
    pageCount: 6,
    verificationPolicy: "raw-byte-lock",
    sha256: "ecfd8e38b405dc6c87ef39f54c5ca16242917f9fa4eb171482ab8eae6ee3c62e",
    byteLength: 989222,
    pages: [{ physicalPage: 3, printedPage: "3", rotationDegrees: 0, crop: fullPage }],
  },
  {
    id: "armenia-cap-acta-153-2019",
    issuingAuthority: "Comisión Asesora Permanente para el Régimen de Construcciones Sismo Resistentes",
    officialTitle: "Acta N.° 153",
    edition: "7 de febrero de 2019",
    revision: null,
    adoptionInstrument: "Concepto de la Comisión en respuesta al Departamento Administrativo de Planeación de Armenia",
    legalStatus: "active",
    applicabilityStatus: "applicable",
    officialUrl: "https://asosismica.org.co/wp-content/uploads/2019/04/Acta-153-CAP-DEFINITIVA-FDO.pdf",
    mediaType: "application/pdf",
    pageCount: 21,
    verificationPolicy: "raw-byte-lock",
    sha256: "f60b99efe9061922f0f365d7e2635abddfcf60b6350cd01a7ebe9a72fcec46f6",
    byteLength: 558515,
    pages: [
      { physicalPage: 1, printedPage: null, rotationDegrees: 0, crop: fullPage },
      { physicalPage: 17, printedPage: null, rotationDegrees: 0, crop: fullPage },
    ],
  },
  {
    id: "armenia-acuerdo-019-2009",
    issuingAuthority: "Concejo Municipal de Armenia",
    officialTitle: "Acuerdo Municipal N.° 019 de noviembre de 2009 — Plan de Ordenamiento Territorial",
    edition: "Gaceta Municipal N.° 1185, 2 de diciembre de 2009",
    revision: null,
    adoptionInstrument: "Acuerdo Municipal N.° 019 de 2009",
    legalStatus: "active",
    applicabilityStatus: "conditional",
    officialUrl: "https://observatorio.quindio.gov.co/images/POT/Armenia/ACUERDO_019_2009.pdf",
    mediaType: "application/pdf",
    pageCount: 417,
    verificationPolicy: "raw-byte-lock",
    sha256: "a7967cf86a686583b9c7d39fb22488b4444b8de43195ca6ee7de8a04c3d7bc14",
    byteLength: 2256691,
    pages: [{ physicalPage: 47, printedPage: "46", rotationDegrees: 0, crop: fullPage }],
  },
  {
    id: "armenia-pot-volume-4b-2009",
    issuingAuthority: "Departamento Administrativo de Planeación Municipal de Armenia",
    officialTitle: "POT 2009–2023 — Volumen 4-B, documento técnico de soporte, componente urbano",
    edition: "Documento final adoptado por Acuerdo Municipal N.° 019 de 2009",
    revision: null,
    adoptionInstrument: "Acuerdo Municipal N.° 019 de 2009",
    legalStatus: "historical",
    applicabilityStatus: "conditional",
    officialUrl: "https://observatorio.quindio.gov.co/images/POT/Armenia/VOL_04_B_COMPONENTE_URBANO.pdf",
    mediaType: "application/pdf",
    pageCount: 303,
    verificationPolicy: "raw-byte-lock",
    sha256: "1643056e170f4a901c0084c8fdf21cedd1be79c94fc20ac33e7102a84ad20ee2",
    byteLength: 5197828,
    pages: [{ physicalPage: 81, printedPage: "81", rotationDegrees: 0, crop: fullPage }],
  },
  {
    id: "quindio-armenia-delivery-2025",
    issuingAuthority: "Gobernación del Quindío",
    officialTitle: "Gobernación trabaja intensamente para que Quindío sea el primer departamento de Colombia con estudios de microzonificación sísmica",
    edition: "11 de diciembre de 2025",
    revision: "Página oficial recuperada el 25 de julio de 2026",
    adoptionInstrument: "No es acto de adopción; documenta entrega y trámite aún pendiente",
    legalStatus: "historical",
    applicabilityStatus: "not-applicable",
    officialUrl: "https://www.quindio.gov.co/gobernacion-trabaja-intensamente-para-que-quindio-sea-el-primer-departamento-de-colombia-con-estudios-de-microzonificacion-sismica",
    mediaType: "text/html",
    pageCount: 1,
    verificationPolicy: "live-semantic-dynamic-html",
    observedOn: "2026-07-25",
    sha256: "ddc685957dd77f0263d45ed84b4928b86edf9c7fbbe2caeede4d607a08de67a8",
    byteLength: 121014,
    pages: [{ physicalPage: 1, printedPage: null, rotationDegrees: 0, crop: fullPage }],
  },
  {
    id: "armenia-decree-index-2026-07-25",
    issuingAuthority: "Alcaldía de Armenia",
    officialTitle: "Índice oficial de decretos",
    edition: "Consulta del 25 de julio de 2026",
    revision: "Instantánea externa; la ausencia de términos no prueba exhaustividad del archivo municipal",
    adoptionInstrument: "Índice informativo, no acto de adopción",
    legalStatus: "unknown",
    applicabilityStatus: "unknown",
    officialUrl: "https://www.armenia.gov.co/normativa/decretos",
    mediaType: "text/html",
    pageCount: 1,
    verificationPolicy: "live-semantic-dynamic-html",
    observedOn: "2026-07-25",
    sha256: "d9e82ef0e7cd579afc59eedd6f7bc8f71b9daf8161b51c3b229f6aa313e95a37",
    byteLength: 211175,
    pages: [{ physicalPage: 1, printedPage: null, rotationDegrees: 0, crop: fullPage }],
  },
];

const sources = sourceSpecs.map((sourceSpec) => {
	const source = { ...sourceSpec };
	delete source.byteLength;
	delete source.verificationPolicy;
	delete source.observedOn;
	return {
		...source,
		amendmentsAndErrata: [],
		retrievedOn: "2026-07-25",
		redistribution: {
			decision: "external-only",
			rationale: "La página oficial no publica una licencia expresa de redistribución; se conservan URL, tamaño, páginas y SHA-256, no los bytes.",
		},
	};
});

const statusText = "Ahora el municipio debe adelantar ante la Comisión Nacional Asesora Sismorresistente, para su aprobación y posterior oficialización a través de un decreto.";
const citations = [
  {
    id: "applicability-crq-decree-079",
    sourceDocumentId: "crq-resolution-075-2006",
    regionKind: "applicability",
    physicalPage: 3,
    printedPage: "3",
    reference: "Considerandos de la Resolución 075 de 2006",
    rect: fullPage,
    extractedToken: "cartografía de zonificación o amenaza sísmica, a partir del cual es aplicable el Decreto Municipal No. 079 de Septiembre 29/2000 que reglamenta lo relacionado para la ciudad de Armenia",
    unit: null,
    transformation: null,
    requiredTokens: ["es aplicable", "Decreto Municipal No. 079", "Septiembre 29/2000"],
  },
  {
    id: "table-current-regulatory-status",
    sourceDocumentId: "quindio-armenia-delivery-2025",
    regionKind: "table",
    physicalPage: 1,
    printedPage: null,
    reference: "Cronología oficial del estado regulatorio",
    rect: { left: 0.02, top: 0.02, width: 0.96, height: 0.96 },
    extractedToken: "Estudio entregado; aprobación de la Comisión y decreto municipal pendientes",
    unit: null,
    transformation: null,
    requiredTokens: ["Estudio entregado", "decreto municipal"],
  },
  {
    id: "row-current-regulatory-status",
    sourceDocumentId: "quindio-armenia-delivery-2025",
    regionKind: "row",
    physicalPage: 1,
    printedPage: null,
    reference: "Noticia oficial de 11 de diciembre de 2025, estado posterior a la entrega",
    parentCitationId: "table-current-regulatory-status",
    rect: { left: 0.05, top: 0.05, width: 0.9, height: 0.9 },
    extractedToken: statusText,
    unit: null,
    transformation: null,
    requiredTokens: ["Comisión Nacional Asesora Sismorresistente", "oficialización", "decreto"],
  },
  {
    id: "cell-current-regulatory-status",
    sourceDocumentId: "quindio-armenia-delivery-2025",
    regionKind: "cell",
    physicalPage: 1,
    printedPage: null,
    reference: "Estado normativo normalizado a partir del trámite pendiente",
    parentCitationId: "row-current-regulatory-status",
    rect: { left: 0.1, top: 0.1, width: 0.8, height: 0.8 },
    extractedToken: statusText,
    normalizedValue: statusText,
    unit: null,
    transformation: "text identity",
    requiredTokens: ["aprobación", "decreto"],
  },
  {
    id: "applicability-pot-current-code",
    sourceDocumentId: "armenia-acuerdo-019-2009",
    regionKind: "applicability",
    physicalPage: 47,
    printedPage: "46",
    reference: "POT, criterio 5.3",
    rect: { left: 0.15, top: 0.62, width: 0.75, height: 0.07 },
    extractedToken: "aplicando rigurosamente los criterios definidos en el estudio de microzonificación sísmica del Municipio a nivel de coeficientes espectrales de diseño, cumpliendo con la Norma Sismoresistente vigente",
    unit: null,
    transformation: null,
    requiredTokens: ["microzonificación sísmica", "coeficientes espectrales", "Norma Sismoresistente vigente"],
  },
  {
    id: "applicability-decree-079-nsr98-origin",
    sourceDocumentId: "armenia-pot-volume-4b-2009",
    regionKind: "applicability",
    physicalPage: 81,
    printedPage: "81",
    reference: "Nota al pie 21 del DTS urbano",
    rect: { left: 0.08, top: 0.77, width: 0.4, height: 0.09 },
    extractedToken: "Decreto 079 de 2000 por el cual se adopta la zonificación sísmica y se reglamentan las secciones A.2.4 A.2.6. del Decreto 033 de 1998 N.S.R.98",
    unit: null,
    transformation: null,
    requiredTokens: ["Decreto 079 de 2000", "Decreto 033 de 1998", "N.S.R.98"],
  },
  {
    id: "applicability-cap-harmonization-required",
    sourceDocumentId: "armenia-cap-acta-153-2019",
    regionKind: "applicability",
    physicalPage: 17,
    printedPage: null,
    reference: "Acta 153, respuesta a Planeación de Armenia",
    rect: { left: 0.08, top: 0.32, width: 0.84, height: 0.27 },
    extractedToken: "si la ciudad ya ha adelantado estudios en el pasado, estos deberán actualizarse y armonizarse con la más vigente versión del Reglamento NSR-10 conforme con el numeral A.2.9.5",
    unit: null,
    transformation: null,
    requiredTokens: ["actualizarse", "armonizarse", "NSR-10", "A.2.9.5"],
  },
  {
    id: "applicability-new-study-pending",
    sourceDocumentId: "quindio-armenia-delivery-2025",
    regionKind: "applicability",
    physicalPage: 1,
    printedPage: null,
    reference: "Noticia oficial, párrafo posterior a la entrega",
    rect: { left: 0.03, top: 0.03, width: 0.94, height: 0.94 },
    extractedToken: statusText,
    unit: null,
    transformation: null,
    requiredTokens: ["aprobación", "oficialización", "decreto"],
  },
  {
    id: "applicability-current-index-audit",
    sourceDocumentId: "armenia-decree-index-2026-07-25",
    regionKind: "applicability",
    physicalPage: 1,
    printedPage: null,
    reference: "Índice oficial consultado; control de actualidad no exhaustivo",
    rect: fullPage,
    extractedToken: "DECRETO NÚMERO 094 DE 2026; DECRETO NÚMERO 052 DE 2026",
    unit: null,
    transformation: null,
    requiredTokens: ["DECRETO NÚMERO 094 DE 2026", "DECRETO NÚMERO 052 DE 2026"],
  },
];

const activationValue = {
  id: "value-armenia-regulatory-status-activation-status",
  optionId: "armenia-citywide",
  hazardId: "regulatory-status",
  fieldId: "activation-status",
  value: statusText,
  unit: null,
  provenance: "direct-source",
  citationIds: ["cell-current-regulatory-status"],
  transformation: "text identity",
};
const rowFields = { "activation-status": activationValue.value };
const rawRow = {
  id: "raw-armenia-regulatory-status",
  rowKey: "armenia-citywide/regulatory-status",
  sourceDocumentId: "quindio-armenia-delivery-2025",
  optionId: "armenia-citywide",
  hazardId: "regulatory-status",
  citationIds: ["cell-current-regulatory-status"],
  fields: rowFields,
};
const canonicalRow = {
  ...rawRow,
  id: "canonical-armenia-regulatory-status",
  sourceRowIds: [rawRow.id],
};
const applicabilityCitationIds = citations
  .filter(({ regionKind }) => regionKind === "applicability")
  .map(({ id }) => id);
const study = {
  schemaVersion: 1,
  studyId: "armenia-microzonation",
  title: "Armenia historical microzonation applicability and numerical-source evidence",
  sources,
  citations,
  applicabilityCitationIds,
  coverage: {
    optionIds: ["armenia-citywide"],
    hazardIds: ["regulatory-status"],
    fieldIds: ["activation-status"],
  },
  values: [activationValue],
  rawRows: [rawRow],
  canonicalRows: [canonicalRow],
  overrides: [],
};

const canonical = {
  schemaVersion: 1,
  studyId: study.studyId,
  status: "research-only-activation-blocked",
  governingConclusion: "Official CRQ and POT sources confirm Decreto Municipal 079 de 2000 as Armenia's historical microzonation instrument; calculator activation remains unavailable only because its primary numerical annex was not recovered.",
  controllingBuildingWorkflow: "Use the applicable historical instrument where required by the competent professional; this product cannot reproduce its spectrum until the primary numerical annex is source-locked.",
  regulatoryStatusMatrix: {
    normalizedDecision: "historical-decree-applicable-current-update-context-only-numeric-annex-missing",
    options: [{ id: "armenia-citywide", sourceLabel: "Armenia (estado regulatorio, no opción espectral)" }],
    hazards: [{ id: "regulatory-status", sourceLabel: "Estado de adopción (no amenaza sísmica)" }],
    rows: [{ optionId: "armenia-citywide", hazardId: "regulatory-status", fields: rowFields }],
  },
  proposedSpectrumMatrix: {
    selectableOptions: [],
    hazards: [],
    rows: [],
    exactOptionHazardPairs: 0,
    reason: "The exact historical zone matrix, hazard cases, coefficients and equations are unavailable because the primary Decreto 079 technical annex was not recovered.",
  },
  historicalRecord: {
    instrument: "Decreto Municipal 079 de 2000",
    basis: "NSR-98 / Decreto 033 de 1998",
    exactZonesVerifiedFromLockedPrimarySources: [],
    exactHazardsVerifiedFromLockedPrimarySources: [],
    coefficientsCanonicalized: false,
    formulasCanonicalized: false,
    applicability: "confirmed-by-crq-resolution-075-2006-and-pot",
  },
  currentStudy: {
    deliveredOn: "2025-12-10",
    adoptionStatusAtOfficialDeliveryNotice: "pending-commission-approval-and-municipal-decree",
    adoptionInstrumentVerifiedThrough: "2026-07-25",
    adoptionInstrument: null,
  },
  blockers: [
    "official-decree-079-bytes-and-technical-annex-not-located",
    "historical-zones-hazards-coefficients-formulas-and-site-specific-rules-unavailable",
  ],
  capabilities: {
    spectrumCalculation: false,
    comparison: false,
    contextualPdf: false,
    csvExport: false,
    etabsExport: false,
    jsonExport: false,
    imageExport: false,
    buildingBaseShear: false,
    traceabilityViewer: true,
  },
};

const sourceLocks = {
  schemaVersion: 1,
  retrievedOn: "2026-07-25",
  locks: sourceSpecs.map(({ id, officialUrl, sha256: hash, pageCount, byteLength, verificationPolicy, observedOn }) => (
    verificationPolicy === "raw-byte-lock"
      ? {
        sourceDocumentId: id,
        officialUrl,
        verificationPolicy,
        sha256: hash,
        pageCount,
        byteLength,
        redistributionDecision: "external-only",
      }
      : {
        sourceDocumentId: id,
        officialUrl,
        verificationPolicy,
        observedOn,
        observedSnapshotSha256: hash,
        observedByteLength: byteLength,
        pageCount,
        redistributionDecision: "external-only",
      }
  )),
};

const attestations = [
  {
    id: "attest-crq-decree-079-applicable",
    sourceDocumentId: "crq-resolution-075-2006",
    sourceSha256: sourceSpecs[0].sha256,
    physicalPage: 3,
    rect: fullPage,
    ...statement("cartografía de zonificación o amenaza sísmica, a partir del cual es aplicable el Decreto Municipal No. 079 de Septiembre 29/2000 que reglamenta lo relacionado para la ciudad de Armenia"),
    requiredTokens: ["es aplicable", "Decreto Municipal No. 079", "Septiembre 29/2000"],
  },
  {
    id: "attest-acta-153-harmonization",
    sourceDocumentId: "armenia-cap-acta-153-2019",
    sourceSha256: sourceSpecs[1].sha256,
    physicalPage: 17,
    rect: { left: 0.08, top: 0.32, width: 0.84, height: 0.27 },
    ...statement("si la ciudad ya ha adelantado estudios en el pasado, estos deberán actualizarse y armonizarse con la más vigente versión del Reglamento NSR-10 conforme con el numeral A.2.9.5"),
    requiredTokens: ["actualizarse", "armonizarse", "NSR-10", "A.2.9.5"],
  },
  {
    id: "attest-acuerdo-019-current-code",
    sourceDocumentId: "armenia-acuerdo-019-2009",
    sourceSha256: sourceSpecs[2].sha256,
    physicalPage: 47,
    rect: { left: 0.15, top: 0.62, width: 0.75, height: 0.07 },
    ...statement("aplicando rigurosamente los criterios definidos en el estudio de microzonificación sísmica del Municipio a nivel de coeficientes espectrales de diseño, cumpliendo con la Norma Sismoresistente vigente"),
    requiredTokens: ["microzonificación sísmica", "coeficientes espectrales", "Norma Sismoresistente vigente"],
  },
  {
    id: "attest-pot-decree-079-origin",
    sourceDocumentId: "armenia-pot-volume-4b-2009",
    sourceSha256: sourceSpecs[3].sha256,
    physicalPage: 81,
    rect: { left: 0.08, top: 0.77, width: 0.4, height: 0.09 },
    ...statement("Decreto 079 de 2000 por el cual se adopta la zonificación sísmica y se reglamentan las secciones A.2.4 A.2.6. del Decreto 033 de 1998 N.S.R.98"),
    requiredTokens: ["Decreto 079 de 2000", "Decreto 033 de 1998", "N.S.R.98"],
  },
  {
    id: "attest-pot-fills",
    sourceDocumentId: "armenia-pot-volume-4b-2009",
    sourceSha256: sourceSpecs[3].sha256,
    physicalPage: 81,
    rect: { left: 0.08, top: 0.56, width: 0.5, height: 0.09 },
    ...statement("los proyectos de construcción sobre los llenos artificiales existentes en la ciudad serán exigidos con estudios geotécnicos, de los cuales dependerán sus posibilidades de construcción"),
    requiredTokens: ["llenos artificiales", "estudios", "geotécnicos"],
  },
  {
    id: "attest-delivery-pending",
    sourceDocumentId: "quindio-armenia-delivery-2025",
    verificationPolicy: "live-semantic-dynamic-html",
    sourceObservationSha256: sourceSpecs[4].sha256,
    physicalPage: 1,
    htmlLineRange: [1243, 1245],
    locatorScope: "historical-snapshot-lines-live-full-document-semantic-check",
    rect: fullPage,
    ...statement(statusText),
    requiredTokens: ["Comisión Nacional Asesora Sismorresistente", "aprobación", "oficialización", "decreto"],
  },
  {
    id: "attest-decree-index-audit",
    sourceDocumentId: "armenia-decree-index-2026-07-25",
    verificationPolicy: "live-semantic-dynamic-html",
    sourceObservationSha256: sourceSpecs[5].sha256,
    physicalPage: 1,
    htmlLineRange: [471, 479],
    locatorScope: "historical-snapshot-lines-live-full-document-semantic-check",
    rect: fullPage,
    ...statement("DECRETO NÚMERO 094 DE 2026; DECRETO NÚMERO 052 DE 2026"),
    requiredTokens: ["DECRETO NÚMERO 094 DE 2026", "DECRETO NÚMERO 052 DE 2026"],
    absentTokens: ["microzonificación", "microzonificacion", "Decreto 079"],
    caveat: "Absence in the official index snapshot is corroborating evidence only; it is not treated as proof that no unindexed act exists.",
  },
];
const extractionAttestation = {
  schemaVersion: 1,
  preparedOn: "2026-07-25",
  externalOnly: true,
  extraction: {
    pdf: "pdfplumber 0.11.10 with pdfminer.six; pypdf 6.14.2 page-count cross-check",
    html: "Historical UTF-8 snapshot observation plus live full-document required/absent-token checks; dynamic raw bytes and line numbers are not immutable",
    ocrUsed: false,
    coordinateSystem: "normalized top-left [0,1]",
  },
  attestations,
};
const extractionProfile = {
  schemaVersion: 1,
  coordinateSystem: "normalized top-left [0,1]",
  sourceDelivery: "external-only",
  pdfExtractor: { name: "pdfplumber", version: "0.11.10", ocrUsed: false },
  pdfPageCounter: { name: "pypdf", version: "6.14.2" },
  htmlExtractor: { method: "UTF-8 live full-document semantic assertions; historical snapshot hashes and line ranges are observations only", ocrUsed: false },
  verifier: "verify_official_sources.py",
};

const locator = (id) => {
  const item = attestations.find(({ id: candidate }) => candidate === id);
  if (!item) throw new Error(`Missing attestation ${id}`);
  return {
    sourceDocumentId: item.sourceDocumentId,
    physicalPage: item.physicalPage,
    rect: item.rect,
    attestationId: item.id,
    statementSha256: item.sha256,
  };
};
const claims = [
  {
    id: "legacy-instrument-applicable",
    kind: "applicability",
    claim: "CRQ Resolution 075 of 2006 expressly says Decreto Municipal 079 of 29 September 2000 is applicable in Armenia.",
    citation: locator("attest-crq-decree-079-applicable"),
  },
  {
    id: "legacy-instrument-basis",
    kind: "applicability",
    claim: "Decreto 079 de 2000 was framed as a substitute for NSR-98 sections A.2.4 and A.2.6, not as an NSR-10-harmonized instrument.",
    citation: locator("attest-pot-decree-079-origin"),
  },
  {
    id: "harmonization-required",
    kind: "applicability",
    claim: "The national advisory commission told Armenia that prior studies must be updated and harmonized with the current NSR-10 under A.2.9.5.",
    citation: locator("attest-acta-153-harmonization"),
  },
  {
    id: "new-study-pending",
    kind: "applicability",
    claim: "At official delivery in December 2025, the new study still required Commission approval and municipal decree adoption.",
    citation: locator("attest-delivery-pending"),
  },
  {
    id: "current-index-corroboration",
    kind: "applicability",
    claim: "The official decree index snapshot retrieved 2026-07-25 contains no microzonation term or Decreto 079 entry; this is non-exhaustive corroboration only.",
    citation: locator("attest-decree-index-audit"),
  },
  {
    id: "warning-no-municipal-activation",
    kind: "warning",
    claim: "Do not calculate a municipal spectrum until the primary Decreto 079 numerical annex, including its complete zones, coefficients and equations, is source-locked.",
    citation: locator("attest-crq-decree-079-applicable"),
  },
  {
    id: "warning-professional-validation",
    kind: "warning",
    claim: "Any future manual zone selection must be verified against the adopted instrument by the responsible professional; no map/GIS inference is authorized.",
    citation: locator("attest-acuerdo-019-current-code"),
  },
  {
    id: "warning-fills-site-specific",
    kind: "warning",
    claim: "Construction over existing artificial fills depends on geotechnical studies; no generic municipal spectrum may erase that requirement.",
    citation: locator("attest-pot-fills"),
  },
  {
    id: "warning-building-workflow",
    kind: "warning",
    claim: "NSR-10 harmonization and the delivered 2025 update are currentness context; they do not erase the official historical applicability finding for Decreto 079.",
    citation: locator("attest-crq-decree-079-applicable"),
  },
];
const claimsMatrix = {
  schemaVersion: 1,
  regulatoryStatusMatrix: {
    options: 1,
    hazards: 1,
    fields: 1,
    exactCoveredPairs: 1,
    exactCoveredFieldValues: 1,
    coveragePercent: 100,
  },
  proposedSpectrumMatrix: {
    selectableOptions: 0,
    hazards: 0,
    fields: 0,
    exactCoveredPairs: 0,
    exactCoveredFieldValues: 0,
    coverageStatus: "not-applicable-no-approved-matrix",
  },
  claimCoverage: {
    applicability: { expected: 5, cited: 5, coveragePercent: 100 },
    warnings: { expected: 4, cited: 4, coveragePercent: 100 },
  },
  claims,
};
const formulaInventory = {
  schemaVersion: 1,
  status: "unavailable-blocks-activation",
  proposedProductionFormulas: [],
  coverage: { expected: 0, cited: 0, coverageStatus: "complete-empty-because-no-approved-spectrum" },
  historicalFormulaStatus: {
    exactFormulaCountVerifiedFromLockedPrimarySources: 0,
    issue: "The primary official bytes and complete technical annex for Decreto 079 were not available in the official repositories inspected.",
    resolution: "Do not copy equations from the reference site or third-party mirrors; obtain the primary Decreto 079 technical annex.",
  },
};
const uncertaintyLedger = {
  schemaVersion: 1,
  blocking: true,
  entries: canonical.blockers.map((id) => ({
    id,
    severity: "blocker",
    status: "open",
    issue: ({
      "official-decree-079-bytes-and-technical-annex-not-located": "The official decree bytes and complete adopted technical annex were not located; exact historical zones, coefficients, equations and warnings cannot be attested.",
      "historical-zones-hazards-coefficients-formulas-and-site-specific-rules-unavailable": "The exact historical zone × hazard matrix and its formulas/site-specific branches are unavailable from the primary Decreto 079 package.",
    })[id],
    requiredResolution: "Obtain the primary Decreto 079 source bytes and technical annex from the issuing authority, then rebuild the complete option × hazard × field evidence and numerical oracle.",
  })),
};
const conflictLedger = {
  schemaVersion: 1,
  entries: [
    {
      id: "decree-079-vs-nsr10",
      status: "resolved-for-product",
      officialEvidence: ["legacy-instrument-basis", "harmonization-required"],
      resolution: "Record NSR-10 harmonization as currentness context; it does not negate the official historical applicability of Decreto 079.",
    },
    {
      id: "legacy-model-vs-2025-study",
      status: "resolved-for-product",
      officialEvidence: ["new-study-pending"],
      resolution: "Keep the historical Decreto 079 model and the delivered 2025 update as separate source lineages.",
    },
    {
      id: "reference-site-model-vs-official-chain",
      status: "resolved-for-product",
      officialEvidence: ["harmonization-required", "new-study-pending"],
      resolution: "Treat any reference-site Armenia zone model as UX-only and unsupported for coefficients, formulas or legal status.",
    },
  ],
};
const referenceDifferences = {
  schemaVersion: 1,
  benchmarkUse: "UX only",
  referenceSiteModelApplicability: "comparison-only-no-numeric-import",
  differences: [
    "An active Armenia option on a reference calculator may inform UX comparison but is not a source for coefficients or formulas.",
    "No reference-site zone, hazard, coefficient, formula, warning or return period is copied into this dossier.",
    "Future selection remains manual; maps, coordinates, polygons, address lookup and GIS are out of scope.",
  ],
  nonInference: "No missing primary-source fact was filled from a third-party calculator, Scribd mirror, thesis or article.",
};
const redistribution = {
  schemaVersion: 1,
  decision: "external-only-all-sources",
  committedSourceBytes: false,
  sources: sourceSpecs.map(({ id, officialUrl }) => ({
    sourceDocumentId: id,
    officialUrl,
    decision: "external-only",
    rationale: "No express redistribution license was located on the official delivery page.",
  })),
};
const reviewRecord = {
  schemaVersion: 1,
  authorRole: "research agent R6",
  preparedOn: "2026-07-25",
  independentReview: {
    status: "pending",
    reviewer: null,
    reviewedOn: null,
    requiredReproductions: [
      "four external PDF hashes, byte lengths and page counts; live semantic assertions for two dynamic HTML pages",
      "CRQ Resolution 075 page 3 historical-applicability statement",
      "Acta 153 page 17 harmonization statement",
      "POT Volume 4-B page 81 NSR-98 origin and artificial-fill warning",
      "2025 official delivery paragraph and current decree-index absence audit",
      "negative oracle decision for legacy, delivered-study and building-workflow cases",
    ],
  },
  activationDecision: "blocked-only-by-missing-primary-numerical-annex",
  mergeRecommendation: "evidence may merge after review; do not activate numerical calculation until the Decreto 079 annex is recovered",
};

const artifacts = {
  "data/canonical.json": canonical,
  "evidence/manifest.json": study,
  "evidence/source-locks.json": sourceLocks,
  "evidence/extraction-profile.json": extractionProfile,
  "evidence/extraction-attestation.json": extractionAttestation,
  "evidence/formula-inventory.json": formulaInventory,
  "evidence/claims-matrix.json": claimsMatrix,
  "evidence/uncertainty-ledger.json": uncertaintyLedger,
  "evidence/conflict-ledger.json": conflictLedger,
  "evidence/reference-site-differences.json": referenceDifferences,
  "evidence/redistribution.json": redistribution,
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
if (mismatches.length) throw new Error(`Generated Armenia artifacts differ: ${mismatches.join(", ")}`);
const hashes = Object.fromEntries(
  Object.entries(artifacts).map(([path, value]) => [path, sha256(Buffer.from(deterministicJson(value), "utf8"))]),
);
process.stdout.write(`${checkOnly ? "checked" : "generated"} ${Object.keys(artifacts).length} Armenia artifacts\n${deterministicJson(hashes)}`);
