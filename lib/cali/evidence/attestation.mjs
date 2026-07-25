import { createHash } from "node:crypto";

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function invariant(condition, message) {
  if (!condition) throw new Error(`Cali extraction attestation failed: ${message}`);
}

const index = (items, key) => {
  const result = new Map();
  for (const item of items) {
    const id = key(item);
    invariant(!result.has(id), `duplicate ${id}`);
    result.set(id, item);
  }
  return result;
};

export function verifyCaliAttestation({ attestation, extractionProfile, manifest, canonical, claims, sourceLocks }) {
  const { payloadSha256, ...payload } = attestation;
  invariant(attestation.schemaVersion === 1, "unsupported schema version");
  invariant(payloadSha256 === hash(Buffer.from(json(payload), "utf8")), "payload hash mismatch");
  invariant(same(attestation.profile, extractionProfile), "profile mismatch");
  invariant(attestation.manualReview.ocrUsed === false && attestation.manualReview.status === "complete", "manual no-OCR review changed");

  const sourceById = index(manifest.sources, (item) => item.id);
  const lockById = index(sourceLocks.locks, (item) => item.sourceDocumentId);
  const citationById = index(manifest.citations, (item) => item.id);
  const claimById = index(claims.claims, (item) => item.id);
  const source = sourceById.get(attestation.source.sourceDocumentId);
  const lock = lockById.get(attestation.source.sourceDocumentId);
  invariant(source && lock, "attested source is not locked");
  invariant(source.sha256 === attestation.source.sha256 && lock.sha256 === source.sha256, "source SHA mismatch");
  invariant(source.pageCount === attestation.source.pageCount && lock.pageCount === source.pageCount, "page count mismatch");
  invariant(lock.byteLength === attestation.source.byteLength, "byte length mismatch");
  invariant(attestation.pages.length === 5, "expected five coefficient/PGA-table pages");
  invariant(attestation.pages.every((page) => /^[a-f0-9]{64}$/.test(page.embeddedImageSha256) && page.embeddedImageByteLength > 0), "invalid page image locks");

  const directCells = manifest.values.flatMap((value) => value.provenance === "direct-source" ? value.citationIds : []);
  const attestedCellById = index(attestation.cells, (item) => item.citationId);
  invariant(directCells.length === 156 && attestation.cells.length === 218, "hazard matrix or ancillary coverage changed");
  for (const citationId of directCells) {
    const citation = citationById.get(citationId);
    const cell = attestedCellById.get(citationId);
    invariant(citation?.regionKind === "cell" && cell?.scope === "hazard-matrix", `missing matrix cell ${citationId}`);
    invariant(citation.physicalPage === cell.physicalPage && same(citation.rect, cell.rect), `cell locator mismatch ${citationId}`);
    invariant(citation.extractedToken === cell.token && citation.normalizedValue === cell.normalizedValue, `cell token/value mismatch ${citationId}`);
    invariant(/^[a-f0-9]{64}$/.test(cell.rawRgbCropSha256), `cell crop hash invalid ${citationId}`);
  }
  const ancillaryCells = canonical.ancillary.siteSpecificDesignMinimum.rows.flatMap((row) => row.cells);
  invariant(ancillaryCells.length === 52, "site-specific design minimum must have 52 attested coefficients");
  for (const expected of ancillaryCells) {
    const cell = attestedCellById.get(expected.id);
    invariant(cell?.scope === "site-specific-design-minimum", `missing ancillary minimum cell ${expected.id}`);
    invariant(same(cell.rect, expected.rect) && cell.token === expected.token && cell.normalizedValue === expected.normalizedValue, `ancillary minimum cell mismatch ${expected.id}`);
    invariant(/^[a-f0-9]{64}$/.test(cell.rawRgbCropSha256), `ancillary crop hash invalid ${expected.id}`);
  }
  const pgaCells = canonical.ancillary.surfacePgaDesign.rows.map((row) => row.cell);
  invariant(pgaCells.length === 10, "surface PGA table must have ten attested values");
  for (const expected of pgaCells) {
    const cell = attestedCellById.get(expected.id);
    invariant(cell?.scope === "surface-pga-design", `missing PGA cell ${expected.id}`);
    invariant(same(cell.rect, expected.rect) && cell.token === expected.token && cell.normalizedValue === expected.normalizedValue, `PGA cell mismatch ${expected.id}`);
    invariant(/^[a-f0-9]{64}$/.test(cell.rawRgbCropSha256), `PGA crop hash invalid ${expected.id}`);
  }
  const distinctRegions = new Set(attestation.cells.map((cell) => `${cell.physicalPage}/${JSON.stringify(cell.rect)}`));
  invariant(distinctRegions.size === 206, "distinct source-cell coverage changed");

  invariant(attestation.claims.length === claims.claims.length, "claim coverage mismatch");
  for (const item of attestation.claims) {
    const claim = claimById.get(item.claimId);
    const claimLock = lockById.get(item.sourceDocumentId);
    invariant(claim && claimLock, `unknown claim ${item.claimId}`);
    invariant(item.sourceSha256 === claimLock.sha256, `claim source lock mismatch ${item.claimId}`);
    invariant(item.statementSha256 === hash(Buffer.from(claim.statement, "utf8")), `claim statement mismatch ${item.claimId}`);
    invariant(item.sourceDocumentId === claim.citation.sourceDocumentId && item.physicalPage === claim.citation.physicalPage && item.printedPage === claim.citation.printedPage && item.reference === claim.citation.reference, `claim locator mismatch ${item.claimId}`);
  }
  return { pages: 5, matrixCells: 156, ancillaryMinimumCells: 52, ancillaryPgaCells: 10, cells: 218, distinctRegions: 206, claims: attestation.claims.length, payloadSha256 };
}
