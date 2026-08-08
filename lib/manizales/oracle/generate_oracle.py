"""Independent Manizales oracle.

Reimplements the four branches printed on Figura 8.1 from the transcribed
Figura 8.5 cells, in exact decimal arithmetic, so the TypeScript engine is
checked against something that shares no code with it.
"""

import argparse
import hashlib
import json
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "oracle" / "oracle-input.json"
OUTPUT = ROOT / "oracle" / "oracle.json"


def stable(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def decimal_text(value):
    return format(value.normalize(), "f")


data = json.loads(INPUT.read_text(encoding="utf-8"))
importance = Decimal(data["importanceFactor"])
epsilon = Decimal(data["boundaryEpsilon"])
records = []

for row in data["rows"]:
    option, *tokens = row
    v = dict(zip(data["fieldOrder"], map(Decimal, tokens)))

    def ordinate(period, v=v):
        if period <= v["to"]:
            branch = "manizales-entrance"
            sa = v["am"] * importance + (v["am"] * importance / v["to"]) * (
                Decimal("2.5") * v["fa"] - Decimal(1)
            ) * period
        elif period <= v["tc"]:
            branch = "manizales-plateau"
            sa = Decimal("2.5") * v["am"] * v["fa"] * importance
        elif period <= v["tl"]:
            branch = "manizales-inverse"
            sa = v["an"] * v["fv"] * importance / period
        else:
            branch = "manizales-floor"
            sa = v["am"] * importance / Decimal(2)
        return {
            "period": decimal_text(period),
            "status": "ok",
            "branch": branch,
            "saG": decimal_text(sa),
        }

    periods = [
        v["to"] - epsilon, v["to"], v["to"] + epsilon,
        v["tc"] - epsilon, v["tc"], v["tc"] + epsilon,
        v["tl"] - epsilon, v["tl"], v["tl"] + epsilon,
    ] + [Decimal(token) for token in data["extraPeriods"]]
    records.append({
        "optionId": option,
        "hazardId": "design",
        "fields": {field: float(Decimal(token)) for field, token in zip(data["fieldOrder"], tokens)},
        "tokens": dict(zip(data["fieldOrder"], tokens)),
        "continuity": {
            "plateauFromEntranceAtTo": decimal_text(
                v["am"] * importance
                + (v["am"] * importance / v["to"]) * (Decimal("2.5") * v["fa"] - Decimal(1)) * v["to"]
            ),
            "plateau": decimal_text(Decimal("2.5") * v["am"] * v["fa"] * importance),
            "inverseAtTc": decimal_text(v["an"] * v["fv"] * importance / v["tc"]),
            "inverseAtTl": decimal_text(v["an"] * v["fv"] * importance / v["tl"]),
            "floor": decimal_text(v["am"] * importance / Decimal(2)),
        },
        "boundaryCases": [ordinate(period) for period in sorted(set(periods))],
    })

result = {
    "schemaVersion": 2,
    "status": "normalized-spectrum-supported-full-curve",
    "importanceFactor": decimal_text(importance),
    "records": records,
    "unsupportedIntervals": [],
    "inputSha256": hashlib.sha256(INPUT.read_bytes()).hexdigest(),
}
expected = stable(result)
parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
if args.check:
    if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != expected:
        raise SystemExit("Manizales oracle differs")
else:
    OUTPUT.write_text(expected, encoding="utf-8", newline="\n")
print("checked" if args.check else "generated", "Manizales oracle")
