import { createHash } from "node:crypto";

const deterministicJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function invariant(condition, message) {
  if (!condition) throw new Error(`Medellín currentness attestation failed: ${message}`);
}

export function verifyMedellinCurrentnessAttestation({ attestation, manifest, sourceLocks }) {
  const { payloadSha256, ...payload } = attestation;
  invariant(attestation.schemaVersion === 1, "unsupported schema version");
  invariant(payloadSha256 === sha256(Buffer.from(deterministicJson(payload), "utf8")), "payload hash mismatch");
  invariant(attestation.profile.renderer === "Poppler pdftoppm" && attestation.profile.renderDpi === 144, "render profile changed");
  invariant(attestation.manualReview.status === "complete" && attestation.manualReview.ocrUsed === false, "manual no-OCR review changed");

  const sourceById = new Map(manifest.sources.map((source) => [source.id, source]));
  const lockById = new Map(sourceLocks.locks.map((lock) => [lock.sourceDocumentId, lock]));
  const citationById = new Map(manifest.citations.map((citation) => [citation.id, citation]));
  invariant(attestation.sources.length === 2, "expected two July 2026 sources");
  for (const attestedSource of attestation.sources) {
    const source = sourceById.get(attestedSource.sourceDocumentId);
    const lock = lockById.get(attestedSource.sourceDocumentId);
    invariant(source && lock, `unknown source ${attestedSource.sourceDocumentId}`);
    invariant(source.sha256 === lock.sha256 && source.sha256 === attestedSource.sha256, `source hash mismatch ${source.id}`);
    invariant(source.pageCount === lock.pageCount && source.pageCount === attestedSource.pageCount, `source page count mismatch ${source.id}`);
    invariant(lock.byteLength === attestedSource.byteLength, `source byte length mismatch ${source.id}`);
    invariant(source.redistribution.decision === "external-only", `source ${source.id} must remain external-only`);
  }

  invariant(attestation.regions.length === 3, "expected three July currentness regions");
  for (const region of attestation.regions) {
    const citation = citationById.get(region.citationId);
    invariant(citation?.regionKind === "applicability", `unknown currentness citation ${region.citationId}`);
    invariant(
      citation.sourceDocumentId === region.sourceDocumentId &&
        citation.physicalPage === region.physicalPage &&
        citation.printedPage === region.printedPage &&
        same(citation.rect, region.rect) &&
        same(citation.requiredTokens, region.requiredTokens),
      `citation locator mismatch ${region.citationId}`,
    );
    invariant(region.extractedTokenSha256 === sha256(Buffer.from(citation.extractedToken, "utf8")), `citation transcription mismatch ${region.citationId}`);
    invariant(/^[a-f0-9]{64}$/.test(region.rawRgbCropSha256), `invalid crop hash ${region.citationId}`);
    invariant(region.renderedWidth > 0 && region.renderedHeight > 0, `invalid rendered dimensions ${region.citationId}`);
  }
  return { sources: 2, regions: 3, payloadSha256 };
}
