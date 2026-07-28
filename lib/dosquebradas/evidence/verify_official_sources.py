import argparse, hashlib, re, unicodedata
from pathlib import Path
from pypdf import PdfReader

LOCKS = {
    "agreement": (266794107, 505, "d32475535e6065d2d99663ce95f046cde066c3c8e9b880e215dcd23ce9e3f047"),
    "diagnosis": (26453877, 395, "cf4608f280c14e430eee91da224c5e61e9601a09103ad3f4b8767d5cd632ad66"),
    "dts": (32411439, 228, "2060d4626bcd2b94af6e2a7401a2a3075b8d750e01397bf18a1d372d6cb24d15"),
}
def verify(name, path):
    data = path.read_bytes(); length, pages, digest = LOCKS[name]
    assert len(data) == length and hashlib.sha256(data).hexdigest() == digest
    reader = PdfReader(path); assert len(reader.pages) == pages
    return reader
parser = argparse.ArgumentParser(); [parser.add_argument(f"--{name}", type=Path, required=True) for name in LOCKS]; args = parser.parse_args()
agreement = verify("agreement", args.agreement); diagnosis = verify("diagnosis", args.diagnosis); dts = verify("dts", args.dts)
table = diagnosis.pages[110].extract_text() or ""; expected = ["0.05", "0.32", "0.25", "1.60", "1.76", "1.67", "2.57", "2.93", "1.17", "2.67"]
assert all(token in table for token in expected)
compact = lambda text: re.sub(r"\s+", "", unicodedata.normalize("NFC", text).lower())
clause = compact(dts.pages[123].extract_text() or ""); assert all(compact(token) in clause for token in ["permanecen vigentes", "24", "NSR-10"])
print("verified official Dosquebradas sources, table and applicability clauses")
