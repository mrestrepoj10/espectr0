#!/usr/bin/env python3
"""Recompute the external-only Bogotá PDF extraction attestation locally."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import unicodedata
from pathlib import Path

import pdfminer
import pdfplumber


HERE = Path(__file__).resolve().parent


def fail(message: str) -> None:
    raise SystemExit(f"Bogotá official-PDF verification failed: {message}")


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def normalized(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).split())


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def text_in_rect(words: list[dict], rect: dict, width: float, height: float) -> str:
    left = rect["left"] * width
    top = rect["top"] * height
    right = (rect["left"] + rect["width"]) * width
    bottom = (rect["top"] + rect["height"]) * height
    selected = [
        word
        for word in words
        if left <= (word["x0"] + word["x1"]) / 2 <= right
        and top <= (word["top"] + word["bottom"]) / 2 <= bottom
    ]
    selected.sort(key=lambda word: (round(word["top"], 3), word["x0"]))
    return normalized(" ".join(word["text"] for word in selected))


def check_locator(label: str, expected: str, rect: dict, words: list[dict], width: float, height: float) -> None:
    actual = text_in_rect(words, rect, width, height)
    if actual != normalized(expected):
        fail(f"{label} token/rectangle mismatch: expected {expected!r}, extracted {actual!r}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True, type=Path, help="locally supplied official FOPAE PDF")
    parser.add_argument("--attestation", type=Path, default=HERE / "extraction-attestation.json")
    args = parser.parse_args()

    attestation = load_json(args.attestation)
    profile = load_json(HERE / "extraction-profile.json")
    manifest = load_json(HERE / "manifest.json")
    claims = load_json(HERE / "claims-matrix.json")
    source_locks = load_json(HERE / "source-locks.json")

    if attestation["profile"] != profile:
        fail("committed extraction profile differs from the attestation")
    expected_extractor = profile["extractor"]
    if pdfplumber.__version__ != expected_extractor["version"] or pdfminer.__version__ != expected_extractor["pdfminerVersion"]:
        fail(
            "extractor version mismatch: "
            f"need pdfplumber {expected_extractor['version']} / pdfminer.six {expected_extractor['pdfminerVersion']}, "
            f"got {pdfplumber.__version__} / {pdfminer.__version__}"
        )
    if not args.pdf.is_file():
        fail(f"PDF does not exist: {args.pdf}")
    if args.pdf.stat().st_size != attestation["source"]["byteLength"]:
        fail("source byte length mismatch")
    if sha256_file(args.pdf) != attestation["source"]["sha256"]:
        fail("source hash mismatch")

    citation_by_id = {citation["id"]: citation for citation in manifest["citations"]}
    if len(citation_by_id) != len(manifest["citations"]):
        fail("duplicate manifest citation id")
    lock_by_id = {lock["sourceDocumentId"]: lock for lock in source_locks["locks"]}
    claim_by_id = {claim["id"]: claim for claim in claims["claims"]}

    with pdfplumber.open(args.pdf) as pdf:
        if len(pdf.pages) != attestation["source"]["pageCount"]:
            fail("source page count mismatch")
        page_words = {}
        for table in attestation["tables"]:
            page_number = table["physicalPage"]
            page = pdf.pages[page_number - 1]
            if [round(float(page.width), 6), round(float(page.height), 6)] != [
                profile["pageGeometryPoints"]["width"],
                profile["pageGeometryPoints"]["height"],
            ]:
                fail(f"page {page_number} geometry mismatch")
            words = page_words.setdefault(
                page_number,
                page.extract_words(
                    x_tolerance=expected_extractor["parameters"]["xTolerance"],
                    y_tolerance=expected_extractor["parameters"]["yTolerance"],
                    use_text_flow=expected_extractor["parameters"]["useTextFlow"],
                    keep_blank_chars=expected_extractor["parameters"]["keepBlankChars"],
                ),
            )
            check_locator(f"{table['hazardId']} title", table["title"]["token"], table["title"]["rect"], words, page.width, page.height)
            check_locator(f"{table['hazardId']} caption", table["caption"]["token"], table["caption"]["rect"], words, page.width, page.height)
            table_citation = citation_by_id.get(table["citationId"])
            if not table_citation or any(
                table_citation[key] != table[key]
                for key in ("physicalPage", "printedPage", "reference", "rect")
            ) or table_citation["extractedToken"] != table["caption"]["token"]:
                fail(f"{table['hazardId']} manifest table linkage mismatch")
            if table["zeroOrigin"]:
                zero = table["zeroOrigin"]
                check_locator(f"{table['hazardId']} graph origin", zero["token"], zero["rect"], words, page.width, page.height)
                zero_citation = citation_by_id.get(zero["citationId"])
                if not zero_citation or zero_citation["rect"] != zero["rect"] or zero_citation["extractedToken"] != zero["token"]:
                    fail(f"{table['hazardId']} zero-origin manifest linkage mismatch")
            for row in table["rows"]:
                label = f"{table['hazardId']}/{row['optionId']}"
                check_locator(f"row {label}", row["token"], row["rect"], words, page.width, page.height)
                row_citation = citation_by_id.get(row["citationId"])
                if not row_citation or row_citation["rect"] != row["rect"] or row_citation["extractedToken"] != row["token"]:
                    fail(f"row {label} manifest linkage mismatch")
                for cell in row["cells"]:
                    check_locator(f"cell {label}/{cell['fieldId']}", cell["token"], cell["rect"], words, page.width, page.height)
                    citation = citation_by_id.get(cell["citationId"])
                    if not citation or citation["rect"] != cell["rect"] or citation["extractedToken"] != cell["token"] or citation["normalizedValue"] != cell["normalizedValue"]:
                        fail(f"cell {label}/{cell['fieldId']} manifest linkage mismatch")

    if len(attestation["claims"]) != len(claims["claims"]):
        fail("claim coverage mismatch")
    for attested_claim in attestation["claims"]:
        claim = claim_by_id.get(attested_claim["claimId"])
        lock = lock_by_id.get(attested_claim["sourceDocumentId"])
        if not claim or not lock or attested_claim["sourceSha256"] != lock["sha256"]:
            fail(f"claim {attested_claim['claimId']} source lock mismatch")
        expected_statement_hash = hashlib.sha256(unicodedata.normalize("NFC", claim["statement"]).encode("utf-8")).hexdigest()
        citation = claim["citation"]
        if any(attested_claim[key] != citation[key] for key in ("sourceDocumentId", "physicalPage", "printedPage", "reference")) or attested_claim["statementSha256"] != expected_statement_hash:
            fail(f"claim {attested_claim['claimId']} token/locator mismatch")

    cells = sum(len(row["cells"]) for table in attestation["tables"] for row in table["rows"])
    if len(attestation["tables"]) != 3 or sum(len(table["rows"]) for table in attestation["tables"]) != 48 or cells != 256:
        fail("table/row/cell coverage mismatch")
    print(
        "verified official PDF attestation: "
        f"sha256={attestation['source']['sha256']} tables=3 rows=48 cells=256 claims={len(attestation['claims'])}"
    )


if __name__ == "__main__":
    main()
