#!/usr/bin/env python3
"""Recompute the external-only Bogotá PDF extraction attestation locally."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata as package_metadata
import json
import math
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


def check_required_tokens(label: str, expected: list[str], rect: dict, words: list[dict], width: float, height: float) -> None:
    actual = text_in_rect(words, rect, width, height)
    for token in expected:
        if normalized(token) not in actual:
            fail(f"{label} required token {token!r} is absent from extracted region {actual!r}")


def rect_points(rect: dict, width: float, height: float) -> tuple[float, float, float, float]:
    return (
        rect["left"] * width,
        rect["top"] * height,
        (rect["left"] + rect["width"]) * width,
        (rect["top"] + rect["height"]) * height,
    )


def rects_overlap(left: dict, right: dict) -> bool:
    return (
        left["left"] < right["left"] + right["width"]
        and left["left"] + left["width"] > right["left"]
        and left["top"] < right["top"] + right["height"]
        and left["top"] + left["height"] > right["top"]
    )


def normalized_graphic(value):
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, (tuple, list)):
        return [normalized_graphic(item) for item in value]
    return value


def graphic_descriptor(kind: str, graphic: dict) -> dict:
    return {
        "kind": kind,
        "x0": round(float(graphic["x0"]), 6),
        "x1": round(float(graphic["x1"]), 6),
        "top": round(float(graphic["top"]), 6),
        "bottom": round(float(graphic["bottom"]), 6),
        "lineWidth": round(float(graphic["linewidth"]), 6),
        "stroke": bool(graphic["stroke"]),
        "fill": bool(graphic["fill"]),
        "path": normalized_graphic(graphic["path"]),
    }


def canonical_sha256(value: object) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def verify_graphical_origin(table: dict, page, words: list[dict], citation_by_id: dict, renderer: dict) -> None:
    origin = table["graphicalOrigin"]
    label = table["hazardId"]
    if origin["inferenceKind"] != "graphical-axis-origin" or origin["token"] != "(g) T(s)" or "0" in origin["requiredTokens"]:
        fail(f"{label} graphical-origin evidence cannot use the A0 subscript or a standalone 0 token")
    check_required_tokens(f"{label} graphical origin", origin["requiredTokens"], origin["rect"], words, page.width, page.height)

    figure = citation_by_id.get(origin["figureCitationId"])
    equation = citation_by_id.get(origin["equationCitationId"])
    if not figure or figure["regionKind"] != "figure" or figure["rect"] != origin["rect"] or figure["extractedToken"] != origin["token"]:
        fail(f"{label} graphical-origin figure linkage mismatch")
    if not equation or equation["regionKind"] != "equation" or equation["rect"] != origin["rect"] or equation["extractedToken"] != origin["token"]:
        fail(f"{label} graphical-origin equation linkage mismatch")
    if equation.get("parentCitationId") != figure["id"]:
        fail(f"{label} graphical-origin equation is not contained by its figure parent")

    image_attestation = origin["imageRegion"]
    cropped = page.crop(rect_points(origin["rect"], page.width, page.height)).to_image(
        resolution=renderer["resolutionDpi"],
        antialias=renderer["antialias"],
    ).original.convert(renderer["colorMode"])
    image_payload = f"{cropped.mode}:{cropped.width}x{cropped.height}:".encode("ascii") + cropped.tobytes()
    if [cropped.width, cropped.height] != [image_attestation["pixelWidth"], image_attestation["pixelHeight"]] or hashlib.sha256(image_payload).hexdigest() != image_attestation["sha256"]:
        fail(f"{label} graphical-origin rendered-region hash mismatch")

    expected_hashes = origin["vectorEvidence"]["primitiveSha256"]
    available = {}
    for kind, graphics in (("line", page.lines), ("curve", page.curves)):
        for graphic in graphics:
            descriptor = graphic_descriptor(kind, graphic)
            available.setdefault(canonical_sha256(descriptor), []).append(descriptor)
    selected = {}
    for role, expected_hash in expected_hashes.items():
        candidates = available.get(expected_hash, [])
        if len(candidates) != 1:
            fail(f"{label} graphical-origin {role} vector primitive mismatch")
        selected[role] = candidates[0]
    if canonical_sha256(selected) != origin["vectorEvidence"]["regionSha256"]:
        fail(f"{label} graphical-origin vector-region hash mismatch")

    period_axis = selected["periodAxis"]
    period_arrow = selected["periodArrow"]
    spectral_axis = selected["spectralAxis"]
    spectral_arrow = selected["spectralArrow"]
    plateau = selected["plateau"]
    if not (period_axis["kind"] == "curve" and period_axis["fill"] and period_axis["x1"] - period_axis["x0"] > 250 and period_axis["bottom"] - period_axis["top"] < 1):
        fail(f"{label} period-axis vector semantics mismatch")
    if not (spectral_axis["kind"] == "curve" and spectral_axis["fill"] and spectral_axis["bottom"] - spectral_axis["top"] > 100 and spectral_axis["x1"] - spectral_axis["x0"] < 1):
        fail(f"{label} spectral-axis vector semantics mismatch")
    if not (plateau["kind"] == "line" and plateau["stroke"] and not plateau["fill"] and plateau["lineWidth"] >= 2 and plateau["x1"] - plateau["x0"] > 50):
        fail(f"{label} plateau vector semantics mismatch")
    if not (period_arrow["fill"] and period_arrow["x0"] >= period_axis["x1"] - 2 and spectral_arrow["fill"] and spectral_arrow["bottom"] <= spectral_axis["top"] + 2):
        fail(f"{label} axis-arrow vector semantics mismatch")

    axis_x = round((spectral_axis["x0"] + spectral_axis["x1"]) / 2, 6)
    axis_y = round(float(spectral_axis["path"][0][1][1]), 6)
    vector = origin["vectorEvidence"]
    tolerance = vector["alignmentTolerancePoints"]
    if not math.isclose(axis_x, vector["axisIntersectionPoints"]["x"], abs_tol=0.01) or not math.isclose(axis_y, vector["axisIntersectionPoints"]["y"], abs_tol=0.01):
        fail(f"{label} axis-intersection coordinate mismatch")
    if not math.isclose(plateau["x0"], vector["plateauStartPoints"]["x"], abs_tol=0.01) or not math.isclose(plateau["top"], vector["plateauStartPoints"]["y"], abs_tol=0.01):
        fail(f"{label} plateau-start coordinate mismatch")
    if abs(plateau["x0"] - axis_x) > tolerance:
        fail(f"{label} plateau does not begin at the period-axis origin")

    rejected = origin["rejectedTextCandidate"]
    if rejected["token"] != "0" or rejected["semanticRole"] != "A0 parameter subscript, not a period-axis origin" or rects_overlap(origin["rect"], rejected["rect"]):
        fail(f"{label} A0 false-candidate guard mismatch")
    check_locator(f"{label} rejected A0 subscript", "0", rejected["rect"], words, page.width, page.height)
    check_required_tokens(f"{label} rejected A0 context", rejected["contextRequiredTokens"], rejected["contextRect"], words, page.width, page.height)
    false_box = rect_points(rejected["rect"], page.width, page.height)
    context_box = rect_points(rejected["contextRect"], page.width, page.height)
    false_zero = [word for word in words if word["text"] == "0" and false_box[0] <= (word["x0"] + word["x1"]) / 2 <= false_box[2] and false_box[1] <= (word["top"] + word["bottom"]) / 2 <= false_box[3]]
    context_a = [word for word in words if word["text"] == "A" and context_box[0] <= (word["x0"] + word["x1"]) / 2 <= context_box[2] and context_box[1] <= (word["top"] + word["bottom"]) / 2 <= context_box[3]]
    if len(false_zero) != 1 or not any(0 <= false_zero[0]["x0"] - word["x1"] <= 1 and false_zero[0]["top"] > word["top"] for word in context_a):
        fail(f"{label} rejected token is not the A0 subscript")


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
    renderer = profile["renderer"]
    actual_renderer_versions = {
        "pypdfium2": package_metadata.version("pypdfium2"),
        "Pillow": package_metadata.version("Pillow"),
    }
    if actual_renderer_versions != {"pypdfium2": renderer["version"], "Pillow": renderer["pillowVersion"]}:
        fail(
            "renderer version mismatch: "
            f"need pypdfium2 {renderer['version']} / Pillow {renderer['pillowVersion']}, "
            f"got pypdfium2 {actual_renderer_versions['pypdfium2']} / Pillow {actual_renderer_versions['Pillow']}"
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
            if table["graphicalOrigin"]:
                verify_graphical_origin(table, page, words, citation_by_id, renderer)
            elif table["hazardId"] != "damage-threshold":
                fail(f"{table['hazardId']} lacks graphical-origin evidence")
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
        f"sha256={attestation['source']['sha256']} tables=3 rows=48 cells=256 graphical_origins=2 claims={len(attestation['claims'])}"
    )


if __name__ == "__main__":
    main()
