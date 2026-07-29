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
  nsr10: "https://iisee.kenken.go.jp/worldlist/11_Colombia/Colombia%20Titulo%20A-NSR-10-Ver-2017.pdf",
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
  {
    id: "nsr10-title-a-2017", issuingAuthority: "Comisión Asesora Permanente para el Régimen de Construcciones Sismo Resistentes", officialTitle: "NSR-10 Título A — versión consolidada 2017", edition: "2017", revision: null, adoptionInstrument: "Decreto 926 de 2010 y modificaciones", amendmentsAndErrata: [], legalStatus: "active", applicabilityStatus: "conditional", officialUrl: sourceUrl.nsr10, retrievedOn: "2026-07-25", redistribution: { decision: "external-only", rationale: "Se reutiliza la huella del corpus NSR-10 instalado; este dossier no duplica los bytes." }, mediaType: "application/pdf", pageCount: 206, sha256: "47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0", pages: [{ physicalPage: 30, printedPage: "A-16", rotationDegrees: 0, crop: full }, { physicalPage: 42, printedPage: "A-28", rotationDegrees: 0, crop: full }, { physicalPage: 43, printedPage: "A-29", rotationDegrees: 0, crop: full }],
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
  { id: "nsr10-design-probability", sourceDocumentId: "nsr10-title-a-2017", regionKind: "applicability", physicalPage: 30, printedPage: "A-16", reference: "A.2.2.1", rect: rect(40, 520, 570, 610), extractedToken: "probabilidad del diez por ciento de ser excedidos en un lapso de cincuenta años", unit: null, transformation: null, requiredTokens: ["diez por ciento", "cincuenta años"] },
  { id: "nsr10-a.2.5-1", sourceDocumentId: "nsr10-title-a-2017", regionKind: "applicability", physicalPage: 42, printedPage: "A-28", reference: "Tabla A.2.5-1", rect: rect(215, 420, 395, 535), extractedToken: "Valores del coeficiente de importancia I IV 1.50 III 1.25 II 1.10 I 1.00", unit: null, transformation: null, requiredTokens: ["1.50", "1.25", "1.10", "1.00"] },
  { id: "nsr10-a.2.6-1", sourceDocumentId: "nsr10-title-a-2017", regionKind: "applicability", physicalPage: 42, printedPage: "A-28", reference: "Ecuación A.2.6-1", rect: rect(75, 620, 480, 660), extractedToken: "Sa = 1.2 Av Fv I / T (A.2.6-1)", unit: "g", transformation: null, requiredTokens: ["1.2", "A.2.6-1"] },
  { id: "nsr10-a.2.6-2", sourceDocumentId: "nsr10-title-a-2017", regionKind: "applicability", physicalPage: 42, printedPage: "A-28", reference: "Ecuación A.2.6-2", rect: rect(75, 690, 480, 740), extractedToken: "Tc = 0.48 Av Fv / (Aa Fa) (A.2.6-2)", unit: "s", transformation: null, requiredTokens: ["0.48", "A.2.6-2"] },
  { id: "nsr10-a.2.6-3", sourceDocumentId: "nsr10-title-a-2017", regionKind: "applicability", physicalPage: 43, printedPage: "A-29", reference: "Ecuación A.2.6-3", rect: rect(75, 35, 480, 80), extractedToken: "Sa = 2.5 Aa Fa I (A.2.6-3)", unit: "g", transformation: null, requiredTokens: ["2.5", "A.2.6-3"] },
];

