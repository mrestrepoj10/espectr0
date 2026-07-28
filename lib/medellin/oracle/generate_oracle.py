from __future__ import annotations

import hashlib
import json
import sys
from decimal import Decimal, ROUND_HALF_UP, getcontext
from pathlib import Path

getcontext().prec = 50
ROOT = Path(__file__).resolve().parent
STUDY_ROOT = ROOT.parent
INPUT_PATH = ROOT / "oracle-input.json"
OUTPUT_PATH = ROOT / "oracle.json"
LOCKS_PATH = ROOT / "locks.json"
CANONICAL_PATH = STUDY_ROOT / "data" / "canonical.json"
PROGRAM_PATH = Path(__file__).resolve()
EPSILON = Decimal("0.000000001")
ONE = Decimal(1)
TWO = Decimal(2)
R_WITNESS = Decimal(5)


def stable_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def text(value: Decimal) -> str:
    return format(value, "f")


def build() -> dict:
    source = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    records = []
    for hazard_id, hazard in source["hazards"].items():
        for index, row in enumerate(hazard["rows"]):
            ground, fa, plateau, t0, tc, alpha = map(Decimal, row)
            product = ground * fa
            rounded_product = product.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if rounded_product != plateau:
                raise AssertionError(f"Table product mismatch at {hazard_id}/zone-{index + 1:02d}")
            just_right_tc = tc + EPSILON
            tail_right = plateau * (tc / just_right_tc) ** alpha
            rc_boundary = (t0 + tc) / TWO
            records.append({
                "optionId": source["options"][index],
                "hazardId": hazard_id,
                "directDecimals": dict(zip(source["fields"], row)),
                "plateauProductWitness": {
                    "expression": f"{row[0]} × {row[1]}",
                    "exact": text(product),
                    "roundedHalfUp2": text(rounded_product),
                    "published": text(plateau),
                },
                "verifiedSpectrumWitnesses": [
                    {"period": text(t0), "side": "exact", "branch": "plateau", "saPerImportance": text(plateau)},
                    {"period": text(t0 + EPSILON), "side": "just-right", "branch": "plateau", "saPerImportance": text(plateau)},
                    {"period": text(tc - EPSILON), "side": "just-left", "branch": "plateau", "saPerImportance": text(plateau)},
                    {"period": text(tc), "side": "exact", "branch": "plateau-tail-boundary", "saPerImportance": text(plateau)},
                    {"period": text(just_right_tc), "side": "just-right", "branch": "power-decay", "saPerImportance": text(tail_right)},
                    {"period": "4", "side": "domain-end", "branch": "power-decay", "saPerImportance": text(plateau * (tc / Decimal(4)) ** alpha)},
                ],
                "rcWitness": {
                    "R": text(R_WITNESS),
                    "boundary": text(rc_boundary),
                    "values": [
                        {"period": "0", "rc": "1"},
                        {"period": text(rc_boundary / TWO), "rc": text(ONE + (R_WITNESS - ONE) / TWO)},
                        {"period": text(rc_boundary), "rc": text(R_WITNESS)},
                        {"period": text(rc_boundary + EPSILON), "rc": text(R_WITNESS)},
                    ],
                },
                "unverified": {"periodDomain": f"0 < T < {text(t0)}", "reason": "rising-branch equation absent"},
            })
    return {
        "schemaVersion": 1,
        "studyId": source["studyId"],
        "decimalPrecision": getcontext().prec,
        "status": "partial-oracle-activation-blocked",
        "recordCount": len(records),
        "records": records,
        "negativeCases": [
            {"case": "unknown-zone", "expected": "reject"},
            {"case": "unknown-hazard", "expected": "reject"},
            {"case": "T<0", "expected": "reject"},
            {"case": "T>4", "expected": "reject-or-outside-source-domain"},
            {"case": "0<T<T0", "expected": "blocked-missing-equation"},
            {"case": "activation", "expected": "blocked-no-adopted-decree"},
        ],
        "declaredBinary64Tolerance": source["declaredBinary64Tolerance"],
        "blockers": source["blockedBranches"] + source["blockedMetadata"],
    }


def main() -> None:
    output = build()
    output_bytes = stable_bytes(output)
    locks = {
        "schemaVersion": 1,
        "algorithm": "sha256",
        "program": sha256(PROGRAM_PATH),
        "input": sha256(INPUT_PATH),
        "canonical": sha256(CANONICAL_PATH),
        "output": hashlib.sha256(output_bytes).hexdigest(),
    }
    locks_bytes = stable_bytes(locks)
    if "--check" in sys.argv:
        if OUTPUT_PATH.read_bytes() != output_bytes:
            raise AssertionError("oracle.json is not deterministic/current")
        if LOCKS_PATH.read_bytes() != locks_bytes:
            raise AssertionError("locks.json is not deterministic/current")
        print(f"checked {len(output['records'])} Medellín Decimal oracle records")
        return
    OUTPUT_PATH.write_bytes(output_bytes)
    LOCKS_PATH.write_bytes(locks_bytes)
    print(f"generated {len(output['records'])} Medellín Decimal oracle records")


if __name__ == "__main__":
    main()
