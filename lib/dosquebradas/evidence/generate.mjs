import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const full = { left: 0, top: 0, width: 1, height: 1 };
const rect = (x0, top, x1, bottom) => ({
  left: Number((x0 / 612).toFixed(6)),
  top: Number((top / 792).toFixed(6)),
  width: Number(((x1 - x0) / 612).toFixed(6)),
  height: Number(((bottom - top) / 792).toFixed(6)),
});

const studyId = "dosquebradas-microzonation";
const sourceUrl = {
  agreement: "https://pot.dosquebradas.gov.co/repositorio/pot-2024-1/ACUERDO%20007%20DEL%2024%20DE%20ABRIL%20DE%202024%20%E2%80%9CPOR%20EL%20CUAL%20SE%20CUAL%20SE%20ADOPTA%20LA%20REVISI%C3%93N%20ORDINARIA%20DE%20CONTENIDOS%20DE%20LARGO%20PLAZO%20DEL%20PLAN%20DE%20ORDENAMIENTO%20TERRITORIAL%20DEL%20MUNICIPIO%20DE%20DOSQUEBRADAS%E2%80%9D/ACUERDO%20007%20DEL%2024%20DE%20ABRIL%20DE%202024%20%E2%80%9CPOR%20EL%20CUAL%20SE%20CUAL%20SE%20ADOPTA%20LA%20REVISI%C3%93N%20ORDINARIA%20DE%20CONTENIDOS%20DE%20LARGO%20PLAZO%20DEL%20PLAN%20DE%20ORDENAMIENTO%20TERRITORIAL%20DEL%20MUNICIPIO%20DE%20DOSQUEBRADAS%E2%80%9D.pdf",
  diagnosis: "https://pot.dosquebradas.gov.co/repositorio/pot-2024-1/3.Diagnostico/3.1%20AMBIENTAL/3.1.2%20Diagnostico%20Amenazas%20origen%20natural%20e%20instrumentos%20de%20GRD.pdf",
  dts: "https://pot.dosquebradas.gov.co/repositorio/pot-2024-1/4.DTS/4.1%20DTS%20GENERAL.pdf",
};

const sources = [
  {
    id: "acuerdo-007-2024", issuingAuthority: "Concejo Municipal de Dosquebradas", officialTitle: "Acuerdo 007 del 24 de abril de 2024 — revisión ordinaria del POT", edition: "Sancionado el 26 de abril de 2024", revision: null, adoptionInstrument: "Acuerdo Municipal 007 de 2024", amendmentsAndErrata: [], legalStatus: "active", applicabilityStatus: "applicable", officialUrl: sourceUrl.agreement, retrievedOn: "2026-07-25", redistribution: { decision: "external-only", rationale: "No se localizó licencia expresa de redistribución; se conserva solo URL y huella." }, mediaType: "application/pdf", pageCount: 505, sha256: "d32475535e6065d2d99663ce95f046cde066c3c8e9b880e215dcd23ce9e3f047", pages: [{ physicalPage: 1, printedPage: null, rotationDegrees: 0, crop: full }],
  },
  {
    id: "pot-2024-diagnostico-amenazas", issuingAuthority: "Municipio de Dosquebradas", officialTitle: "Diagnóstico de amenazas de origen natural e instrumentos de gestión del riesgo", edition: "Soporte del POT adoptado en 2024", revision: null, adoptionInstrument: "Anexo técnico del Acuerdo 007 de 2024", amendmentsAndErrata: [], legalStatus: "active", applicabilityStatus: "conditional", officialUrl: sourceUrl.diagnosis, retrievedOn: "2026-07-25", redistribution: { decision: "external-only", rationale: "No se localizó licencia expresa de redistribución; se conserva solo URL y huella." }, mediaType: "application/pdf", pageCount: 395, sha256: "cf4608f280c14e430eee91da224c5e61e9601a09103ad3f4b8767d5cd632ad66", pages: [{ physicalPage: 105, printedPage: null, rotationDegrees: 0, crop: full }, { physicalPage: 111, printedPage: null, rotationDegrees: 0, crop: full }, { physicalPage: 112, printedPage: null, rotationDegrees: 0, crop: full }],
  },
  {
    id: "pot-2024-dts-general", issuingAuthority: "Municipio de Dosquebradas", officialTitle: "Documento Técnico de Soporte General", edition: "POT 2024–2035", revision: null, adoptionInstrument: "Anexo técnico del Acuerdo 007 de 2024", amendmentsAndErrata: [], legalStatus: "active", applicabilityStatus: "conditional", officialUrl: sourceUrl.dts, retrievedOn: "2026-07-25", redistribution: { decision: "external-only", rationale: "No se localizó licencia expresa de redistribución; se conserva solo URL y huella." }, mediaType: "application/pdf", pageCount: 228, sha256: "2060d4626bcd2b94af6e2a7401a2a3075b8d750e01397bf18a1d372d6cb24d15", pages: [{ physicalPage: 124, printedPage: "120", rotationDegrees: 0, crop: full }],
  },
];

