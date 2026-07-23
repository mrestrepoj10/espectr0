# Medellín seismic-microzonation research dossier

Status: **historical technical table fully transcribed; municipal activation blocked**.

This folder is evidence only. It adds no engine, registry, route, UI, map, coordinates, polygon, geocoder, or spatial asset. The only future product interaction contemplated here is manual zone selection after legal and technical blockers are resolved.

## Governing conclusion

The locked official record does not support activating a Medellín municipal spectrum in a general building calculator:

- The 1999 study produced 14 homogeneous zones and two curve families.
- Decreto 638 de 1999 attempted to require the study, but the official 2014 POT evaluation says Decreto 143 de 2000 partially repealed it because it lacked approval from the Comisión Asesora Permanente.
- The April 2011 DAP letter is a directive to public/decentralized entities and Empresas Comerciales del Estado. It is not a general adoption decree. Its May 2011 attachment republishes the historical technical content under NSR-10 terminology.
- The official March 2026 POT input identifies a 2019 AMVA/DAGRED/Universidad de los Andes harmonization, but expressly states that the decree adopting the microzonation provisions **has not been adopted**.

Accordingly, this dossier records NSR-10 as the product's governing building workflow and marks every municipal activation path unavailable. A later source can supersede that conclusion only if it supplies the adopted instrument, the required national review/approval, exact current tables and exact current formulas.

## What is proven

The historical DAP table is covered exactly at 14 zones × 2 hazards × 6 fields = 168 direct values. Each value has its own page/row/cell region and the evidence checker proves the exact cross-product. The two labels are:

- control de daños / servicio, 2% damping;
- design, 5% damping.

The source states a maximum valid period of 4 seconds, the plateau ordinate `Smax = Fa × aSmax × I`, the power decay `Sa = Smax × (Tc/T)^α`, and the short-period `Rc` rule. It also states the fill, boundary-strip, unstable-zone and geotechnical soil-profile warnings recorded in the claims matrix.

## Why activation remains blocked

- The four locked primary official sources do not state the return period/probability of either historical hazard.
- Figure 0 draws a rising acceleration branch for `0 < T < T0` but prints no equation. The dossier does not assume linearity.
- No currently adopted municipal substitute to NSR-10 was found; the March 2026 official source says the 2019 harmonization decree remains unadopted.
- The current administrative effect of the public-entity-only 2011 directive is not established.
- The fill and transition provisions refer to an “artículo cuarto del presente decreto” for the detailed/site-specific method, but that article is not present in the locked 24-page support package.

These gaps prevent a complete spectrum, a defensible building-workflow capability, and a merge/activation recommendation.

## Sources and redistribution

All four sources are delivered from official Medellín domains and are fixed by retrieval date, byte length, page count and SHA-256 in `evidence/source-locks.json`. No source bytes or rendered pages are committed because the delivery pages provide no express redistribution license. Independent review must re-download and match every lock.

## Verification

```powershell
node lib/medellin/evidence/generate.mjs --check
python lib/medellin/oracle/generate_oracle.py --check
pnpm evidence:check
pnpm vitest run lib/medellin/evidence/evidence.test.mjs
```

`evidence/review-record.json` remains pending. Even a successful evidence review must not be interpreted as permission to activate the study while the material blockers remain open.
