# Bogotá D.C. microzonation research dossier

Status: **research dossier merged; pure E2 engine implemented; not activated in the calculator**.

This folder contains the canonical evidence package and its pure spectrum engine. It contains no shared-registry, UI, GIS, export-renderer, or routing change. The product workflow permitted by this dossier is manual selection of one of the 16 published response zones, accompanied by the professional-verification warnings below.

## Pure engine contract

`adapter.ts` exports a municipal-study adapter and an unregistered `SpectrumEngine` compatible with the normalized F2 contract. The engine snapshots its inputs, returns typed invalid and site-specific outcomes, exposes direct `saAt(T)`, and emits a versioned calculation trace whose direct values, formulas, warnings, and applicability claims resolve back to this dossier.

The adapter accepts an explicit importance factor (default `1.0`) for the design and limited-safety expressions; the damage-threshold expression does not use it. The independent Decimal oracle exercises the approved unit-importance spectrum. Rellenos above 3 m and rigid-base periods above 2.5 s fail closed with `site-specific-study-required`. Exact threshold values remain in the tabulated workflow.

The sampled spectrum uses the same evaluator as `saAt(T)` and always includes every tabulated boundary. The direct tabulated boundary selects the left branch exactly; no smoothing or recomputation replaces the rounded published value. Continuity is enforced and tested only at the joins where the approved equations require it.

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
- 32 derived zero-second plateau starts for the design and limited-safety graphs. These are explicitly classified as graphical inferences: the locked regions show the `T(s)` and `Sₐ(g)` axes intersecting at x=147.0 pt and the plateau beginning at x=147.48 pt (within the attested 0.5 pt tolerance). No printed `0` token is claimed; the nearby `0` glyph in `A₀` is recorded and rejected as a false candidate.
- Three levels: design (475 years, 10% in 50 years, 5% damping), limited safety (225 years, 20% in 50 years, 5%), and damage threshold (31 years, 80% in 50 years, 2%).
- Fourteen branch/boundary equations with source-page regions and domains in `formula-inventory.json`.

The published tables round `Tc`, `T0d`, and `Tcd` to two decimals. Recomputing their displayed formulas therefore differs by as much as 0.004736842105263157… s in this matrix, and the largest plateau-to-decay join gap at a tabulated boundary is 0.005 g. The research resolution is deliberate: **the adopted tabulated period selects the branch; the formula-derived period is an audit witness and does not overwrite it**. The independent Decimal oracle records every residual.

## Scope and mandatory warnings

D670 Article 2 makes these provisions mandatory, substitutes NSR-10 A.2.4 and A.2.6 for buildings within A.1.2.3, and prohibits use with NSR-98. Article 5 scopes the three curves to building workflows: design/construction and structural intervention (excluding Title E), A.10 limited-safety evaluation/intervention, and the identified A.12 Group IV/III damage-threshold cases.

Any downstream implementation must show, at minimum:

- Manual zone selection is not a professional site classification. The responsible geotechnical/structural professional must verify the official maps and Title H study.
- In a 100 m zone-transition strip, use the period-dependent average of the adjacent spectra unless a supported reclassification applies.
- A reclassification must be consistent with an adjacent zone or at most one zone away and within 500 m.
- Fills thicker than 3 m and rigid-base periods above 2.5 s require a site-specific response study.
- For building periods above 1.0 s, evaluate soil–building resonance within ±10% of the deposit period.
- Evaluate liquefaction in the settings identified by Article 6, numeral 9.
- Site-specific `Fa`/`Fv` cannot fall below the NSR-10 minimum or 80% of the municipal value; the higher value governs.

The complete exact claim-to-source locator matrix is in `evidence/claims-matrix.json`. GIS/geometry ingestion is intentionally out of scope; this is not a product blocker because the authorized product interaction is explicit manual zone selection.

## Artifacts and verification

- `data/canonical.json`: normalized research dataset, explicitly inactive.
- `evidence/manifest.json`: F3 study with exact table → row → cell provenance.
- `evidence/source-locks.json`: official URL, retrieval date, byte length, and cryptographic hash for all pathless sources.
- `evidence/extraction-profile.json`: render and normalized-coordinate method.
- `evidence/extraction-attestation.json`: locked source hash plus exact table/row/cell token and containment-window evidence; the two graphical origins add a rendered-region hash, five vector-primitive hashes, axis/plateau geometry, and an `A₀` false-candidate guard; legal claims are bound to their source hash, locator, and statement digest.
- `evidence/verify_official_pdf.py`: offline independent verifier that recomputes all 3 table, 48 row, 256 cell, and 2 graphical-origin checks from locally supplied official PDF bytes without vendoring them.
- `evidence/formula-inventory.json` and `evidence/claims-matrix.json`: formula, applicability, and warning citations.
- `evidence/uncertainty-ledger.json`, `conflict-ledger.json`, and `reference-site-differences.json`: unresolved/currentness items and reasoned resolutions.
- `evidence/redistribution.json`: why no source bytes or rendered pages are committed.
- `evidence/review-record.json`: independent review checklist and activation gate.
- `oracle/oracle-input.json`: separate manual transcription, not generated from canonical data.
- `oracle/oracle.json`: 50-digit Decimal witnesses, branch selections, joins, and rounded-boundary residuals.
- `oracle/engine-locks.json` and `oracle/check-engine-oracle.mjs`: pinned canonical/oracle hashes and declared binary64 tolerances.
- `schema.ts`, `engine.ts`, `adapter.ts`, and `evidence.ts`: runtime-validated pure engine, normalized adapter, and fail-closed evidence lineage.

Run from the repository root:

```powershell
node lib/bogota/evidence/generate.mjs --check
python lib/bogota/oracle/generate_oracle.py --check
node lib/bogota/oracle/check-engine-oracle.mjs --check
pnpm evidence:check
pnpm vitest run lib/bogota/evidence/evidence.test.mjs lib/bogota/engine.test.ts
python lib/bogota/evidence/verify_official_pdf.py --pdf C:\path\to\official-fopae-report.pdf
```

The offline verifier is deliberately version-pinned to `pdfplumber==0.11.10`, `pdfminer.six==20260107`, `pypdfium2==5.12.1`, and `Pillow==12.3.0`; a different extraction/render profile fails closed. All source documents are external-only/pathless. Independent review must re-download each official URL and match the committed byte length and SHA-256 before approving activation. The FOPAE report is not bundled because its cover states that total or partial reproduction requires written authorization.