const zones = [
  { id: "zona-1", label: "Zona 1", material: "Cenizas volcánicas de 10 a 20 m", x: [183.38, 199.337], values: { to: 0.05, tc: 0.5, tl: 2.5, aa: 0.25, fa: 1.60, fv: 1.67 }, tokens: ["0.05", "0.5", "2.5", "0.25", "1.60", "1.67"] },
  { id: "zona-2", label: "Zona 2", material: "Cenizas volcánicas de 8 m sobre suelos residuales", x: [247.49, 263.447], values: { to: 0.05, tc: 0.7, tl: 3.5, aa: 0.25, fa: 1.76, fv: 2.57 }, tokens: ["0.05", "0.7", "3.5", "0.25", "1.76", "2.57"] },
  { id: "zona-3", label: "Zona 3", material: "Depósitos fluviolacustres hasta 70 m", x: [311.45, 327.407], values: { to: 0.05, tc: 0.8, tl: 4, aa: 0.25, fa: 1.76, fv: 2.93 }, tokens: ["0.05", "0.8", "4", "0.25", "1.76", "2.93"] },
  { id: "zona-4", label: "Zona 4", material: "Cenizas volcánicas sobre suelos aluviales", x: [375.43, 391.387], values: { to: 0.05, tc: 0.32, tl: 1.6, aa: 0.25, fa: 1.76, fv: 1.17 }, tokens: ["0.05", "0.32", "1.6", "0.25", "1.76", "1.17"] },
  { id: "zona-5", label: "Zona 5", material: "Llenos antrópicos", x: [439.51, 455.467], values: { to: 0.1, tc: 0.8, tl: 4, aa: 0.25, fa: 1.60, fv: 2.67 }, tokens: ["0.1", "0.8", "4", "0.25", "1.60", "2.67"] },
];
const fields = [
  ["to", "s", 457.36, 466.36], ["tc", "s", 470.32, 479.32], ["tl", "s", 483.16, 492.16],
  ["aa", "g", 496.12, 505.12], ["fa", null, 508.96, 517.96], ["fv", null, 521.92, 530.92],
];

const citations = [
  { id: "adoption-2024", sourceDocumentId: "acuerdo-007-2024", regionKind: "applicability", physicalPage: 1, printedPage: null, reference: "Portada y sanción", rect: full, extractedToken: "ACUERDO NÚMERO 007 Abril 24 de 2024", unit: null, transformation: null, requiredTokens: ["007", "2024"] },
  { id: "currentness-and-harmonization", sourceDocumentId: "pot-2024-dts-general", regionKind: "applicability", physicalPage: 124, printedPage: "120", reference: "Sección 6.2.4.3", rect: rect(70, 280, 545, 720), extractedToken: "permanecen vigentes ... plazo no mayor a 24 meses ... ajustar y armonizar ... según los requerimientos de la NSR-10", unit: null, transformation: null, requiredTokens: ["permanecen vigentes", "24 meses", "NSR-10"] },
  { id: "damping-five-percent", sourceDocumentId: "pot-2024-diagnostico-amenazas", regionKind: "applicability", physicalPage: 112, printedPage: null, reference: "Figura 16, rótulo β=5%", rect: rect(280, 100, 530, 390), extractedToken: "β=5%", unit: null, transformation: null, requiredTokens: ["5%"] },
  { id: "table-27", sourceDocumentId: "pot-2024-diagnostico-amenazas", regionKind: "table", physicalPage: 111, printedPage: null, reference: "Tabla 27. Coeficientes Espectrales de Diseño para Dosquebradas", rect: rect(110, 440, 475, 535), extractedToken: "Variables Zona 1 Zona 2 Zona 3 Zona 4 Zona 5 To Tc TL Aa Fa Fv", unit: null, transformation: null, requiredTokens: ["Variables", "Zona 1", "Fv"] },
];

