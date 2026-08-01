"""Independent negative oracle for the blocked Armenia research dossier.

It intentionally performs no spectrum arithmetic because no adopted option × hazard
matrix or formula set was established. It reads only oracle-input.json to decide the
expected typed rejection for each candidate workflow. The canonical file is read only
after the decision is built, solely to seal its byte hash in locks.json.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDY_ROOT = HERE.parent
INPUT = HERE / "oracle-input.json"
OUTPUT = HERE / "oracle.json"
LOCKS = HERE / "locks.json"
PROGRAM = Path(__file__).resolve()
CANONICAL = STUDY_ROOT / "data" / "canonical.json"


def stable_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> dict:
    source = json.loads(INPUT.read_text(encoding="utf-8"))
    if source["proposedSpectrumMatrix"] != {"selectableOptions": [], "hazards": [], "fields": []}:
        raise AssertionError("An unsupported Armenia spectrum matrix entered the oracle input")
    records = []
    for case in source["cases"]:
        if case["case"] == "national-building-workflow":
            expected = "use-nsr10-national"
        elif case["case"] == "legacy-zone-request":
            expected = "reject-missing-primary-decreto-079-numerical-annex"
        elif case["case"] == "delivered-2025-study-request":
            expected = "reject-new-study-is-context-not-installed-model"
        elif case["case"] == "unknown-zone-or-hazard":
            expected = "reject-no-source-locked-option-hazard-matrix"
        elif case["case"] == "site-specific-branch-request":
            expected = "reject-missing-primary-site-specific-rules"
        else:
            raise AssertionError(f"Unexpected oracle case {case['case']}")
        records.append({"case": case["case"], "input": case["input"], "expected": expected})
    return {
        "schemaVersion": 1,
        "studyId": source["studyId"],
        "status": "negative-oracle-activation-blocked",
        "arithmetic": "none-primary-numerical-annex-unavailable",
        "records": records,
        "blockers": source["blockers"],
    }


def main() -> None:
    output_bytes = stable_bytes(build())
    locks = {
        "schemaVersion": 1,
        "algorithm": "sha256",
        "program": sha256(PROGRAM),
        "input": sha256(INPUT),
        "canonical": sha256(CANONICAL),
        "output": hashlib.sha256(output_bytes).hexdigest(),
    }
    locks_bytes = stable_bytes(locks)
    if "--check" in sys.argv:
        if not OUTPUT.exists() or OUTPUT.read_bytes() != output_bytes:
            raise AssertionError("oracle.json is not deterministic/current")
        if not LOCKS.exists() or LOCKS.read_bytes() != locks_bytes:
            raise AssertionError("locks.json is not deterministic/current")
        print("checked 5 Armenia negative-oracle cases")
        return
    OUTPUT.write_bytes(output_bytes)
    LOCKS.write_bytes(locks_bytes)
    print("generated 5 Armenia negative-oracle cases")


if __name__ == "__main__":
    main()
