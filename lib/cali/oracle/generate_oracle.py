#!/usr/bin/env python3
"""Generate the independent, partial Cali spectrum oracle using Decimal arithmetic."""

from __future__ import annotations

import argparse
import hashlib
import json
from decimal import Decimal, getcontext
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
getcontext().prec = 50


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def encoded(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n").encode("utf-8")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dec(value) -> Decimal:
    return Decimal(str(value))


def show(value: Decimal) -> str:
    rendered = format(value.normalize(), "f")
    return "0" if rendered == "-0" else rendered


def complete_record(option: str, hazard_id: str, base: Decimal, row: list) -> dict:
    tc, fa, tl, fv = map(dec, row)
    plateau = Decimal("2.5") * base * fa

    def inverse(period: Decimal) -> Decimal:
        return Decimal("1.2") * base * fv / period

    def inverse_square(period: Decimal) -> Decimal:
        return Decimal("1.2") * base * fv * tl / (period * period)

    middle = (tc + tl) / Decimal(2)
    after_tl = tl + Decimal("0.01")
    return {
        "optionId": option,
        "hazardId": hazard_id,
        "status": "complete-three-branch-oracle",
        "samples": [
            {"periodSeconds": "0", "branch": "plateau", "spectralAccelerationG": show(plateau)},
            {"periodSeconds": show(tc), "branch": "plateau-at-tabulated-tc", "spectralAccelerationG": show(plateau)},
            {"periodSeconds": show(middle), "branch": "inverse", "spectralAccelerationG": show(inverse(middle))},
            {"periodSeconds": show(tl), "branch": "inverse-at-tabulated-tl", "spectralAccelerationG": show(inverse(tl))},
            {"periodSeconds": show(after_tl), "branch": "inverse-square", "spectralAccelerationG": show(inverse_square(after_tl))},
        ],
        "boundaryResidualsG": {
            "tcPlateauMinusInverse": show(plateau - inverse(tc)),
            "tlInverseMinusInverseSquare": show(inverse(tl) - inverse_square(tl)),
        },
    }


def damage_record(option: str, base: Decimal, row: list) -> dict:
    fv, s_value, tcd, tld = map(dec, row)

    def inverse(period: Decimal) -> Decimal:
        return Decimal("1.5") * base * fv / period

    def inverse_square(period: Decimal) -> Decimal:
        return Decimal("1.5") * base * fv * tld / (period * period)

    after_tcd = tcd + Decimal("0.01")
    after_tld = tld + Decimal("0.01")
    return {
        "optionId": option,
        "hazardId": "damage-threshold",
        "status": "partial-long-period-only-missing-a0d-fa",
        "uncomputedRange": "T ≤ Tcd",
        "samples": [
            {"periodSeconds": show(after_tcd), "branch": "inverse", "spectralAccelerationG": show(inverse(after_tcd))},
            {"periodSeconds": show(tld), "branch": "inverse-at-tabulated-tld", "spectralAccelerationG": show(inverse(tld))},
            {"periodSeconds": show(after_tld), "branch": "inverse-square", "spectralAccelerationG": show(inverse_square(after_tld))},
        ],
        "publishedConsistencyResiduals": {
            "sMinus1.25Fv": show(s_value - Decimal("1.25") * fv),
            "tcdMinus0.5S": show(tcd - Decimal("0.5") * s_value),
            "tldInverseMinusInverseSquare": show(inverse(tld) - inverse_square(tld)),
        },
    }


def ancillary_minimum_record(option: str, curve_family_id: str, base: Decimal, row: list) -> dict:
    record = complete_record(option, curve_family_id, base, row)
    record["curveFamilyId"] = record.pop("hazardId")
    record["status"] = "complete-ancillary-design-lower-bound-oracle"
    return record


def build(source: dict) -> dict:
    records = []
    for hazard_id, hazard in source["hazards"].items():
        base = dec(hazard["baseAccelerationG"])
        for option, row in zip(source["options"], hazard["rows"], strict=True):
            records.append(damage_record(option, base, row) if hazard_id == "damage-threshold" else complete_record(option, hazard_id, base, row))
    for curve_family_id, curve in source["ancillaryCurves"].items():
        base = dec(curve["baseAccelerationG"])
        for option, row in zip(source["options"], curve["rows"], strict=True):
            records.append(ancillary_minimum_record(option, curve_family_id, base, row))
    return {
        "schemaVersion": 1,
        "studyId": source["studyId"],
        "status": "partial-oracle-activation-blocked",
        "precision": "Python Decimal, 50 significant digits",
        "boundaryPolicy": "Tabulated branch selectors are authoritative; residuals expose coefficient rounding and are not silently repaired.",
        "recordCount": len(records),
        "records": records,
        "negativeCases": [
            {"case": "activation", "expected": "blocked-missing-damage-a0d-fa-and-independent-review"},
            {"case": "damage-threshold-at-or-below-tcd", "expected": "reject-uncomputable-without-a0d-fa"},
            {"case": "zone-4b-4c-5-single-component", "expected": "reject-both-concurrent-curves-required"},
            {"case": "negative-period", "expected": "reject"},
            {"case": "unknown-zone", "expected": "reject"},
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    input_path = HERE / "oracle-input.json"
    output_path = HERE / "oracle.json"
    locks_path = HERE / "locks.json"
    canonical_path = ROOT / "data" / "canonical.json"
    oracle = build(load(input_path))
    output_bytes = encoded(oracle)
    if args.check:
        if output_path.read_bytes() != output_bytes:
            raise SystemExit("Cali oracle differs from deterministic recomputation")
    else:
        output_path.write_bytes(output_bytes)
    locks = {
        "schemaVersion": 1,
        "program": digest(Path(__file__)),
        "input": digest(input_path),
        "canonical": digest(canonical_path),
        "output": hashlib.sha256(output_bytes).hexdigest(),
    }
    locks_bytes = encoded(locks)
    if args.check:
        if locks_path.read_bytes() != locks_bytes:
            raise SystemExit("Cali oracle locks differ from committed bytes")
    else:
        locks_path.write_bytes(locks_bytes)
    print(f"{'checked' if args.check else 'generated'} Cali oracle records={len(oracle['records'])}")


if __name__ == "__main__":
    main()