for (const zone of zones) {
  const rowId = `row-${zone.id}`;
  citations.push({ id: rowId, sourceDocumentId: "pot-2024-diagnostico-amenazas", regionKind: "row", physicalPage: 111, printedPage: null, reference: `Tabla 27, ${zone.label}`, parentCitationId: "table-27", rect: rect(zone.x[0] - 4, 444, zone.x[1] + 5, 533), extractedToken: `${zone.label} ${zone.tokens.join(" ")}`, unit: null, transformation: null, requiredTokens: [zone.label, ...zone.tokens] });
  fields.forEach(([fieldId, unit, top, bottom], index) => citations.push({ id: `cell-${zone.id}-${fieldId}`, sourceDocumentId: "pot-2024-diagnostico-amenazas", regionKind: "cell", physicalPage: 111, printedPage: null, reference: `Tabla 27, ${zone.label}, ${fieldId}`, parentCitationId: rowId, rect: rect(zone.x[0] - 1, top - 1, zone.x[1] + 1, bottom + 1), extractedToken: zone.tokens[index], normalizedValue: zone.values[fieldId], normalizedNumericValue: zone.values[fieldId], unit, transformation: "decimal parse", requiredTokens: [zone.tokens[index]] }));
}

const values = zones.flatMap((zone) => fields.map(([fieldId, unit]) => ({ id: `value-${zone.id}-design-${fieldId}`, optionId: zone.id, hazardId: "design", fieldId, value: zone.values[fieldId], unit, provenance: "direct-source", citationIds: [`cell-${zone.id}-${fieldId}`], transformation: "decimal parse" })));
const rawRows = zones.map((zone) => ({ id: `raw-${zone.id}-design`, rowKey: `${zone.id}/design`, sourceDocumentId: "pot-2024-diagnostico-amenazas", optionId: zone.id, hazardId: "design", citationIds: fields.map(([fieldId]) => `cell-${zone.id}-${fieldId}`), fields: zone.values }));
const canonicalRows = rawRows.map((row) => ({ ...row, id: row.id.replace("raw-", "canonical-"), sourceRowIds: [row.id] }));

