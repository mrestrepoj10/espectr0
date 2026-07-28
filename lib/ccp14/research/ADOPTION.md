# CCP-14 adoption and currentness analysis

## Controlling adoption instrument

INVÍAS Resolution 0000108 of 26 January 2015 adopts the attached *Norma Colombiana de Diseño de Puentes CCP-2014* for studies, design, construction, and maintenance of bridges on the National Road Network under INVÍAS responsibility. Article 2 makes the resolution effective upon publication and repeals contrary provisions, expressly including Resolution 3600 of 1996. The instrument was published in *Diario Oficial* No. 49,406 on 26 January 2015.

The resolution and the official CCP-14 archive are treated as separate locked sources: the first establishes applicability; the latter supplies the technical clauses and tables. On 28 July 2026 the migrated INVÍAS portal served both assets directly. Current file ID `29585` reproduces the locked 564,302-byte resolution PDF exactly, and current file ID `29584` reproduces the locked 40,260,753-byte technical ZIP exactly. The current URLs, catalog records, hashes, byte counts, and legacy URLs are recorded in `source-locks.json` and `invias-portal-audit.json`.

The product source policy follows the assets currently published by INVÍAS. The official MinTransporte catalog also publishes Resolution 0000108/2015 as three RAR volumes; those bytes reconstruct a 60,041,340-byte, 1,551-page scanned resolution-and-annex PDF (SHA-256 `084c6223291dd2db9458210ae675693b001a7aa790f92fa7163112442621c5bb`). That package remains locked as corroborating provenance only and does not override the current INVÍAS technical ZIP.

The ministerial scan and INVÍAS technical ZIP are not byte- or page-equivalent: the ZIP totals 1,503 PDF pages and presents a different pagination/revision package. No publication found reconciles their editorial relationship. For this product that question is non-blocking because the current INVÍAS catalog is the controlling technical source; the discrepancy remains documented and no MinTransporte-only value is used.

## Edition, amendments, and currentness

The adopted edition is CCP-2014/CCP-14. The current INVÍAS catalog audit on 28 July 2026 found the 2015 resolution and CCP-14 ZIP, but no adopted erratum, amendment, circular, or later official edition resolving the Section 3 seismic passages. INVÍAS's 28 May 2024 expert-panel publication describes proposed future updates, not an adopted replacement. Recent official project documents continue to list CCP-2014 as applicable, which is corroborative current-use evidence rather than the adoption authority.

MinTransporte's projects page listed a public-consultation proposal dated 9-24 April 2026 to modify Section 13 (barriers). It is not evidence of a final adopted instrument, does not modify Section 3, and is therefore recorded only as a nonbinding proposal.

## Scope and limits

The seismic procedure researched here applies to bridges governed by CCP-14. It must not be presented as the NSR-10 building base-shear procedure. The contracting entity classifies the bridge as critical, essential, or other and may require higher performance or a site-specific hazard procedure.

Two material issues prohibit activation:

1. Figure 3.10.4.1-1 states `T0 = 0.2 Ts`; the text definition states that `T0` equals `0.2 seconds`. Both readings occur on the same page of the controlling INVÍAS Section 3 PDF. No INVÍAS erratum or adopted correction resolving the contradiction was found.
2. C3.10.2.1 says exact `PGA`, `Ss`, and `S1` values would be available on a CD and web tools, but the current INVÍAS publication contains only the 16 PDFs. It supplies national contour maps, not a finite source-backed locality registry or exact locality table. A no-GIS municipality selector cannot be synthesized from those maps.

Accordingly, this dossier remains research-only and must not activate a calculator until the `T0` conflict and the location-input policy are authoritatively resolved and independently reviewed. The MinTransporte/INVÍAS package mismatch is retained as a provenance caveat, not as a product activation blocker.
