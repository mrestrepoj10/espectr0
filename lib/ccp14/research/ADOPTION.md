# CCP-14 adoption and currentness analysis

## Controlling adoption instrument

INVÍAS Resolution 0000108 of 26 January 2015 adopts the attached *Norma Colombiana de Diseño de Puentes CCP-2014* for studies, design, construction, and maintenance of bridges on the National Road Network under INVÍAS responsibility. Article 2 makes the resolution effective upon publication and repeals contrary provisions, expressly including Resolution 3600 of 1996. The instrument was published in *Diario Oficial* No. 49,406 on 26 January 2015.

The resolution and the official CCP-14 archive are treated as separate locked sources: the first establishes applicability; the latter supplies the technical clauses and tables. Both current INVÍAS download endpoints returned HTTP 404 during this research. Archived captures were used only to transport bytes originally published by INVÍAS. Hashes, byte counts, capture timestamps, and original official URLs are recorded in `source-locks.json`.

The official MinTransporte catalog also publishes Resolution 0000108/2015 as three RAR volumes. Those official bytes reconstruct a 60,041,340-byte, 1,551-page scanned resolution-and-annex PDF (SHA-256 `084c6223291dd2db9458210ae675693b001a7aa790f92fa7163112442621c5bb`). This ministerial package is now locked alongside the two-page INVÍAS resolution and the later 16-PDF INVÍAS technical ZIP.

The ministerial scan and later INVÍAS technical ZIP are not byte- or page-equivalent: the ZIP is 40,260,753 bytes, totals 1,503 PDF pages, and presents a different pagination/revision package. No authoritative publication found in this research reconciles those differences or identifies which differences are adopted text versus later editorial packaging. Archived captures were used only to transport bytes originally published by INVÍAS; MinTransporte RAR bytes came from its current official catalog. Hashes, byte counts, reconstruction details, and original official URLs are recorded in `source-locks.json`.

## Edition, amendments, and currentness

The adopted edition is CCP-2014/CCP-14. No adopted erratum, amendment, circular, or later official edition resolving the Section 3 seismic passages was found in searches of INVÍAS, MinTransporte, or SUIN on 22 July 2026. Recent official ANI project documents continue to list CCP-2014 as applicable, which is corroborative current-use evidence rather than the adoption authority.

MinTransporte's projects page listed a public-consultation proposal dated 9-24 April 2026 to modify Section 13 (barriers). It is not evidence of a final adopted instrument, does not modify Section 3, and is therefore recorded only as a nonbinding proposal.

## Scope and limits

The seismic procedure researched here applies to bridges governed by CCP-14. It must not be presented as the NSR-10 building base-shear procedure. The contracting entity classifies the bridge as critical, essential, or other and may require higher performance or a site-specific hazard procedure.

Three material issues prohibit activation:

1. The MinTransporte resolution-and-annex scan and the later INVÍAS technical ZIP differ in bytes, total pages, pagination, and revision presentation, without an authoritative reconciliation of their relationship.
2. Figure 3.10.4.1-1 states `T0 = 0.2 Ts`; the text definition states that `T0` equals `0.2 seconds`. The ministerial scan independently repeats the conflict on physical pages 117-118 (printed 3-67 to 3-68). No official resolution of the contradiction was found.
3. C3.10.2.1 says exact `PGA`, `Ss`, and `S1` values would be available on a CD and web tools. The ministerial scan repeats that promise on physical page 107 (printed 3-57) but contains no attachment or link, and the official 16-file ZIP contains PDFs only. Neither package supplies a finite source-backed locality registry or exact locality table.

Accordingly, this dossier is research-only, must remain in a draft PR, and must not be merged into an activated calculator until the publication relationship, the `T0` conflict, and the missing selectable dataset are authoritatively resolved and independently reviewed.