const manifest = { schemaVersion: 1, studyId, title: "Dosquebradas POT 2024 — direct spectral table, activation blocked", sources, citations, applicabilityCitationIds: ["adoption-2024", "currentness-and-harmonization", "damping-five-percent"], coverage: { optionIds: zones.map(({ id }) => id), hazardIds: ["design"], fieldIds: fields.map(([id]) => id) }, values, rawRows, canonicalRows, overrides: [] };
const canonical = { schemaVersion: 1, studyId, status: "research-only-activation-blocked", municipality: "Dosquebradas", controllingInstrument: "acuerdo-007-2024", technicalSource: "pot-2024-diagnostico-amenazas", selectionMode: "manual-zone-only", dampingRatio: 0.05, hazards: [{ id: "design", label: "Diseño", returnPeriodYears: null, probability: null, dampingRatio: 0.05 }], fields: Object.fromEntries(fields.map(([id, unit]) => [id, { unit }])), zones: zones.map(({ id, label, material }) => ({ id, label, material })), rows: zones.map(({ id, values: rowValues }) => ({ optionId: id, hazardId: "design", fields: rowValues })), blockers: ["No adopted formula or branch inclusivity was found in the official POT package.", "Av is defined but not tabulated in Table 27.", "The POT requires NSR-10 adjustment and harmonization within 24 months.", "Return period/probability is not stated beside Table 27.", "No automatic GIS selection is authorized."], capabilities: { traceabilityViewer: true, municipalSpectrumCalculation: false, automaticZoneSelection: false } };
const sourceLocks = { schemaVersion: 1, policy: "External-only; re-fetch exact URLs and verify byte length, page count and SHA-256.", locks: [
  { sourceDocumentId: sources[0].id, officialUrl: sources[0].officialUrl, retrievedOn: sources[0].retrievedOn, byteLength: 266794107, pageCount: 505, sha256: sources[0].sha256, mediaType: sources[0].mediaType, redistributionDecision: "external-only" },
  { sourceDocumentId: sources[1].id, officialUrl: sources[1].officialUrl, retrievedOn: sources[1].retrievedOn, byteLength: 26453877, pageCount: 395, sha256: sources[1].sha256, mediaType: sources[1].mediaType, redistributionDecision: "external-only" },
  { sourceDocumentId: sources[2].id, officialUrl: sources[2].officialUrl, retrievedOn: sources[2].retrievedOn, byteLength: 32411439, pageCount: 228, sha256: sources[2].sha256, mediaType: sources[2].mediaType, redistributionDecision: "external-only" },
] };
const extractionProfile = { schemaVersion: 1, extractor: { engine: "pdfplumber", version: "0.11.10", parameters: { xTolerance: 2, yTolerance: 2, useTextFlow: false, keepBlankChars: false } }, renderer: { engine: "pypdfium2", purpose: "visual confirmation of scan and embedded figure" }, coordinateSystem: "normalized top-left on 612×792 point pages", normalization: "Unicode NFC; whitespace collapse; decimal parse preserves printed token", table: { sourceDocumentId: sources[1].id, physicalPage: 111, citationId: "table-27", optionCount: 5, fieldCount: 6, directCellCount: 30 } };
const attestPayload = { schemaVersion: 1, externalOnly: true, sourceHashes: Object.fromEntries(sources.map(({ id, sha256: digest }) => [id, digest])), coverage: { tables: 1, optionRows: 5, directCells: 30, applicabilityClaims: 3, percent: 100 }, table: { citationId: "table-27", rows: zones.map((zone) => ({ optionId: zone.id, rowCitationId: `row-${zone.id}`, cells: fields.map(([fieldId]) => ({ fieldId, citationId: `cell-${zone.id}-${fieldId}`, token: citations.find(({ id }) => id === `cell-${zone.id}-${fieldId}`).extractedToken, value: zone.values[fieldId] })) })) }, visualChecks: [{ citationId: "damping-five-percent", method: "rendered embedded figure inspected at original resolution", observed: "β=5%" }], nonInference: "The attestation binds only printed table values and the printed damping label. It does not infer Av, return period, formula or branch policy." };
const extractionAttestation = { ...attestPayload, payloadSha256: sha256(Buffer.from(stable(attestPayload))) };
const formulaInventory = { schemaVersion: 1, status: "unavailable-blocks-activation", proposedProductionFormulas: [], unresolvedRequiredInputs: ["Av", "piecewise equations", "branch inclusivity", "importance-factor placement"], coverage: { expectedForActivation: 4, cited: 0, percent: 0 }, decision: "Table 27 may be displayed with traceability but cannot drive a municipal spectrum calculator." };
const claimsMatrix = { schemaVersion: 1, directMatrix: { expectedOptionHazardPairs: 5, exactCoveredPairs: 5, expectedFieldValues: 30, exactCoveredFieldValues: 30, directSourceValues: 30, coveragePercent: 100 }, claimCoverage: { applicability: { expected: 2, cited: 2, percent: 100 }, warnings: { expected: 5, cited: 5, percent: 100 } }, claims: [
  { id: "pot-adoption", statement: "Acuerdo 007 de 2024 adopts the ordinary POT revision.", citationId: "adoption-2024" },
  { id: "supports-remain", statement: "The current DTS says the CARDER microzonation technical supports remain in force.", citationId: "currentness-and-harmonization" },
  { id: "outside-map-nsr10", statement: "Areas without microzonation information must apply NSR-10.", citationId: "currentness-and-harmonization" },
  { id: "harmonization", statement: "The municipality must adjust and harmonize the model to NSR-10 within 24 months.", citationId: "currentness-and-harmonization" },
  { id: "damping", statement: "The published design-spectrum figure is labelled β=5%.", citationId: "damping-five-percent" },
  { id: "formula-gap", statement: "No formula is asserted by this dossier; Table 27 alone is insufficient for calculation.", citationId: "table-27" },
] };
const uncertaintyLedger = { schemaVersion: 1, blocking: true, entries: canonical.blockers.map((issue, index) => ({ id: `blocker-${index + 1}`, severity: "blocker", issue, disposition: "No activation until an official primary source resolves this item." })) };
const conflictLedger = { schemaVersion: 1, entries: [{ id: "remain-versus-harmonize", status: "resolved-for-product", issue: "The same current POT preserves the CARDER supports and orders NSR-10 harmonization.", resolution: "Preserve direct table provenance; block calculation and activation." }, { id: "av-defined-not-tabulated", status: "resolved-for-product", issue: "Page 112 defines Av while Table 27 omits its value.", resolution: "Do not derive or assume Av." }, { id: "legacy-formulas", status: "resolved-for-product", issue: "Unofficial copies may show legacy formulas.", resolution: "Do not use secondary mirrors for normative calculation." }] };
const referenceDifferences = { schemaVersion: 1, comparison: "Dosquebradas versus any reference municipality", materialDifferences: ["Distinct 2024 POT adoption chain", "Five local zones and six tabulated fields", "Explicit pending NSR-10 harmonization", "Formula and Av gap"], nonInference: "No formula, coefficient, warning or legal effect from Pereira, Santa Rosa de Cabal, Bogotá or NSR-10 is imported." };
const redistribution = { schemaVersion: 1, decision: "external-only-all-sources", committedSourceBytes: false, rationale: "No express redistribution authorization was found for the official PDFs.", prohibitedArtifacts: ["source PDFs", "rendered pages", "map/GIS layers"] };
const review = { schemaVersion: 1, authorRole: "research agent R7", preparedOn: "2026-07-25", independentReview: { status: "pending", reviewer: null, reviewedOn: null, scope: ["source re-fetch", "30-cell transcription", "adoption/currentness", "formula and Av gaps"] }, activationDecision: "blocked-missing-adopted-complete-calculation-model", mergeDecision: "no-merge-for-production-activation" };
const artifacts = { "data/canonical.json": canonical, "evidence/manifest.json": manifest, "evidence/source-locks.json": sourceLocks, "evidence/extraction-profile.json": extractionProfile, "evidence/extraction-attestation.json": extractionAttestation, "evidence/formula-inventory.json": formulaInventory, "evidence/claims-matrix.json": claimsMatrix, "evidence/uncertainty-ledger.json": uncertaintyLedger, "evidence/conflict-ledger.json": conflictLedger, "evidence/reference-site-differences.json": referenceDifferences, "evidence/redistribution.json": redistribution, "evidence/review-record.json": review };

const check = process.argv.includes("--check");
const mismatches = [];
for (const [relative, value] of Object.entries(artifacts)) {
  const path = resolve(root, relative); const bytes = stable(value);
  if (check) { if (await readFile(path, "utf8").catch(() => null) !== bytes) mismatches.push(relative); }
  else { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, "utf8"); }
}
if (mismatches.length) throw new Error(`Generated Dosquebradas artifacts differ: ${mismatches.join(", ")}`);
process.stdout.write(`${check ? "checked" : "generated"} ${Object.keys(artifacts).length} Dosquebradas artifacts\n`);
