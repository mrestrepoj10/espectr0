import { createHash } from "node:crypto";

const deterministicJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const expectedTables = new Map([
  ["design", { physicalPage: 155, printedPage: "139", reference: "Tabla 7.5. Coeficientes y curva de diseño" }],
  ["limited-safety", { physicalPage: 156, printedPage: "140", reference: "Tabla 7.6. Coeficientes y curva de seguridad limitada" }],
  ["damage-threshold", { physicalPage: 157, printedPage: "141", reference: "Tabla 7.7. Coeficientes y curva de umbral de daño" }],
]);
const expectedGraphicalOrigins = new Map([
  ["design", {
    physicalPage: 155,
    imageSha256: "7dd74d8775db0bfd65107601b51e0d9ed1a6acaf202badf98e160a85b9078114",
    vectorSha256: "1e331203288aacbe484b9d610d2324de611fd0272e4ea13c215453c2a226e6d6",
    rejectedRect: { left: 0.1538, top: 0.7288, width: 0.0075, height: 0.0102 },
  }],
  ["limited-safety", {
    physicalPage: 156,
    imageSha256: "adfbc15fb9b47fefb51bd90cc01dd8a51c1021e63bc5ac5aa54793bac82799c2",
    vectorSha256: "5e3c26502274bede7505240b7cbe4fabd7f6fa0e3df7cec30394ab9abeb528a9",
    rejectedRect: { left: 0.1538, top: 0.7324, width: 0.0075, height: 0.0102 },
  }],
]);
const expectedWarningLocators = new Map([
  ["warning-professional-zone", "Artículo 6, numeral 5"],
  ["warning-transition", "Artículo 6, numeral 6"],
  ["warning-reclassification", "Artículo 6, numeral 5"],
  ["warning-site-specific", "Artículo 6, numerales 11 y 12"],
  ["warning-resonance", "Artículo 6, numeral 16"],
  ["warning-liquefaction", "Artículo 6, numeral 9"],
  ["warning-minimums", "Artículo 8, numeral 7"],
]);

function overlaps(left, right) {
  return left.left < right.left + right.width &&
    left.left + left.width > right.left &&
    left.top < right.top + right.height &&
    left.top + left.height > right.top;
}

function invariant(condition, message) {
  if (!condition) throw new Error(`Bogotá extraction attestation failed: ${message}`);
}

function uniqueIndex(label, items, key) {
  const index = new Map();
  for (const item of items) {
    const id = key(item);
    invariant(!index.has(id), `duplicate ${label} ${id}`);
    index.set(id, item);
  }
  return index;
}

