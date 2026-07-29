# Dosquebradas seismic-microzonation research dossier

Status: **five-zone normalized calculation supported for `To <= T <= TL`; both outside intervals localized as unsupported**.

The official 2024 POT package publishes Table 27 with exact `To`, `Tc`, `TL`, `Aa`, `Fa`, and `Fv` values for five manually selected zones, and its figure states `β=5%`. The same current POT says the CARDER supports remain in force while ordering the municipality to adjust and harmonize the model with NSR-10 within 24 months.

The engine uses the 30 direct Table 27 cells and the installed NSR-10 equations A.2.6-1, A.2.6-2 and A.2.6-3. Because Table 27 omits `Av`, the engine derives it by algebraically inverting A.2.6-2; it never assumes `Av=Aa`. Plateau and inverse branches are available only from the tabulated `To` through `TL`. The official package does not attest equations for either outside interval, so `saAt(T)` returns a typed, localized unsupported outcome for `T < To` and `T > TL`. No inverse-square or flat extrapolation is inferred from the figure.

Table 27 does not declare a municipal return period or probability. The normalized result and JSON export preserve that metadata as `null`; no NSR-10 or reference-calculator value is substituted.

Zone selection is manual and carries a professional-validation warning. No map, coordinate lookup, GIS asset, shared registry or UI integration is included. The official package demonstrates one design hazard; the three-hazard behavior seen on EspectroCol is recorded only as a UX discrepancy and is not imported.

All three official PDFs remain external-only. Their exact URLs, byte lengths, page counts, SHA-256 hashes, page coordinates and extraction attestations are committed. No redistribution permission was inferred.

Run `node lib/dosquebradas/evidence/generate.mjs --check`, `python lib/dosquebradas/oracle/generate_oracle.py --check`, and `npm run evidence:check`. `verify_official_sources.py` additionally re-checks locally supplied official bytes, hashes, page counts, table tokens and applicability clauses.
