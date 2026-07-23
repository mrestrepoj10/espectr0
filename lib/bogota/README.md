# Bogotá D.C. microzonation research dossier

Status: **research complete; independent review pending; not activated in the calculator**.

This folder is an evidence package only. It contains no spectrum-engine, registry, UI, GIS, or routing change. The product workflow permitted by this dossier is manual selection of one of the 16 published response zones, accompanied by the professional-verification warnings below.

## Controlling legal chain

The current controlling text is [Decreto Distrital 670 de 2025](https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?dt=S&i=191905), Title 1, Articles 2–10. Its Article 1526 expressly repeals the compiled [Decreto Distrital 523 de 2010](https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=40984) (item 50), while Articles 1520–1522 preserve consolidated effects and motivations and Article 1525 preserves the microzonation maps as annexes.

Accordingly:

- D670/2025 is cited as the active instrument.
- D523/2010 is cited as the historical adoption origin, not as a second active rule.
- The [FOPAE final technical report](https://backbiblio.sire.gov.co/server/api/core/bitstreams/fa01603a-e5d2-454d-96b0-07f8a73f0d35/content) is the technical source for the legible tables and equations.
- Compilation is not described as a new technical study or technical supersession. The current title carries the D523 origin annotations and retains the same numeric coefficient tables and curve families, with administrative updates such as IDIGER/SIRE and the current planning cross-reference.

No amendment annotation was observed on D670 Title 1 Articles 2–10 in the official text retrieved on 2026-07-22. Because SISJUR is dynamic, currentness must be rechecked at activation.

## Covered matrix and formulas

The canonical research matrix covers exactly 16 zones × 3 hazard levels × 6 semantic fields = 288 values:

- 256 exact direct cell transcriptions from physical PDF pages 155–157 (printed pages 139–141).
- 32 derived zero-second plateau starts for the design and limited-safety graphs.
- Three levels: design (475 years, 10% in 50 years, 5% damping), limited safety (225 years, 20% in 50 years, 5%), and damage threshold (31 years, 80% in 50 years, 2%).
- Fourteen branch/boundary equations with exact page coordinates and domains in `formula-inventory.json`.

The published tables round `Tc`, `T0d`, and `Tcd` to two decimals. Recomputing their displayed formulas therefore differs by as much as 0.004736842105263157… s in this matrix, and the largest plateau-to-decay join gap at a tabulated boundary is 0.005 g. The research resolution is deliberate: **the adopted tabulated period selects the branch; the formula-derived period is an audit witness and does not overwrite it**. The independent Decimal oracle records every residual.

## Scope and mandatory warnings

D670 Article 2 makes these provisions mandatory, substitutes NSR-10 A.2.4 and A.2.6 for buildings within A.1.2.3, and prohibits use with NSR-98. Article 5 scopes the three curves to building workflows: design/construction and structural intervention (excluding Title E), A.10 limited-safety evaluation/intervention, and the identified A.12 Group IV/III damage-threshold cases.

Any downstream implementation must show, at minimum:

- Manual zone selection is not a professional site classification. The responsible geotechnical/structural professional must verify the official maps and Title H study.
- In a 100 m zone-transition strip, use the period-dependent average of the adjacent spectra unless a supported reclassification applies.
- A reclassification must be consistent with an adjacent zone or at most one zone away and within 500 m.
- Fills thicker than 3 m and rigid-base periods above 2.5 s require a site-specific response study.
- For building periods above 1.0 s, evaluate soil–building resonance within ±10% of the deposit period.
- Evaluate liquefaction in the settings identified by Article 8.
- Site-specific `Fa`/`Fv` cannot fall below the NSR-10 minimum or 80% of the municipal value; the higher value governs.

The complete exact claim-to-source locator matrix is in `evidence/claims-matrix.json`. GIS/geometry ingestion is intentionally out of scope; this is not a product blocker because the authorized product interaction is explicit manual zone selection.

## Artifacts and verification

- `data/canonical.json`: normalized research dataset, explicitly inactive.
- `evidence/manifest.json`: F3 study with exact table → row → cell provenance.
- `evidence/source-locks.json`: official URL, retrieval date, byte length, and cryptographic hash for all pathless sources.
- `evidence/extraction-profile.json`: render and normalized-coordinate method.
- `evidence/formula-inventory.json` and `evidence/claims-matrix.json`: formula, applicability, and warning citations.
- `evidence/uncertainty-ledger.json`, `conflict-ledger.json`, and `reference-site-differences.json`: unresolved/currentness items and reasoned resolutions.
- `evidence/redistribution.json`: why no source bytes or rendered pages are committed.
- `evidence/review-record.json`: independent review checklist and activation gate.
- `oracle/oracle-input.json`: separate manual transcription, not generated from canonical data.
- `oracle/oracle.json`: 50-digit Decimal witnesses, branch selections, joins, and rounded-boundary residuals.

Run from the repository root:

```powershell
node lib/bogota/evidence/generate.mjs --check
python lib/bogota/oracle/generate_oracle.py --check
pnpm evidence:check
pnpm vitest run lib/bogota/evidence/evidence.test.mjs
```

All source documents are external-only/pathless. Independent review must re-download each official URL and match the committed byte length and SHA-256 before approving activation. The FOPAE report is not bundled because its cover states that total or partial reproduction requires written authorization.
