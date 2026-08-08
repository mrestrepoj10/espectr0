import argparse, hashlib, re, unicodedata
from pathlib import Path
from pypdf import PdfReader

LOCKS = {
    "report": (868103, 160, "2e8c2c752f657899bf0240292f9e390f70c41fc87af8355b65f3a12fdfb3a799"),
    "figures": (38939870, 201, "fbcfa673a0657f9efa673dec74ebaffd80697ff659a25b89a92f6ad342708a69"),
    "nsr10": (3486413, 206, "47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0"),
}
COMPACT = lambda text: re.sub(r"\s+", "", unicodedata.normalize("NFC", text).lower())

def verify(name, path):
    data = path.read_bytes(); length, pages, digest = LOCKS[name]
    assert len(data) == length and hashlib.sha256(data).hexdigest() == digest, f"{name} bytes differ from the lock"
    reader = PdfReader(path); assert len(reader.pages) == pages, f"{name} page count differs from the lock"
    return reader

parser = argparse.ArgumentParser(); [parser.add_argument(f"--{name}", type=Path, required=True) for name in LOCKS]
args = parser.parse_args()
report = verify("report", args.report); figures = verify("figures", args.figures); nsr10 = verify("nsr10", args.nsr10)

# Figura 8.5 — the 21 printed cells, column by column.
sheet = figures.pages[200].extract_text() or ""
for row, tokens in [
    ("To", ["0.10", "0.10", "0.10"]),
    ("Tc", ["0.65", "0.50", "0.50"]),
    ("TL", ["3.25", "2.50", "2.50"]),
    ("Am", ["0.44", "0.40", "0.30"]),
    ("An", ["0.44", "0.40", "0.30"]),
    ("Fa", ["1.00", "1.00", "1.00"]),
    ("Fv", ["1.63", "1.25", "1.25"]),
]:
    line = next(l for l in sheet.splitlines() if l.strip().startswith(row))
    assert line.split()[1:4] == tokens, f"Figura 8.5 row {row} differs: {line!r}"
assert COMPACT("Amortiguamiento") in COMPACT(sheet) and "5%" in sheet

# Figura 8.1 — the four branches, the branch limits and the design considerations.
# The plate is a rotated CAD export, so the equation glyphs come out of the
# content stream in drawing order ("AmFaSa 5.2=" for Sa = 2.5AmFa). Match the
# operand clusters, which survive that reordering.
plate = COMPACT(figures.pages[196].extract_text() or "")
for token in ["AmFa", "AnFv", "AmSa", "ToTcTL", "ZONAA-CENIZAS", "ZONAB-RELLENOS", "1:30000"]:
    assert COMPACT(token) in plate, f"Figura 8.1 is missing {token}"
for token in [
    "son complementarias a las dadas en las Normas Colombianas",
    "en ningún caso podrá tomarse un requisito inferior",
    "amortiguamiento con respecto al crítico del 5%",
    "mayores o iguales a 2.0 seg deben adelantarse análisis sísmicos especiales",
    "Zona C, Terreno firme, deberá ser justificada",
]:
    assert COMPACT(token) in plate, f"Design consideration missing: {token}"

# The report volume carries the selection procedure the drawer cites.
procedure = COMPACT(report.pages[156].extract_text() or "")
for token in ["se deberán utilizar los espectros correspondientes a la Zona A", "de acuerdo con las Figuras 8.5"]:
    assert COMPACT(token) in procedure, f"Selection procedure missing: {token}"

importance = COMPACT(nsr10.pages[41].extract_text() or "")
assert all(COMPACT(token) in importance for token in ["1.50", "1.25", "1.10", "1.00"])
print("verified official Manizales sources, the 21 cells of Figura 8.5, the four branches and the design considerations")
