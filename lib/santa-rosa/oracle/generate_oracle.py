import argparse, hashlib, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; INPUT = ROOT / "oracle" / "oracle-input.json"; OUTPUT = ROOT / "oracle" / "oracle.json"; data = json.loads(INPUT.read_text(encoding="utf-8")); result = {"schemaVersion": 1, "status": "negative-oracle-activation-blocked", "cases": [{**case, "outcome": "reject"} for case in data["cases"]], "inputSha256": hashlib.sha256(INPUT.read_bytes()).hexdigest()}; expected = json.dumps(result, ensure_ascii=False, indent=2) + "\n"; parser = argparse.ArgumentParser(); parser.add_argument("--check", action="store_true"); args = parser.parse_args()
if args.check:
    if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != expected: raise SystemExit("Santa Rosa oracle differs")
else: OUTPUT.write_text(expected, encoding="utf-8", newline="\n")
print("checked" if args.check else "generated", "Santa Rosa oracle")
