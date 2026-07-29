#!/usr/bin/env python3
"""Reproduce the external-only Manizales source and crop attestations."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path

from PIL import Image
from pypdf import PdfReader

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def crop_hash(image_path: Path, rect: dict) -> str:
    with Image.open(image_path) as source:
        image = source.convert("RGB")
    width, height = image.size
    left = round(rect["left"] * width)
    top = round(rect["top"] * height)
    right = round((rect["left"] + rect["width"]) * width)
    bottom = round((rect["top"] + rect["height"]) * height)
    crop = image.crop((left, top, right, bottom))
    encoded = BytesIO()
    crop.save(encoded, format="PNG", optimize=False, compress_level=9)
    return hashlib.sha256(encoded.getvalue()).hexdigest()


def render_page(pdftoppm: Path, pdf: Path, page: int, output_prefix: Path, dpi: int) -> Path:
    subprocess.run(
        [str(pdftoppm), "-f", str(page), "-l", str(page), "-singlefile", "-png", "-r", str(dpi), str(pdf), str(output_prefix)],
        check=True,
        capture_output=True,
    )
    return output_prefix.with_suffix(".png")


def verify_source(path: Path, source: dict, lock: dict) -> None:
    if not path.is_file():
        raise SystemExit(f"Missing source file: {path}")
    actual_hash = sha256(path)
    actual_pages = len(PdfReader(str(path)).pages)
    actual_bytes = path.stat().st_size
    expected = (source["sha256"], source["pageCount"], lock["byteLength"])
    actual = (actual_hash, actual_pages, actual_bytes)
    if actual != expected:
        raise SystemExit(f"Source lock mismatch {source['id']}: expected={expected} actual={actual}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original", type=Path, required=True)
    parser.add_argument("--harmonization", type=Path, required=True)
    parser.add_argument("--presentation", type=Path, required=True)
    parser.add_argument("--article", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--pot", type=Path, required=True)
    parser.add_argument("--pdftoppm", type=Path, required=True)
    args = parser.parse_args()

    manifest = load(HERE / "manifest.json")
    locks_file = load(HERE / "source-locks.json")
    attestation = load(HERE / "extraction-attestation.json")
    profile = load(HERE / "extraction-profile.json")
    sources = {source["id"]: source for source in manifest["sources"]}
    locks = {lock["sourceDocumentId"]: lock for lock in locks_file["locks"]}
    paths = {
        "manizales-uniandes-2002": args.original.resolve(),
        "manizales-harmonization-2014": args.harmonization.resolve(),
        "manizales-harmonization-presentation-2014": args.presentation.resolve(),
        "manizales-update-2015": args.article.resolve(),
        "manizales-management-report-2016-2019": args.report.resolve(),
        "manizales-pot-status-2025": args.pot.resolve(),
    }
    for source_id, path in paths.items():
        verify_source(path, sources[source_id], locks[source_id])

    with tempfile.TemporaryDirectory(prefix="manizales-attestation-") as directory:
        scratch = Path(directory)
        rendered = {}
        for region in attestation["regions"]:
            key = (region["sourceDocumentId"], region["physicalPage"])
            if key not in rendered:
                prefix = scratch / f"{key[0]}-{key[1]}"
                rendered[key] = render_page(args.pdftoppm.resolve(), paths[key[0]], key[1], prefix, profile["renderDpi"])
            actual = crop_hash(rendered[key], region["rect"])
            if actual != region["pngCropSha256"]:
                raise SystemExit(f"Crop mismatch {region['citationId']}: expected={region['pngCropSha256']} actual={actual}")

    print(f"verified Manizales external-only PDFs={len(paths)} regions={len(attestation['regions'])}")


if __name__ == "__main__":
    main()
