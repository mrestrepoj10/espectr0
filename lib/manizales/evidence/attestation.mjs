import { createHash } from "node:crypto";

const encode = (value) => `${JSON.stringify(value, null, 2)}\n`;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function invariant(condition, message) {
  if (!condition) throw new Error(`Manizales extraction attestation failed: ${message}`);
}

export function verifyManizalesAttestation({ attestation, profile, manifest, sourceLocks }) {
  const { payloadSha256, ...payload } = attestation;
  invariant(payloadSha256 === hash(Buffer.from(encode(payload), "utf8")), "payload hash mismatch");
  invariant(same(attestation.profile, profile), "profile mismatch");
  invariant(attestation.manualReview.status === "complete" && attestation.manualReview.ocrUsed === false, "manual visual review changed");
  const locks = new Map(sourceLocks.locks.map((lock) => [lock.sourceDocumentId, lock]));
  const sources = new Map(manifest.sources.map((source) => [source.id, source]));
  invariant(attestation.sourceLocks.length === manifest.sources.length, "source attestation coverage mismatch");
  for (const item of attestation.sourceLocks) {
    const lock = locks.get(item.sourceDocumentId);
    const source = sources.get(item.sourceDocumentId);
    invariant(lock && source, `unknown source ${item.sourceDocumentId}`);
    invariant(item.sha256 === lock.sha256 && item.sha256 === source.sha256, `source hash mismatch ${item.sourceDocumentId}`);
    invariant(item.pageCount === lock.pageCount && item.byteLength === lock.byteLength, `source size mismatch ${item.sourceDocumentId}`);
  }
  const citations = new Map(manifest.citations.map((item) => [item.id, item]));
  invariant(attestation.regions.length === manifest.citations.length, "citation region coverage mismatch");
  for (const region of attestation.regions) {
    const citation = citations.get(region.citationId);
    invariant(citation, `unknown citation ${region.citationId}`);
    invariant(region.sourceDocumentId === citation.sourceDocumentId && region.physicalPage === citation.physicalPage && same(region.rect, citation.rect), `locator mismatch ${region.citationId}`);
    invariant(region.tokenSha256 === hash(Buffer.from(citation.extractedToken, "utf8")), `token hash mismatch ${region.citationId}`);
    invariant(/^[a-f0-9]{64}$/.test(region.pngCropSha256), `invalid crop hash ${region.citationId}`);
  }
  return { sources: attestation.sourceLocks.length, regions: attestation.regions.length, payloadSha256 };
}
