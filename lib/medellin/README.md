# Medellín seismic-microzonation technical engine and evidence dossier

Status: **source-explicit technical calculation enabled with localized limitations**.

This folder contains a pure normalized engine plus its evidence package. It adds no route, UI, map, coordinates, polygon, geocoder, or spatial asset. A consumer selects one of the 14 homogeneous zones manually and chooses either the design family (5% damping) or damage-control/service family (2% damping).

The engine implements only what the locked official technical support states:

- `Smax = Fa × aSmax × I`;
- `Sa = Smax` for `T0 ≤ T ≤ Tc`;
- `Sa = Smax × (Tc/T)^α` for `Tc < T ≤ 4 s`.

For `T < T0`, `saAt` returns a typed, localized unsupported result because the figure does not print the rising-branch equation. Periods above 4 seconds are likewise outside the published domain. The two municipal return periods remain machine-readable `null`; no national or reference-site value is substituted.

## Administrative adoption context

The locked official record does not establish current adoption as a general municipal substitute for the national building workflow. This factual finding does not gate calculation of the explicitly published technical branches:

- The 1999 study produced 14 homogeneous zones and two curve families.
- Decreto 638 de 1999 attempted to require the study, but the official 2014 POT evaluation says Decreto 143 de 2000 partially repealed it because it lacked approval from the Comisión Asesora Permanente.
- The April 2011 DAP letter is a directive to public/decentralized entities and Empresas Comerciales del Estado. It is not a general adoption decree. Its May 2011 attachment republishes the historical technical content under NSR-10 terminology.
- The official June 2026 POT input, version 3 and published in July, identifies the 2019 AMVA/DAGRED/Universidad de los Andes harmonization and expressly states that the decree adopting the microzonation provisions **has not been adopted**.
- The July 2026 proposed POT article 547 G does not adopt parameters. It says the harmonization results must later be adopted through a separate District administrative act, after approval by the Comisión Asesora Permanente del Régimen de Construcciones Sismo Resistentes.

That administrative history is retained as evidence context, but it is not used as a blanket gate on source-explicit technical computation. The engine does not claim to replace the governing national building workflow and keeps building-workflow capabilities disabled.

## What is proven

The historical DAP table is covered exactly at 14 zones × 2 hazards × 6 fields = 168 direct values. Each value has its own page/row/cell region and the evidence checker proves the exact cross-product. The two labels are:

- control de daños / servicio, 2% damping;
- design, 5% damping.

The source states a maximum valid period of 4 seconds, the plateau ordinate `Smax = Fa × aSmax × I`, the power decay `Sa = Smax × (Tc/T)^α`, and the short-period `Rc` rule. It also states the fill, boundary-strip, unstable-zone and geotechnical soil-profile warnings recorded in the claims matrix.

## Localized limitations

- The six locked primary official sources do not state the return period/probability of either historical hazard.
- Figure 0 draws a rising acceleration branch for `0 < T < T0` but prints no equation. The dossier does not assume linearity.
- The fill and transition provisions refer to an “artículo cuarto del presente decreto” for the detailed/site-specific method, but that article is not present in the locked 24-page support package.

These gaps constrain only the affected interval, metadata, and downstream building workflow. They do not prevent manual-zone calculation over the explicitly published branches.

## Sources, currentness and redistribution

All six sources are delivered from official Medellín domains and are fixed by retrieval date, byte length, page count and SHA-256 in `evidence/source-locks.json`. The two July sources have a deterministic, offline-reproducible region attestation at `evidence/currentness-attestation.json`; the verifier requires caller-supplied external PDFs and Poppler. No source bytes or rendered pages are committed because the delivery pages provide no express redistribution license. Independent review must re-download and match every lock.

## Verification

```powershell
node lib/medellin/evidence/generate.mjs --check
python lib/medellin/oracle/generate_oracle.py --check
pnpm evidence:check
pnpm vitest run lib/medellin/evidence/evidence.test.mjs
pnpm vitest run lib/medellin/engine.test.ts lib/medellin/adapter.test.ts
python lib/medellin/evidence/verify_currentness_pdfs.py --tomo-v3 <external-v3.pdf> --draft-agreement-v3 <external-project.pdf> --pdftoppm <pdftoppm.exe>
```

The evidence dossier's historical adoption assessment remains separate from the engine's source-explicit technical calculation policy.