for (const zone of zones) {
  const rowId = `row-${zone.id}`;
  citations.push({ id: rowId, sourceDocumentId: "pot-2024-diagnostico-amenazas", regionKind: "row", physicalPage: 111, printedPage: null, reference: `Tabla 27, ${zone.label}`, parentCitationId: "table-27", rect: rect(zone.x[0] - 4, 444, zone.x[1] + 5, 533), extractedToken: `${zone.label} ${zone.tokens.join(" ")}`, unit: null, transformation: null, requiredTokens: [zone.label, ...zone.tokens] });
  fields.forEach(([fieldId, unit, top, bottom], index) => citations.push({ id: `cell-${zone.id}-${fieldId}`, sourceDocumentId: "pot-2024-diagnostico-amenazas", regionKind: "cell", physicalPage: 111, printedPage: null, reference: `Tabla 27, ${zone.label}, ${fieldId}`, parentCitationId: rowId, rect: rect(zone.x[0] - 1, top - 1, zone.x[1] + 1, bottom + 1), extractedToken: zone.tokens[index], normalizedValue: zone.values[fieldId], normalizedNumericValue: zone.values[fieldId], unit, transformation: "decimal parse", requiredTokens: [zone.tokens[index]] }));
}

const values = zones.flatMap((zone) => fields.map(([fieldId, unit]) => ({ id: `value-${zone.id}-design-${fieldId}`, optionId: zone.id, hazardId: "design", fieldId, value: zone.values[fieldId], unit, provenance: "direct-source", citationIds: [`cell-${zone.id}-${fieldId}`], transformation: "decimal parse" })));
const rawRows = zones.map((zone) => ({ id: `raw-${zone.id}-design`, rowKey: `${zone.id}/design`, sourceDocumentId: "pot-2024-diagnostico-amenazas", optionId: zone.id, hazardId: "design", citationIds: fields.map(([fieldId]) => `cell-${zone.id}-${fieldId}`), fields: zone.values }));
const canonicalRows = rawRows.map((row) => ({ ...row, id: row.id.replace("raw-", "canonical-"), sourceRowIds: [row.id] }));

