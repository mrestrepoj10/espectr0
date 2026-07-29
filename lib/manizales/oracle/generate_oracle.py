#!/usr/bin/env python3
"""Generate the independent, intentionally non-operational Manizales oracle."""

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


def encode(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n").encode("utf-8")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(source: dict) -> dict:
    fields = source["candidate"]["fields"]
    aa = Decimal(fields["aa"])
    av = Decimal(fields["av"])
    importance = Decimal(fields["importance-factor-fit"])
    return {
        "schemaVersion": 1,
        "studyId": source["studyId"],
        "status": "partial-oracle-activation-blocked",
        "precision": "Python Decimal, 50 significant digits",
        "recordCount": 1,
        "records": [{
            "optionId": source["candidate"]["optionId"],
            "hazardId": source["candidate"]["hazardId"],
            "status": "direct-parameter-witness-only-no-spectrum",
            "nodeCount": int(fields["node-count"]),
            "returnPeriodYears": int(fields["return-period"]),
            "spatialModel": source["candidateMetadata"]["spatialModel"],
            "soilParameters": source["candidateMetadata"]["soilParameters"],
            "fixedFitParameters": {"aaG": str(aa), "avG": str(av), "importanceFactor": str(importance)},
            "arithmeticWitnessNotSpectrum": {"aaTimesFitImportance": str(aa * importance), "avTimesFitImportance": str(av * importance)},
            "spectralSamples": [],
            "missingInputs": source["requiredForSpectrum"],
        }],
        "negativeCases": [
            {"case": "activation", "expected": "reject-missing-node-values-location-rule"},
            {"case": "manual-zone-selector", "expected": "reject-updated-model-is-raster-not-zones"},
            {"case": "zone-a-b-or-c-as-current", "expected": "reject-historical-model-substitution"},
            {"case": "spectrum-at-any-period", "expected": "reject-missing-node-fa-fv-and-location-rule"},
            {"case": "unknown-node-or-location", "expected": "reject"},
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
    result = build(load(input_path))
    output_bytes = encode(result)
    if args.check:
        if output_path.read_bytes() != output_bytes:
            raise SystemExit("Manizales oracle differs from deterministic recomputation")
    else:
        output_path.write_bytes(output_bytes)
    locks = {
        "schemaVersion": 1,
        "program": digest(Path(__file__)),
        "input": digest(input_path),
        "canonical": digest(canonical_path),
        "output": hashlib.sha256(output_bytes).hexdigest(),
    }
    lock_bytes = encode(locks)
    if args.check:
        if locks_path.read_bytes() != lock_bytes:
            raise SystemExit("Manizales oracle locks differ from committed bytes")
    else:
        locks_path.write_bytes(lock_bytes)
    print(f"{'checked' if args.check else 'generated'} Manizales oracle records={result['recordCount']}")


if __name__ == "__main__":
    main()
