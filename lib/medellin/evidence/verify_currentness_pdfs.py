#!/usr/bin/env python3
"""Reproduce Medellín's July 2026 external-only currentness attestation."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


HERE = Path(__file__).resolve().parent
CITATION_IDS = (
    "applicability-2026-v3-not-adopted",
    "applicability-2026-proposed-separate-act",
    "applicability-2026-proposed-nsr-purpose",
)
SOURCE_ARGUMENTS = {
    "medellin-pot-inputs-2026-v3": "tomo_v3",
    "medellin-pot-draft-agreement-2026-v3": "draft_agreement_v3",
}


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def encoded(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n").encode("utf-8")


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def digest_file(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value)).strip()


def fail(message: str) -> None:
    raise SystemExit(f"Medellín currentness verification failed: {message}")


def render_page(pdftoppm: Path, pdf: Path, physical_page: int, output_prefix: Path, dpi: int) -> Path:
    subprocess.run(
        [
            str(pdftoppm),
            "-f",
            str(physical_page),
            "-l",
            str(physical_page),
            "-singlefile",
            "-png",
            "-r",
            str(dpi),
            str(pdf),
            str(output_prefix),
        ],
        check=True,
        capture_output=True,
    )
    return output_prefix.with_suffix(".png")


def crop_hash(image: Image.Image, rect: dict) -> str:
    rgb = image.convert("RGB")
    width, height = rgb.size
    box = (
        round(rect["left"] * width),
        round(rect["top"] * height),
        round((rect["left"] + rect["width"]) * width),
        round((rect["top"] + rect["height"]) * height),
    )
    return digest_bytes(rgb.crop(box).tobytes())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tomo-v3", type=Path, required=True)
    parser.add_argument("--draft-agreement-v3", type=Path, required=True)
    parser.add_argument("--pdftoppm", type=Path, required=True)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--attestation", type=Path, default=HERE / "currentness-attestation.json")
    args = parser.parse_args()

    manifest = load(HERE / "manifest.json")
    locks = load(HERE / "source-locks.json")
    source_by_id = {source["id"]: source for source in manifest["sources"]}
    lock_by_id = {lock["sourceDocumentId"]: lock for lock in locks["locks"]}
    citation_by_id = {citation["id"]: citation for citation in manifest["citations"]}
    source_paths = {
        "medellin-pot-inputs-2026-v3": args.tomo_v3.resolve(),
        "medellin-pot-draft-agreement-2026-v3": args.draft_agreement_v3.resolve(),
    }
    if not args.pdftoppm.is_file():
        fail(f"missing pdftoppm executable: {args.pdftoppm}")

    readers = {}
    attested_sources = []
    for source_id in SOURCE_ARGUMENTS:
        source = source_by_id[source_id]
        lock = lock_by_id[source_id]
        path = source_paths[source_id]
        if not path.is_file():
            fail(f"missing source file: {path}")
        actual = (digest_file(path), path.stat().st_size)
        expected = (lock["sha256"], lock["byteLength"])
        if actual != expected:
            fail(f"source hash/length mismatch {source_id}: expected={expected} actual={actual}")
        reader = PdfReader(str(path))
        if len(reader.pages) != lock["pageCount"] or source["pageCount"] != lock["pageCount"]:
            fail(f"source page count mismatch {source_id}")
        readers[source_id] = reader
        attested_sources.append(
            {
                "sourceDocumentId": source_id,
                "sha256": lock["sha256"],
                "byteLength": lock["byteLength"],
                "pageCount": lock["pageCount"],
            }
        )

    render_dpi = 144
    regions = []
    with tempfile.TemporaryDirectory(prefix="medellin-currentness-") as directory:
        scratch = Path(directory)
        rendered = {}
        for citation_id in CITATION_IDS:
            citation = citation_by_id[citation_id]
            source_id = citation["sourceDocumentId"]
            page_number = citation["physicalPage"]
            key = (source_id, page_number)
            if key not in rendered:
                output_prefix = scratch / f"{source_id}-{page_number}"
                rendered[key] = render_page(args.pdftoppm.resolve(), source_paths[source_id], page_number, output_prefix, render_dpi)
            page_text = normalize(readers[source_id].pages[page_number - 1].extract_text() or "")
            extracted_token = normalize(citation["extractedToken"])
            if extracted_token not in page_text:
                fail(f"citation transcription absent from source page: {citation_id}")
            for token in citation["requiredTokens"]:
                if normalize(token) not in page_text:
                    fail(f"required token absent from source page: {citation_id}/{token}")
            with Image.open(rendered[key]) as opened:
                image = opened.convert("RGB")
            regions.append(
                {
                    "citationId": citation_id,
                    "sourceDocumentId": source_id,
                    "physicalPage": page_number,
                    "printedPage": citation["printedPage"],
                    "rect": citation["rect"],
                    "requiredTokens": citation["requiredTokens"],
                    "extractedTokenSha256": digest_bytes(citation["extractedToken"].encode("utf-8")),
                    "renderedWidth": image.width,
                    "renderedHeight": image.height,
                    "rawRgbCropSha256": crop_hash(image, citation["rect"]),
                }
            )

    payload = {
        "schemaVersion": 1,
        "profile": {
            "renderer": "Poppler pdftoppm",
            "renderDpi": render_dpi,
            "textExtractor": "pypdf",
            "ocrUsed": False,
            "coordinateSystem": "normalized PDF page coordinates, top-left origin",
            "cropHashing": "sha256(raw RGB bytes)",
        },
        "sources": attested_sources,
        "regions": regions,
        "manualReview": {
            "status": "complete",
            "ocrUsed": False,
            "reviewedOn": "2026-07-25",
            "reviewedPages": [
                "medellin-pot-inputs-2026-v3:202/175",
                "medellin-pot-draft-agreement-2026-v3:1345",
                "medellin-pot-draft-agreement-2026-v3:1346",
            ],
        },
    }
    attestation = {**payload, "payloadSha256": digest_bytes(encoded(payload))}
    if args.write:
        args.attestation.write_bytes(encoded(attestation))
    elif load(args.attestation) != attestation:
        fail("committed attestation differs from recomputed official PDFs")
    print(f"verified Medellín July currentness sources={len(attested_sources)} regions={len(regions)}")


if __name__ == "__main__":
    main()
