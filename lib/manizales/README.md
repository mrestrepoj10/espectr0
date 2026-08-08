# Manizales seismic-microzonation dossier

Status: **three-zone normalized calculation supported for the whole curve**.

## What changed

This dossier was previously blocked. The stated reason was that the official
copy of the 2002 Uniandes report "omits Figura 8.5, which the text says carries
the A/B/C equations and charts". That was true of the *text volume*. The report
ships in two volumes, and the figures volume — `informe_final_figuras.pdf`,
served from the same official UNAL/IDEA directory as the text volume, whose
bytes are identical to the previously locked copy — carries Figura 8.5 on
physical page 201 with a real text layer, and the Figura 8.1 plate on page 197.

The blocker was a missing file, not a missing model.

## The model

Figura 8.5 prints seven parameters for each of three zones:

| | Zona A · cenizas | Zona B · rellenos | Zona C · rocas y depósitos delgados |
|---|---|---|---|
| To | 0.10 | 0.10 | 0.10 |
| Tc | 0.65 | 0.50 | 0.50 |
| TL | 3.25 | 2.50 | 2.50 |
| Am | 0.44 | 0.40 | 0.30 |
| An | 0.44 | 0.40 | 0.30 |
| Fa | 1.00 | 1.00 | 1.00 |
| Fv | 1.63 | 1.25 | 1.25 |

The Figura 8.1 plate prints all four branches — `Sa = Am + (Am/To)(2.5Fa − 1)T`,
`Sa = 2.5·Am·Fa`, `Sa = An·Fv/T` and `Sa = Am/2` — so unlike Dosquebradas or
Medellín this engine has no unsupported interval: every parameter the printed
branches consume is tabulated. Damping is 5% of critical at ground surface.

For Zone A the printed `Tc` and `TL` are rounded to the hundredth, so the
published curve steps by about 0.3% at each limit. Zones B and C join exactly.
The transcription governs; the rounding is recorded in the conflict ledger and
asserted by the oracle's `continuity` block rather than smoothed away.

## Decisions worth reading before trusting the output

- **Importance coefficient.** Figura 8.5 prints the spectrum without `I`. The
  engine multiplies by it under design consideration (a), which makes the
  recommendations complementary to the national code and forbids taking any
  requirement below it. At `I = 1.00` the curve is exactly the published one,
  and `I` appears as its own cited trace step.
- **Return period.** Chapter 8 declares none for the design spectra. The result
  keeps it `null` and warns; no national value is substituted.
- **Topographic amplification.** The plate prints `Ftop` for sites near slope
  crests. This engine does not know the slope height or the distance to its
  edge, so it does not apply it — and says so.
- **Zone C.** Consideration (f) requires the geotechnical engineer to justify
  Zone C explicitly. Selecting it raises a warning in both the rail and the
  result. Consideration (e) puts structures at or above 2.0 s outside the
  study's scope; the curve is still drawn, with a warning from that period on.
- **Zone selection is manual.** No map lookup, no coordinates, no GIS. The
  drawer serves the 1:30000 plate so the choice can be checked by eye, and the
  study's own rule applies: when in doubt, use Zone A.

## Later models

A 2014 NSR-10 harmonization and a 2015 update replace the three zones with a
point-wise `Fa`/`Fv` surface over 1275 nodes. Neither publishes a reproducible
table, and the UNGRD copies were unreachable at the last check. They are not
installed. If one is adopted and published as a table, it supersedes this study
— it does not silently amend it.

## Reference-site divergence

EspectroCol offers five Manizales zones (Roca y Ladera Roca, Suelo Residual,
Depósitos de Ladera, Planicie Aluvial, Rellenos Antrópicos) whose parameters
match no column of Figura 8.5 — its `Am` values run 0.20–0.25 against the
study's 0.30–0.44. It also serves this very parameter sheet as its Manizales
map, so its own displayed source does not carry the coefficients its calculator
returns. Recorded in `reference-site-differences.json`; nothing is imported.

## Redistribution

All three sources stay `external-only`. Two rendered pages of the figures
volume are committed under `public/manizales/` so the drawer can draw each
attested rectangle on the page that prints the value; the exception is scoped
in `redistribution.json` with `permissionStatus: "not-established"`.

## Reproducing

```text
node lib/manizales/evidence/generate.mjs --check
python lib/manizales/oracle/generate_oracle.py --check
npm run evidence:check
python lib/manizales/evidence/verify_official_sources.py \
  --report informe_final.pdf --figures informe_final_figuras.pdf --nsr10 nsr10-titulo-a.pdf
```

The last one needs the official bytes on disk: it re-checks lengths, hashes and
page counts against the locks, then re-reads all 21 cells, the four branches,
the design considerations and the selection procedure out of them.
