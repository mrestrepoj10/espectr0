"""Offline verification for the external-only Armenia primary sources.

Supply fresh downloads from the official URLs. The verifier fails closed on PDF
bytes/page counts and on live full-document HTML semantics. The two official HTML
pages are dynamic, so their historical hashes are observations rather than locks.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

import pdfplumber
import pypdf

HERE = Path(__file__).resolve().parent
LOCKS = json.loads((HERE / "source-locks.json").read_text(encoding="utf-8"))
ATTESTATION = json.loads((HERE / "extraction-attestation.json").read_text(encoding="utf-8"))


def normalize(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).split())


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_text(path: Path, media_type: str, page: int) -> str:
    if media_type == "text/html":
        return path.read_text(encoding="utf-8")
    with pdfplumber.open(path) as document:
        return document.pages[page - 1].extract_text() or ""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--crq-resolution", type=Path, required=True)
    parser.add_argument("--acta153", type=Path, required=True)
    parser.add_argument("--acuerdo019", type=Path, required=True)
    parser.add_argument("--pot-volume", type=Path, required=True)
    parser.add_argument("--delivery-html", type=Path, required=True)
    parser.add_argument("--decree-index-html", type=Path, required=True)
    args = parser.parse_args()
    paths = {
        "crq-resolution-075-2006": args.crq_resolution,
        "armenia-cap-acta-153-2019": args.acta153,
        "armenia-acuerdo-019-2009": args.acuerdo019,
        "armenia-pot-volume-4b-2009": args.pot_volume,
        "quindio-armenia-delivery-2025": args.delivery_html,
        "armenia-decree-index-2026-07-25": args.decree_index_html,
    }
    lock_by_id = {item["sourceDocumentId"]: item for item in LOCKS["locks"]}
    media_types = {
        "crq-resolution-075-2006": "application/pdf",
        "armenia-cap-acta-153-2019": "application/pdf",
        "armenia-acuerdo-019-2009": "application/pdf",
        "armenia-pot-volume-4b-2009": "application/pdf",
        "quindio-armenia-delivery-2025": "text/html",
        "armenia-decree-index-2026-07-25": "text/html",
    }

    raw_byte_sources = 0
    live_semantic_sources = 0
    for source_id, path in paths.items():
        lock = lock_by_id[source_id]
        policy = lock["verificationPolicy"]
        if policy == "raw-byte-lock":
            raw_byte_sources += 1
            if digest(path) != lock["sha256"] or path.stat().st_size != lock["byteLength"]:
                raise AssertionError(f"source bytes differ: {source_id}")
            if media_types[source_id] != "application/pdf":
                raise AssertionError(f"raw-byte policy is restricted to PDFs: {source_id}")
            if len(pypdf.PdfReader(path).pages) != lock["pageCount"]:
                raise AssertionError(f"page count differs: {source_id}")
        elif policy == "live-semantic-dynamic-html":
            live_semantic_sources += 1
            if media_types[source_id] != "text/html":
                raise AssertionError(f"live-semantic policy is restricted to HTML: {source_id}")
            print(
                f"live HTML observation {source_id}: "
                f"bytes={path.stat().st_size} sha256={digest(path)}"
            )
        else:
            raise AssertionError(f"unknown verification policy: {source_id}/{policy}")

    if raw_byte_sources != 4 or live_semantic_sources != 2:
        raise AssertionError("expected 4 raw-byte PDFs and 2 live-semantic HTML sources")

    cache: dict[tuple[str, int], str] = {}
    for item in ATTESTATION["attestations"]:
        source_id = item["sourceDocumentId"]
        key = (source_id, item["physicalPage"])
        if key not in cache:
            cache[key] = normalize(source_text(paths[source_id], media_types[source_id], item["physicalPage"]))
        text = cache[key]
        for token in item["requiredTokens"]:
            if normalize(token).casefold() not in text.casefold():
                raise AssertionError(f"required token missing: {item['id']}/{token}")
        if hashlib.sha256(item["text"].encode("utf-8")).hexdigest() != item["sha256"]:
            raise AssertionError(f"statement digest differs: {item['id']}")
        for token in item.get("absentTokens", []):
            if re.search(re.escape(token), text, flags=re.IGNORECASE):
                raise AssertionError(f"formerly absent token is now present: {item['id']}/{token}")

    print("verified 4 raw-byte PDFs, 2 live-semantic dynamic HTML sources, and 7 extraction attestations")


if __name__ == "__main__":
    main()
