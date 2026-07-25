# Cali microzonation research dossier

This directory is a source-locked F3 evidence package for Santiago de Cali's
seismic microzonation. It deliberately contains no product engine, UI, or GIS
selection behavior.

## Governing source and status

Decreto Municipal 411.0.20.0158 of 18 March 2014 adopts the microzonation and
its structural-design curves. Article 12 makes it effective on issuance and
official publication; the scan carries Official Bulletin 038 of 19 March 2014.
Article 55 of Acuerdo 0373 of 2014 directs the municipal administration to
promote and oversee application of the decree and update it when new information
becomes available. Targeted official-source searches found no later repeal or
amendment, but legal status must be rechecked before activation.

All four primary sources are `external-only`: official URLs, byte sizes, page
counts, and SHA-256 hashes are committed; source PDFs are not. For the scanned
decree, every direct coefficient has a normalized rectangle and a SHA-256 of the
raw RGB crop from the single embedded 1280×2080 JPEG. The verification command
requires a locally supplied official PDF:

```powershell
python lib/cali/evidence/verify_official_pdf.py --pdf C:\path\to\documentoId7429.pdf
```

The historical `Ad=0.05g` / ten-year return-period statement is independently
locked to Tomo 6 physical PDF page 147, printed footer 136, and handwritten scan
marker 747. The offline verifier also rejects physical page 136 (footer 125,
marker 736), which contains Zona 4E / Figure 7.9 instead:

```powershell
python lib/cali/evidence/verify_historical_pdf.py --pdf C:\path\to\TOMO6CONVENIO022002.pdf
```

No OCR was used. Values were entered twice against the official scan and the
deterministic crop locks make each review region reproducible.

## Coverage model

The decree describes six macrozones but its coefficient tables enumerate ten
response-zone labels: 1, 2, 3, 4A, 4B, 4C, 4D, 4E, 5, and 6. Zones 4B, 4C,
and 5 each publish two concurrent curves, marked `Tc` and `TL`; Article 5(6)
requires independent structural and drift checks against both. The F3 matrix
therefore uses 13 curve components while canonical metadata exposes only ten
geographic options and the three mandatory pairings.

The direct-source matrix covers 13 components × 3 hazards × 4 source columns:

- design: `Tc`, `Fa`, `TL`, `Fv`;
- limited safety: `Tc`, `Fa`, `TL`, `Fv`;
- damage threshold: `Fv`, `S`, `Tcd`, `TLd`;

That is 156 direct values and 39 canonical rows, backed by 144 distinct source
cells because the damage table has one row per geographic option. Table 6 is not
a fourth hazard: it is a design lower bound for site-specific curves under
Article 7. Its 52 coefficients are preserved in a separately attested ancillary
table. Table 5 contributes ten separately attested surface-design PGA values.
Together, the hazard matrix and ancillary tables lock 206 distinct source cells.
The principal site warnings are also preserved as claims data.

## Activation blocker

The damage-threshold graph defines the early branches with `A0d` and `Fa`, but
Table 4 publishes neither. It only gives `Fv`, `S`, `Tcd`, and `TLd`. The national
NSR-10 curve and the historical 2005 study are not silently substituted: the
formula inventory and independent oracle compute only the supported long-period
branches and block activation of a complete damage spectrum.

The dossier remains `research-only-activation-blocked` until a primary normative
clarification supplies those inputs and an independent reviewer signs the manual
transcription.
