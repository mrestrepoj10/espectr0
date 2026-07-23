# CCP-14 adoption and currentness analysis

## Controlling adoption instrument

INVÍAS Resolution 0000108 of 26 January 2015 adopts the attached *Norma Colombiana de Diseño de Puentes CCP-2014* for studies, design, construction, and maintenance of bridges on the National Road Network under INVÍAS responsibility. Article 2 makes the resolution effective upon publication and repeals contrary provisions, expressly including Resolution 3600 of 1996. The instrument was published in *Diario Oficial* No. 49,406 on 26 January 2015.

The resolution and the official CCP-14 archive are treated as separate locked sources: the first establishes applicability; the latter supplies the technical clauses and tables. Both current INVÍAS download endpoints returned HTTP 404 during this research. Archived captures were used only to transport bytes originally published by INVÍAS. Hashes, byte counts, capture timestamps, and original official URLs are recorded in `source-locks.json`.

## Edition, amendments, and currentness

The adopted edition is CCP-2014/CCP-14. No adopted erratum, amendment, circular, or later official edition resolving the Section 3 seismic passages was found in searches of INVÍAS, MinTransporte, or SUIN on 22 July 2026. Recent official ANI project documents continue to list CCP-2014 as applicable, which is corroborative current-use evidence rather than the adoption authority.

MinTransporte's projects page listed a public-consultation proposal dated 9-24 April 2026 to modify Section 13 (barriers). It is not evidence of a final adopted instrument, does not modify Section 3, and is therefore recorded only as a nonbinding proposal.

## Scope and limits

The seismic procedure researched here applies to bridges governed by CCP-14. It must not be presented as the NSR-10 building base-shear procedure. The contracting entity classifies the bridge as critical, essential, or other and may require higher performance or a site-specific hazard procedure.

Two material issues prohibit activation:

1. Figure 3.10.4.1-1 states `T0 = 0.2 Ts`; the text definition on the same official page states that `T0` equals `0.2 seconds`. No official resolution of the contradiction was found.
2. C3.10.2.1 says exact `PGA`, `Ss`, and `S1` values would be available on a CD and web tools, but the official 16-file ZIP contains PDFs only. It contains continuous contour maps, not a finite source-backed locality registry or exact locality table.

Accordingly, this dossier is research-only, must remain in a draft PR, and must not be merged into an activated calculator until both issues are authoritatively resolved and independently reviewed.
