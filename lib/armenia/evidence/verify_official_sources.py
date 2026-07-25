"""Offline verification for the external-only Armenia primary sources.

Supply fresh downloads from the official URLs. The verifier fails closed on bytes,
page counts, exact required text and the explicitly caveated decree-index absence audit.
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
    parser.add_argument("--acta153", type=Path, required=True)
    parser.add_argument("--acuerdo019", type=Path, required=True)
    parser.add_argument("--pot-volume", type=Path, required=True)
    parser.add_argument("--delivery-html", type=Path, required=True)
    parser.add_argument("--decree-index-html", type=Path, required=True)
    args = parser.parse_args()
    paths = {
        "armenia-cap-acta-153-2019": args.acta153,
        "armenia-acuerdo-019-2009": args.acuerdo019,
        "armenia-pot-volume-4b-2009": args.pot_volume,
        "quindio-armenia-delivery-2025": args.delivery_html,
        "armenia-decree-index-2026-07-25": args.decree_index_html,
    }
    lock_by_id = {item["sourceDocumentId"]: item for item in LOCKS["locks"]}
    media_types = {
        "armenia-cap-acta-153-2019": "application/pdf",
        "armenia-acuerdo-019-2009": "application/pdf",
        "armenia-pot-volume-4b-2009": "application/pdf",
        "quindio-armenia-delivery-2025": "text/html",
        "armenia-decree-index-2026-07-25": "text/html",
    }

    for source_id, path in paths.items():
        lock = lock_by_id[source_id]
        if digest(path) != lock["sha256"] or path.stat().st_size != lock["byteLength"]:
            raise AssertionError(f"source bytes differ: {source_id}")
        if media_types[source_id] == "application/pdf":
            if len(pypdf.PdfReader(path).pages) != lock["pageCount"]:
                raise AssertionError(f"page count differs: {source_id}")

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

    print("verified 5 external Armenia sources and 6 extraction attestations")


if __name__ == "__main__":
    main()
