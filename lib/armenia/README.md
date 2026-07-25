# Armenia seismic-microzonation research dossier

Status: **regulatory chain researched; municipal activation blocked**.

This folder contains evidence only. It adds no engine, adapter, registry, route, UI, map, coordinates, polygons, geocoder, address lookup or spatial asset. There is no municipal selector to register.

## Governing conclusion

The official sources do not establish an adopted, current, NSR-10-harmonized Armenia spectrum:

- The historical Decreto 079 de 2000 was framed against NSR-98. Its official bytes and full technical annex were not located, so no historical coefficient or equation is transcribed from a third-party mirror.
- The Comisión Asesora Permanente stated in 2019 that Armenia's prior studies had to be updated and harmonized with NSR-10.
- A new study was delivered in December 2025, but the official delivery notice says Commission approval and municipal decree adoption were still pending.
- The municipal decree index snapshot checked on 25 July 2026 contains no microzonation entry. That absence is explicitly treated as non-exhaustive corroboration, never as proof.

Therefore the exact current zones, hazards, return periods, damping, coefficients, formulas, branch limits, site-specific rules and building compatibility remain unavailable. The reference site's model is not demonstrated applicable.

## Coverage semantics

The F3 manifest covers exactly `1 × 1 × 1` for the **regulatory status**, not for a spectrum: Armenia citywide × regulatory-status × activation-status. Its direct value is the exact official sentence saying Commission approval and municipal-decree officialization remain pending; the canonical dossier separately normalizes that to `blocked-pending-commission-approval-and-municipal-decree`.

The proposed spectrum matrix is intentionally and exactly empty (`0` options, `0` hazards, `0` rows). This is not missing evidence disguised as coverage. It is the fail-closed product decision required by the primary-source gap. `claims-matrix.json` separately reports 100% citation coverage for the four applicability conclusions and four warnings. The formula inventory contains zero proposed production formulas and explicitly blocks activation.

## Mandatory product behavior

- Keep Armenia in the national NSR-10 workflow.
- Do not activate the historical or delivered-2025 municipal model.
- Do not infer a zone from a map, coordinates, address or GIS.
- If a future adopted study is installed, zone selection must remain manual and the responsible professional must validate it against the adopted source.
- Artificial-fill construction remains subject to the official geotechnical-study warning recorded in the POT support.

## Sources and redistribution

All five sources are official and external-only. Their URL, retrieval date, byte length, page count and SHA-256 are locked. No source bytes or rendered pages are committed because no express redistribution license was found. `extraction-attestation.json` binds six statements/absence checks to source hashes, pages, rectangles or HTML lines and statement digests.

## Verification

```powershell
node lib/armenia/evidence/generate.mjs --check
python lib/armenia/oracle/generate_oracle.py --check
pnpm evidence:check
pnpm vitest run lib/armenia/evidence/evidence.test.mjs
python lib/armenia/evidence/verify_official_sources.py `
  --acta153 C:\path\to\acta-153.pdf `
  --acuerdo019 C:\path\to\acuerdo-019-2009.pdf `
  --pot-volume C:\path\to\pot-vol-4b.pdf `
  --delivery-html C:\path\to\delivery-2025.html `
  --decree-index-html C:\path\to\decrees-index-2026.html
```

`review-record.json` remains pending. Even a successful evidence review must not be interpreted as permission to activate Armenia while any material blocker remains open.
