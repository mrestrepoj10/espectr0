#!/usr/bin/env python3
"""Verify the exact Tomo 6 locator for Cali's historical damage threshold."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from pypdf import PdfReader


HERE = Path(__file__).resolve().parent


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def encoded(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n").encode("utf-8")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def digest_file(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def crop_box(image, rect: dict) -> tuple[int, int, int, int]:
    width, height = image.size
    return (
        round(rect["left"] * width),
        round(rect["top"] * height),
        round((rect["left"] + rect["width"]) * width),
        round((rect["top"] + rect["height"]) * height),
    )


def region(image, region_id: str, rect: dict) -> dict:
    box = crop_box(image, rect)
    return {
        "id": region_id,
        "rect": rect,
        "pixelBox": list(box),
        "rawRgbCropSha256": digest(image.crop(box).tobytes()),
    }


def page_record(reader: PdfReader, page_number: int, metadata: dict, rects: dict[str, dict]) -> dict:
    images = reader.pages[page_number - 1].images
    if len(images) != 1:
        fail(f"physical page {page_number} expected one embedded image, found {len(images)}")
    embedded = images[0]
    image = embedded.image.convert("RGB")
    return {
        "physicalPage": page_number,
        "printedFooter": metadata["printedFooter"],
        "scanMarker": metadata["scanMarker"],
        "imageWidth": image.width,
        "imageHeight": image.height,
        "embeddedImageByteLength": len(embedded.data),
        "embeddedImageSha256": digest(embedded.data),
        "rawRgbImageSha256": digest(image.tobytes()),
        "regions": [region(image, region_id, rect) for region_id, rect in rects.items()],
    }


def fail(message: str) -> None:
    raise SystemExit(f"Cali historical-PDF verification failed: {message}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--attestation", type=Path, default=HERE / "historical-locator-attestation.json")
    args = parser.parse_args()

    locator = load(HERE / "historical-locator.json")
    locks = load(HERE / "source-locks.json")
    lock = next((item for item in locks["locks"] if item["sourceDocumentId"] == locator["sourceDocumentId"]), None)
    if lock is None:
        fail("historical source lock is absent")
    if locator["sourceSha256"] != lock["sha256"]:
        fail("locator source hash differs from source lock")
    if not args.pdf.is_file():
        fail(f"missing PDF: {args.pdf}")
    if args.pdf.stat().st_size != lock["byteLength"] or digest_file(args.pdf) != lock["sha256"]:
        fail("source size or SHA-256 mismatch")

    reader = PdfReader(args.pdf)
    if len(reader.pages) != lock["pageCount"]:
        fail("source page count mismatch")

    claim = locator["claim"]
    rejected = locator["rejectedLocator"]
    positive = page_record(reader, claim["physicalPage"], claim, {
        claim["regionAttestationId"]: claim["rect"],
        "scan-marker-747": claim["scanMarkerRect"],
        "printed-footer-136": claim["printedFooterRect"],
    })
    negative = page_record(reader, rejected["physicalPage"], rejected, {
        "rejected-claim-region-p136": claim["rect"],
        "scan-marker-736": claim["scanMarkerRect"],
        "printed-footer-125": claim["printedFooterRect"],
    })
    positive_claim_hash = positive["regions"][0]["rawRgbCropSha256"]
    negative_claim_hash = negative["regions"][0]["rawRgbCropSha256"]
    if positive_claim_hash == negative_claim_hash:
        fail("physical page 136 unexpectedly matches the physical-page-147 claim region")

    payload = {
        "schemaVersion": 1,
        "source": {
            "sourceDocumentId": locator["sourceDocumentId"],
            "sha256": lock["sha256"],
            "byteLength": lock["byteLength"],
            "pageCount": lock["pageCount"],
        },
        "claim": {
            "claimId": claim["claimId"],
            "extractedToken": claim["extractedToken"],
            "requiredTokens": claim["requiredTokens"],
            "reference": claim["reference"],
        },
        "positiveLocator": positive,
        "rejectedLocator": {**negative, "reason": rejected["reason"]},
        "manualReview": {
            "method": "visual comparison plus deterministic embedded-image region hashes",
            "ocrUsed": False,
            "status": "complete",
            "reviewedOn": "2026-07-25",
        },
    }
    attestation = {**payload, "payloadSha256": digest(encoded(payload))}
    if args.write:
        args.attestation.write_bytes(encoded(attestation))
    elif load(args.attestation) != attestation:
        fail("committed historical locator attestation differs from recomputed source evidence")

    print(
        "verified Cali historical locator: "
        f"positive=p{positive['physicalPage']}/footer-{positive['printedFooter']}/marker-{positive['scanMarker']} "
        f"rejected=p{negative['physicalPage']}/footer-{negative['printedFooter']}/marker-{negative['scanMarker']}"
    )


if __name__ == "__main__":
    main()
