import argparse, hashlib, re, unicodedata
from pathlib import Path
from pypdf import PdfReader

LOCKS = {"pbot": (962304, 110, "e3fb9f146c9a00cfecd1faf6f12f61cb44863ffd626e45e3c4121342e15212f8"), "revision": (261815, 14, "16d0c00b293a337d49e51132fc88068a26ec6aad74334c84a2c758e8cd45a346")}
def verify(name, path):
    data = path.read_bytes(); length, pages, digest = LOCKS[name]; assert len(data) == length and hashlib.sha256(data).hexdigest() == digest; reader = PdfReader(path); assert len(reader.pages) == pages; return reader
parser = argparse.ArgumentParser(); [parser.add_argument(f"--{name}", type=Path, required=True) for name in LOCKS]; args = parser.parse_args(); pbot = verify("pbot", args.pbot); revision = verify("revision", args.revision)
compact = lambda text: re.sub(r"\s+", "", unicodedata.normalize("NFC", text).lower())
articles = compact("\n".join((pbot.pages[index].extract_text() or "") for index in [68, 69, 70])); later = compact(revision.pages[1].extract_text() or "")
assert all(compact(token) in articles for token in ["acuerdo No 012", "200m", "investigación Geotécnica", "Aa", "Av", "Am", "An"])
assert all(compact(token) in later for token in ["NRS-10", "microzonificación sísmica", "Acuerdo municipal 012 de 2000"])
print("verified official Santa Rosa sources, warnings and compatibility record")