export function verifyBogotaAttestation({ attestation, extractionProfile, manifest, claims, sourceLocks }) {
  invariant(attestation.schemaVersion === 2, "unsupported schema version");
  const { payloadSha256, ...payload } = attestation;
  invariant(payloadSha256 === sha256(Buffer.from(deterministicJson(payload), "utf8")), "payload hash mismatch");
  invariant(same(attestation.profile, extractionProfile), "extraction profile mismatch");

  const sourceById = uniqueIndex("manifest source", manifest.sources, (source) => source.id);
  const lockById = uniqueIndex("source lock", sourceLocks.locks, (lock) => lock.sourceDocumentId);
  const citationById = uniqueIndex("manifest citation", manifest.citations, (citation) => citation.id);
  const claimById = uniqueIndex("claim", claims.claims, (claim) => claim.id);
  const source = sourceById.get(attestation.source.sourceDocumentId);
  const lock = lockById.get(attestation.source.sourceDocumentId);
  invariant(source && lock, "attested source is not locked in the manifest");
  invariant(attestation.source.sha256 === source.sha256 && attestation.source.sha256 === lock.sha256, "source hash mismatch");
  invariant(attestation.source.byteLength === lock.byteLength, "source byte length mismatch");
  invariant(attestation.source.pageCount === source.pageCount && attestation.source.pageCount === lock.pageCount, "source page count mismatch");

  invariant(attestation.tables.length === 3, "expected exactly three source tables");
  let rowCount = 0;
  let cellCount = 0;
  const attestedCellIds = new Set();
  for (const table of attestation.tables) {
    const expectedTable = expectedTables.get(table.hazardId);
    invariant(expectedTable && table.physicalPage === expectedTable.physicalPage && table.printedPage === expectedTable.printedPage && table.reference === expectedTable.reference, `table ${table.hazardId} authoritative locator mismatch`);
    const tableCitation = citationById.get(table.citationId);
    invariant(tableCitation?.regionKind === "table", `table ${table.hazardId} has no table citation`);
    invariant(tableCitation.sourceDocumentId === attestation.source.sourceDocumentId, `table ${table.hazardId} source mismatch`);
    invariant(tableCitation.physicalPage === table.physicalPage && tableCitation.printedPage === table.printedPage, `table ${table.hazardId} page mismatch`);
    invariant(tableCitation.reference === table.reference && tableCitation.extractedToken === table.caption.token, `table ${table.hazardId} token/reference mismatch`);
    invariant(same(tableCitation.rect, table.rect), `table ${table.hazardId} rectangle mismatch`);
    invariant(table.title.token.startsWith("Coeficientes de ") && table.caption.token.startsWith("Tabla 7."), `table ${table.hazardId} extracted headings mismatch`);
    invariant(table.rows.length === 16, `table ${table.hazardId} row coverage mismatch`);
    if (table.graphicalOrigin) {
      const graphicalOrigin = table.graphicalOrigin;
      const expectedOrigin = expectedGraphicalOrigins.get(table.hazardId);
      invariant(expectedOrigin && table.physicalPage === expectedOrigin.physicalPage, `table ${table.hazardId} has unexpected graphical-origin evidence`);
      invariant(graphicalOrigin.inferenceKind === "graphical-axis-origin", `table ${table.hazardId} origin is not classified as graphical inference`);
      invariant(graphicalOrigin.token === "(g) T(s)" && !graphicalOrigin.requiredTokens.includes("0"), `table ${table.hazardId} graphical-origin evidence cannot be a standalone 0 token`);
      invariant(graphicalOrigin.requiredTokens.includes("(g)") && graphicalOrigin.requiredTokens.includes("T(s)"), `table ${table.hazardId} graphical-origin axis labels are incomplete`);
      invariant(graphicalOrigin.imageRegion.sha256 === expectedOrigin.imageSha256 && graphicalOrigin.imageRegion.pixelWidth === 703 && graphicalOrigin.imageRegion.pixelHeight === 348, `table ${table.hazardId} graphical-origin image attestation mismatch`);
      invariant(graphicalOrigin.vectorEvidence.regionSha256 === expectedOrigin.vectorSha256, `table ${table.hazardId} graphical-origin vector attestation mismatch`);
      invariant(graphicalOrigin.vectorEvidence.alignmentTolerancePoints === 0.5 && Math.abs(graphicalOrigin.vectorEvidence.axisIntersectionPoints.x - graphicalOrigin.vectorEvidence.plateauStartPoints.x) <= 0.5, `table ${table.hazardId} plateau does not begin at the attested axis origin`);
      const rejected = graphicalOrigin.rejectedTextCandidate;
      invariant(rejected.token === "0" && rejected.semanticRole === "A0 parameter subscript, not a period-axis origin" && same(rejected.rect, expectedOrigin.rejectedRect), `table ${table.hazardId} A0 false-candidate guard mismatch`);
      invariant(!overlaps(graphicalOrigin.rect, rejected.rect), `table ${table.hazardId} graphical-origin region overlaps the rejected A0 subscript`);

      const figure = citationById.get(graphicalOrigin.figureCitationId);
      const equation = citationById.get(graphicalOrigin.equationCitationId);
      for (const [kind, citation] of [["figure", figure], ["equation", equation]]) {
        invariant(citation?.regionKind === kind && citation.sourceDocumentId === attestation.source.sourceDocumentId, `table ${table.hazardId} lacks its ${kind} graphical-origin citation`);
        invariant(citation.physicalPage === table.physicalPage && citation.printedPage === table.printedPage, `table ${table.hazardId} ${kind} graphical-origin page mismatch`);
        invariant(citation.extractedToken === graphicalOrigin.token && same(citation.rect, graphicalOrigin.rect), `table ${table.hazardId} ${kind} graphical-origin token/rectangle mismatch`);
      }
      invariant(equation.parentCitationId === figure.id, `table ${table.hazardId} equation is not contained by its figure parent`);

      const derivedStarts = manifest.values.filter((value) => value.hazardId === table.hazardId && value.fieldId === "transition_start");
      invariant(derivedStarts.length === 16, `table ${table.hazardId} graphical-origin derivation coverage mismatch`);
      for (const value of derivedStarts) {
        invariant(value.provenance === "derived" && value.value === 0 && value.unit === "s", `value ${value.id} is not an exact zero-second graphical derivation`);
        invariant(value.citationIds.length === 0 && value.derivedLineage?.formulaCitationId === equation.id && value.derivedLineage.formula === "T(s)", `value ${value.id} lacks figure/equation graphical lineage`);
        invariant(value.derivedLineage.substitution.startsWith("Graphical inference, not a printed-zero transcription:"), `value ${value.id} misclassifies the graphical inference`);
      }
    } else {
      invariant(table.hazardId === "damage-threshold", `table ${table.hazardId} lacks its graphical-origin attestation`);
    }
    for (const row of table.rows) {
      rowCount += 1;
      const rowCitation = citationById.get(row.citationId);
      invariant(rowCitation?.regionKind === "row" && rowCitation.parentCitationId === table.citationId, `row ${row.optionId}/${table.hazardId} ancestry mismatch`);
      invariant(rowCitation.extractedToken === row.token, `row ${row.optionId}/${table.hazardId} token mismatch`);
      invariant(same(rowCitation.rect, row.rect), `row ${row.optionId}/${table.hazardId} rectangle mismatch`);
      const expectedCells = table.hazardId === "damage-threshold" ? 6 : 5;
      invariant(row.cells.length === expectedCells, `row ${row.optionId}/${table.hazardId} cell coverage mismatch`);
      for (const cell of row.cells) {
        cellCount += 1;
        invariant(!attestedCellIds.has(cell.citationId), `duplicate attested cell ${cell.citationId}`);
        attestedCellIds.add(cell.citationId);
        const citation = citationById.get(cell.citationId);
        invariant(citation?.regionKind === "cell" && citation.parentCitationId === row.citationId, `cell ${cell.citationId} ancestry mismatch`);
        invariant(citation.extractedToken === cell.token && citation.normalizedValue === cell.normalizedValue, `cell ${cell.citationId} token/value mismatch`);
        invariant(same(citation.rect, cell.rect), `cell ${cell.citationId} rectangle mismatch`);
      }
    }
  }
  invariant(rowCount === 48 && cellCount === 256, "attested table/row/cell coverage mismatch");
  const directCellIds = manifest.values.filter(({ provenance }) => provenance === "direct-source").flatMap(({ citationIds }) => citationIds);
  invariant(directCellIds.length === 256 && directCellIds.every((id) => attestedCellIds.has(id)), "direct-source cell attestation is incomplete");

  invariant(attestation.claims.length === claims.claims.length, "claim coverage mismatch");
  for (const attestedClaim of attestation.claims) {
    const claim = claimById.get(attestedClaim.claimId);
    const claimLock = lockById.get(attestedClaim.sourceDocumentId);
    invariant(claim && claimLock, `unknown attested claim ${attestedClaim.claimId}`);
    invariant(attestedClaim.sourceSha256 === claimLock.sha256, `claim ${claim.id} source hash mismatch`);
    invariant(attestedClaim.sourceDocumentId === claim.citation.sourceDocumentId && attestedClaim.physicalPage === claim.citation.physicalPage && attestedClaim.printedPage === claim.citation.printedPage, `claim ${claim.id} source/page mismatch`);
    invariant(attestedClaim.reference === claim.citation.reference, `claim ${claim.id} locator mismatch`);
    invariant(attestedClaim.statementSha256 === sha256(Buffer.from(claim.statement.normalize("NFC"), "utf8")), `claim ${claim.id} statement mismatch`);
  }
  for (const [claimId, locator] of expectedWarningLocators) {
    invariant(claimById.get(claimId)?.citation.reference === locator, `claim ${claimId} authoritative locator mismatch`);
  }
  return { tables: 3, rows: rowCount, cells: cellCount, graphicalOrigins: 2, claims: attestation.claims.length, payloadSha256 };
}
