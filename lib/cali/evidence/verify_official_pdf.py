#!/usr/bin/env python3
"""Create or verify Cali's deterministic attestation from a local official decree PDF."""

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


def crop_hash(image, rect: dict) -> str:
    width, height = image.size
    box = (
        round(rect["left"] * width),
        round(rect["top"] * height),
        round((rect["left"] + rect["width"]) * width),
        round((rect["top"] + rect["height"]) * height),
    )
    return digest(image.convert("RGB").crop(box).tobytes())


def fail(message: str) -> None:
    raise SystemExit(f"Cali official-PDF verification failed: {message}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--attestation", type=Path, default=HERE / "extraction-attestation.json")
    args = parser.parse_args()

    manifest = load(HERE / "manifest.json")
    claims = load(HERE / "claims-matrix.json")
    locks = load(HERE / "source-locks.json")
    profile = load(HERE / "extraction-profile.json")
    canonical = load(HERE.parent / "data" / "canonical.json")
    source_id = profile["sourceDocumentId"]
    source = next(item for item in manifest["sources"] if item["id"] == source_id)
    lock = next(item for item in locks["locks"] if item["sourceDocumentId"] == source_id)
    if not args.pdf.is_file():
        fail(f"missing PDF: {args.pdf}")
    if args.pdf.stat().st_size != lock["byteLength"] or digest_file(args.pdf) != lock["sha256"]:
        fail("source size or SHA-256 mismatch")

    reader = PdfReader(args.pdf)
    if len(reader.pages) != lock["pageCount"]:
        fail("source page count mismatch")
    cell_citations = [item for item in manifest["citations"] if item["regionKind"] == "cell"]
    minimum = canonical["ancillary"]["siteSpecificDesignMinimum"]
    pga = canonical["ancillary"]["surfacePgaDesign"]
    page_numbers = sorted({item["physicalPage"] for item in cell_citations} | {minimum["physicalPage"], pga["physicalPage"]})
    page_data = {}
    pages = []
    for page_number in page_numbers:
        images = reader.pages[page_number - 1].images
        if len(images) != 1:
            fail(f"page {page_number} expected one embedded image, found {len(images)}")
        embedded = images[0]
        image = embedded.image.convert("RGB")
        expected_size = (profile["pageImage"]["width"], profile["pageImage"]["height"])
        if image.size != expected_size:
            fail(f"page {page_number} image size mismatch")
        page_data[page_number] = (embedded, image)
        pages.append({
            "physicalPage": page_number,
            "embeddedImageByteLength": len(embedded.data),
            "embeddedImageSha256": digest(embedded.data),
        })

    cells = []
    for citation in cell_citations:
        _, image = page_data[citation["physicalPage"]]
        cells.append({
            "scope": "hazard-matrix",
            "citationId": citation["id"],
            "physicalPage": citation["physicalPage"],
            "rect": citation["rect"],
            "token": citation["extractedToken"],
            "normalizedValue": citation["normalizedValue"],
            "rawRgbCropSha256": crop_hash(image, citation["rect"]),
        })
    minimum_image = reader.pages[minimum["physicalPage"] - 1].images[0].image.convert("RGB")
    for row in minimum["rows"]:
        for cell in row["cells"]:
            cells.append({
                "scope": "site-specific-design-minimum",
                "citationId": cell["id"],
                "physicalPage": minimum["physicalPage"],
                "rect": cell["rect"],
                "token": cell["token"],
                "normalizedValue": cell["normalizedValue"],
                "rawRgbCropSha256": crop_hash(minimum_image, cell["rect"]),
            })
    pga_image = reader.pages[pga["physicalPage"] - 1].images[0].image.convert("RGB")
    for row in pga["rows"]:
        cell = row["cell"]
        cells.append({
            "scope": "surface-pga-design",
            "citationId": cell["id"],
            "physicalPage": pga["physicalPage"],
            "rect": cell["rect"],
            "token": cell["token"],
            "normalizedValue": cell["normalizedValue"],
            "rawRgbCropSha256": crop_hash(pga_image, cell["rect"]),
        })

    lock_by_id = {item["sourceDocumentId"]: item for item in locks["locks"]}
    attested_claims = []
    for claim in claims["claims"]:
        citation = claim["citation"]
        claim_lock = lock_by_id[citation["sourceDocumentId"]]
        attested_claims.append({
            "claimId": claim["id"],
            "sourceDocumentId": citation["sourceDocumentId"],
            "sourceSha256": claim_lock["sha256"],
            "physicalPage": citation["physicalPage"],
            "printedPage": citation["printedPage"],
            "reference": citation["reference"],
            "statementSha256": digest(claim["statement"].encode("utf-8")),
        })

    payload = {
        "schemaVersion": 1,
        "profile": profile,
        "source": {"sourceDocumentId": source_id, "sha256": source["sha256"], "byteLength": lock["byteLength"], "pageCount": source["pageCount"]},
        "pages": pages,
        "cells": cells,
        "claims": attested_claims,
        "manualReview": {"method": "double-entry visual transcription", "ocrUsed": False, "status": "complete", "reviewedOn": "2026-07-25"},
    }
    attestation = {**payload, "payloadSha256": digest(encoded(payload))}
    if args.write:
        args.attestation.write_bytes(encoded(attestation))
    else:
        if load(args.attestation) != attestation:
            fail("committed attestation differs from recomputed source evidence")
    unique_regions = len({(cell["physicalPage"], json.dumps(cell["rect"], sort_keys=True)) for cell in cells})
    print(f"verified Cali decree attestation: pages={len(pages)} cells={len(cells)} distinct-regions={unique_regions} claims={len(attested_claims)}")


if __name__ == "__main__":
    main()