const manifest = { schemaVersion: 1, studyId, title: "Dosquebradas POT 2024 Table 27 — normalized To ≤ T ≤ TL spectrum with NSR-10 lineage", sources, citations, applicabilityCitationIds: ["adoption-2024", "currentness-and-harmonization", "damping-five-percent", "nsr10-design-probability", "nsr10-a.2.5-1", "nsr10-a.2.6-1", "nsr10-a.2.6-2", "nsr10-a.2.6-3"], coverage: { optionIds: zones.map(({ id }) => id), hazardIds: ["design"], fieldIds: fields.map(([id]) => id) }, values, rawRows, canonicalRows, overrides: [] };
const canonical = { schemaVersion: 1, studyId, status: "calculation-supported-between-to-and-tl", municipality: "Dosquebradas", controllingInstrument: "acuerdo-007-2024", technicalSource: "pot-2024-diagnostico-amenazas", calculationAnchor: "nsr10-title-a-2017", selectionMode: "manual-zone-only", dampingRatio: 0.05, hazards: [{ id: "design", label: "Diseño", returnPeriodYears: null, probability: null, dampingRatio: 0.05 }], fields: Object.fromEntries(fields.map(([id, unit]) => [id, { unit }])), zones: zones.map(({ id, label, material }) => ({ id, label, material })), rows: zones.map(({ id, values: rowValues }) => ({ optionId: id, hazardId: "design", fields: rowValues })), localizedLimitations: ["T < To has no attested entrance equation and returns a typed unsupported result.", "T > TL has no attested equation and returns a typed unsupported result.", "The municipal table does not state return period or probability.", "The POT orders adjustment and harmonization with NSR-10.", "Automatic GIS selection is not implemented."], capabilities: { traceabilityViewer: true, municipalSpectrumCalculation: true, supportedInterval: "To <= T <= TL", automaticZoneSelection: false } };
const sourceLocks = { schemaVersion: 1, policy: "External-only; re-fetch exact URLs and verify byte length, page count and SHA-256.", locks: [
  { sourceDocumentId: sources[0].id, officialUrl: sources[0].officialUrl, retrievedOn: sources[0].retrievedOn, byteLength: 266794107, pageCount: 505, sha256: sources[0].sha256, mediaType: sources[0].mediaType, redistributionDecision: "external-only" },
  { sourceDocumentId: sources[1].id, officialUrl: sources[1].officialUrl, retrievedOn: sources[1].retrievedOn, byteLength: 26453877, pageCount: 395, sha256: sources[1].sha256, mediaType: sources[1].mediaType, redistributionDecision: "external-only" },
  { sourceDocumentId: sources[2].id, officialUrl: sources[2].officialUrl, retrievedOn: sources[2].retrievedOn, byteLength: 32411439, pageCount: 228, sha256: sources[2].sha256, mediaType: sources[2].mediaType, redistributionDecision: "external-only" },
  { sourceDocumentId: sources[3].id, officialUrl: sources[3].officialUrl, retrievedOn: sources[3].retrievedOn, byteLength: 3486413, pageCount: 206, sha256: sources[3].sha256, mediaType: sources[3].mediaType, redistributionDecision: "external-only" },
] };
const extractionProfile = { schemaVersion: 1, extractor: { engine: "pdfplumber", version: "0.11.10", parameters: { xTolerance: 2, yTolerance: 2, useTextFlow: false, keepBlankChars: false } }, renderer: { engine: "pypdfium2", purpose: "visual confirmation of scan and embedded figure" }, coordinateSystem: "normalized top-left on 612×792 point pages", normalization: "Unicode NFC; whitespace collapse; decimal parse preserves printed token", table: { sourceDocumentId: sources[1].id, physicalPage: 111, citationId: "table-27", optionCount: 5, fieldCount: 6, directCellCount: 30 } };
const attestPayload = { schemaVersion: 1, externalOnly: true, sourceHashes: Object.fromEntries(sources.map(({ id, sha256: digest }) => [id, digest])), coverage: { tables: 2, optionRows: 5, directCells: 30, formulaRegions: 3, applicabilityClaims: 4, percent: 100 }, table: { citationId: "table-27", rows: zones.map((zone) => ({ optionId: zone.id, rowCitationId: `row-${zone.id}`, cells: fields.map(([fieldId]) => ({ fieldId, citationId: `cell-${zone.id}-${fieldId}`, token: citations.find(({ id }) => id === `cell-${zone.id}-${fieldId}`).extractedToken, value: zone.values[fieldId] })) })) }, visualChecks: [{ citationId: "damping-five-percent", method: "rendered embedded figure inspected at original resolution", observed: "β=5%" }, { citationId: "nsr10-a.2.6-1", method: "rendered NSR-10 pages A-28/A-29 inspected at original resolution", observed: "Equations A.2.6-1, A.2.6-2 and A.2.6-3" }], nonInference: "The attestation binds the 30 printed municipal cells and three printed NSR-10 equations. Av is derived only by algebraically inverting A.2.6-2; it is never assumed equal to Aa. Both T < To and T > TL remain unsupported because their municipal equations are unattested." };
const extractionAttestation = { ...attestPayload, payloadSha256: sha256(Buffer.from(stable(attestPayload))) };
const formulaInventory = { schemaVersion: 1, status: "supported-partial-interval", supportedInterval: "To <= T <= TL", formulas: [
  { id: "derive-av", expression: "Av = Tc × Aa × Fa / (0.48 × Fv)", citationId: "nsr10-a.2.6-2", dependencies: ["tc", "aa", "fa", "fv"] },
  { id: "plateau", condition: "To <= T <= Tc", expression: "Sa = 2.5 × Aa × Fa × I", citationId: "nsr10-a.2.6-3", dependencies: ["aa", "fa", "importanceFactor"] },
  { id: "inverse", condition: "Tc < T <= TL", expression: "Sa = 1.2 × Av × Fv × I / T", citationId: "nsr10-a.2.6-1", dependencies: ["derive-av", "fv", "importanceFactor", "T"] },
], unsupportedIntervals: [{ condition: "T < To", reason: "No entrance equation is attested in the installed municipal package." }, { condition: "T > TL", reason: "No long-period equation is attested in the installed municipal package." }], coverage: { supportedBranches: 2, cited: 2, percent: 100 }, decision: "Calculate the normalized municipal spectrum only for To <= T <= TL; return typed unsupported outside that interval." };
const claimsMatrix = { schemaVersion: 1, directMatrix: { expectedOptionHazardPairs: 5, exactCoveredPairs: 5, expectedFieldValues: 30, exactCoveredFieldValues: 30, directSourceValues: 30, coveragePercent: 100 }, claimCoverage: { applicability: { expected: 2, cited: 2, percent: 100 }, warnings: { expected: 5, cited: 5, percent: 100 } }, claims: [
  { id: "pot-adoption", statement: "Acuerdo 007 de 2024 adopts the ordinary POT revision.", citationId: "adoption-2024" },
  { id: "supports-remain", statement: "The current DTS says the CARDER microzonation technical supports remain in force.", citationId: "currentness-and-harmonization" },
  { id: "outside-map-nsr10", statement: "Areas without microzonation information must apply NSR-10.", citationId: "currentness-and-harmonization" },
  { id: "harmonization", statement: "The municipality must adjust and harmonize the model to NSR-10 within 24 months.", citationId: "currentness-and-harmonization" },
  { id: "damping", statement: "The published design-spectrum figure is labelled β=5%.", citationId: "damping-five-percent" },
  { id: "importance-anchor", statement: "The user-supplied importance factor follows NSR-10 Table A.2.5-1.", citationId: "nsr10-a.2.5-1" },
  { id: "inverse-formula", statement: "The inverse branch uses NSR-10 equation A.2.6-1.", citationId: "nsr10-a.2.6-1" },
  { id: "av-derivation", statement: "Av is derived by algebraically inverting NSR-10 equation A.2.6-2.", citationId: "nsr10-a.2.6-2" },
  { id: "plateau-formula", statement: "The plateau branch uses NSR-10 equation A.2.6-3.", citationId: "nsr10-a.2.6-3" },
  { id: "entrance-gap", statement: "The installed municipal evidence does not attest the T < To entrance branch.", citationId: "table-27" },
] };
const uncertaintyLedger = { schemaVersion: 1, blocking: false, entries: canonical.localizedLimitations.map((issue, index) => ({ id: `limitation-${index + 1}`, severity: "localized-warning", issue, disposition: index === 0 ? "Return typed unsupported only for T < To." : "Expose the supported calculation with this warning." })) };
const conflictLedger = { schemaVersion: 1, entries: [{ id: "remain-versus-harmonize", status: "resolved-for-product", issue: "The same current POT preserves the CARDER supports and orders NSR-10 harmonization.", resolution: "Use direct Table 27 parameters with cited NSR-10 equations and display the harmonization warning." }, { id: "av-defined-not-tabulated", status: "resolved-for-product", issue: "Table 27 omits Av.", resolution: "Derive Av by algebraically inverting cited equation A.2.6-2; never assume Av=Aa." }, { id: "entrance-branch", status: "localized-unsupported", issue: "No T < To entrance equation is attested.", resolution: "Do not invent it; return typed unsupported below the tabulated To." }] };
const referenceDifferences = { schemaVersion: 1, comparison: "Dosquebradas versus EspectroCol (UX/behavior only)", materialDifferences: ["Both expose five Dosquebradas zones with broadly matching descriptions", "The reference site exposes three hazards not demonstrated by the official Table 27 package", "This engine exposes only the official design hazard", "This engine returns typed unsupported below To"], nonInference: "No coefficient, formula, hazard or legal effect is imported from EspectroCol. It is used only to compare discoverability and behavior." };
const redistribution = { schemaVersion: 1, decision: "external-only-all-sources", committedSourceBytes: false, rationale: "No express redistribution authorization was found for the official PDFs.", prohibitedArtifacts: ["source PDFs", "rendered pages", "map/GIS layers"] };
const review = { schemaVersion: 1, authorRole: "engine implementation", preparedOn: "2026-07-29", independentReview: { status: "pending", reviewer: null, reviewedOn: null, scope: ["30-cell transcription", "NSR-10 equation regions", "Av derivation", "To <= T <= TL branch arithmetic"] }, activationDecision: "calculation-supported-only-between-to-and-tl-with-localized-warnings", mergeDecision: "draft-pr-pending-independent-review" };
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
