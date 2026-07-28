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
for row in data["rows"]:
    option, *tokens = row
    records.append({"optionId": option, "hazardId": "design", "fields": {field: float(Decimal(token)) for field, token in zip(data["fieldOrder"], tokens)}, "tokens": dict(zip(data["fieldOrder"], tokens))})
result = {"schemaVersion": 1, "status": "table-transcription-verified-calculation-blocked", "records": records, "negativeCases": [{**case, "outcome": "reject"} for case in data["negativeCases"]], "inputSha256": hashlib.sha256(INPUT.read_bytes()).hexdigest()}
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
