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

data = json.loads(INPUT.read_text(encoding="utf-8"))
records = []
importance = Decimal(data["importanceFactor"])
epsilon = Decimal(data["boundaryEpsilon"])

def decimal_text(value):
    return format(value.normalize(), "f")

for row in data["rows"]:
    option, *tokens = row
    values = dict(zip(data["fieldOrder"], map(Decimal, tokens)))
    av = values["tc"] * values["aa"] * values["fa"] / (Decimal("0.48") * values["fv"])

    def ordinate(period):
        if period < values["to"]:
            return {"period": decimal_text(period), "status": "unsupported", "branch": None, "saG": None}
        if period <= values["tc"]:
            branch = "dosquebradas-plateau"
            sa = Decimal("2.5") * values["aa"] * values["fa"] * importance
        elif period <= values["tl"]:
            branch = "dosquebradas-inverse"
            sa = Decimal("1.2") * av * values["fv"] * importance / period
        else:
            return {"period": decimal_text(period), "status": "unsupported", "branch": None, "saG": None}
        return {"period": decimal_text(period), "status": "ok", "branch": branch, "saG": decimal_text(sa)}

    periods = [
        values["to"] - epsilon, values["to"], values["to"] + epsilon,
        values["tc"] - epsilon, values["tc"], values["tc"] + epsilon,
        values["tl"] - epsilon, values["tl"], values["tl"] + epsilon,
    ]
    records.append({
        "optionId": option,
        "hazardId": "design",
        "fields": {field: float(Decimal(token)) for field, token in zip(data["fieldOrder"], tokens)},
        "tokens": dict(zip(data["fieldOrder"], tokens)),
        "derivedAv": decimal_text(av),
        "boundaryCases": [ordinate(period) for period in periods],
    })
result = {
    "schemaVersion": 2,
    "status": "normalized-spectrum-supported-from-to",
    "importanceFactor": decimal_text(importance),
    "records": records,
    "unsupportedIntervals": [
        {"condition": "T < To", "outcome": "unsupported"},
        {"condition": "T > TL", "outcome": "unsupported"},
    ],
    "inputSha256": hashlib.sha256(INPUT.read_bytes()).hexdigest(),
}
expected = stable(result)
parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
if args.check:
    if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != expected:
        raise SystemExit("Dosquebradas oracle differs")
else:
    OUTPUT.write_text(expected, encoding="utf-8", newline="\n")
print("checked" if args.check else "generated", "Dosquebradas oracle")
