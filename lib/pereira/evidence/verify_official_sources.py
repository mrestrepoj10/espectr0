import argparse, hashlib, re, unicodedata
from pathlib import Path
from pypdf import PdfReader

LOCKS = {"pot": (6271986, 399, "90568117201b668164e38f65550350cbfc51d6a111fc5981fcd463e0b487a90e"), "cap": (769392, 36, "500e8d72facae767884494d2f4e8daf7fc2993c951ad89dde41b70825551c787")}
def verify(name, path):
    data = path.read_bytes(); length, pages, digest = LOCKS[name]; assert len(data) == length and hashlib.sha256(data).hexdigest() == digest; reader = PdfReader(path); assert len(reader.pages) == pages; return reader
parser = argparse.ArgumentParser(); [parser.add_argument(f"--{name}", type=Path, required=True) for name in LOCKS]; args = parser.parse_args(); pot = verify("pot", args.pot); cap = verify("cap", args.cap)
compact = lambda text: re.sub(r"\s+", "", unicodedata.normalize("NFC", text).lower())
pot_text = compact(pot.pages[105].extract_text() or ""); cap_text = compact(cap.pages[3].extract_text() or "")
assert all(compact(token) in pot_text for token in ["NSR-10", "932 de 2011", "nueva microzonificación"])
assert all(compact(token) in cap_text for token in ["aprueba el estudio", "microzonificación sísmica", "Pereira"])
print("verified official Pereira sources and adoption-chain statements")
