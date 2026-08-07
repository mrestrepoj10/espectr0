# Proposal: digitize the CCP-14 hazard maps to get per-city PGA, Ss and S1

Status: **proposal, not activated.** Nothing in this directory feeds the
calculator. It asks for a decision and a reviewer before any value ships.

## Why this exists

CCP-14 3.10.2.1 tells the designer to read PGA, Ss and S1 off Figuras
3.10.2.1-1 a 3.10.2.1-3 and interpolate linearly between contours. Unlike
NSR-10, whose Apéndice A-4 publishes a municipality table, the CCP-14 package
publishes no locality registry and no locality-to-coefficient table — the
16-PDF, 1,503-page official ZIP contains contour maps and nothing machine
readable. Commentary C3.10.2.1 promises a CD and web tools that were never
published.

So the calculator asks the engineer for the three coefficients. That is correct
but it is the least pleasant part of the form, and it is the one place where a
typo silently changes every number downstream.

The only honest way to remove that step is to digitize the contours ourselves
and say plainly that we did. This proposal scopes that work.

## What is being proposed

Extract the contour geometry from the three official figures, georeference it,
and evaluate the coefficient at a set of populated places. Publish the result
as **a digitization by espectr0, not as an official dataset**, alongside the
uncertainty it carries.

### Non-goals

- Not a claim that INVÍAS publishes a locality table. It does not.
- Not arbitrary coordinates, addresses, or a GIS lookup surface. A finite,
  reviewed list of places only.
- Not a replacement for the manual entry path. Manual entry stays, and stays
  the default for any site not on the list, for entity-approved special maps,
  and for anyone who disagrees with a digitized value.
- Not a substitute for the site-specific procedure of 3.10.2.2.

## Why the obvious shortcut does not work

The unmerged `codex/ccp14-city-map-values` branch hardcodes 32 city triples read
by eye. That approach fails on inspection of the figures:

- The circled numbers label **contour bands, not places**. A marker near a city
  is not that city's value; the band has to be traced.
- Spot checks disagree with the nearest markers: Bucaramanga is claimed región 4
  where the adjacent markers are 5 and 11; Cúcuta is claimed 11 where the
  adjacent marker is 10; Tunja is claimed 5 where the adjacent marker is 4.
- Four markers are **physically overprinted by their own city label** —
  Valledupar, Santa Marta, Cartagena, Sincelejo — and cannot be read at any
  magnification.
- Cúcuta has no plotted dot at all, only a label placed east of the border.

Reading harder does not fix any of this. Tracing the contours does.

## Method

1. **Georeference each figure.** Fit pixel → (longitude, latitude) from the
   graticule. *Already measured — see below.*
2. **Extract contour polylines.** Separate the thin grey contour strokes from
   the heavy black coastline, borders, city dots and labels; vectorize.
3. **Assign a value to every contour.** Seed from the circled región markers,
   which are legible where they are not overprinted, and propagate by
   adjacency: crossing one contour steps exactly one legend row. This is what
   makes the overprinted markers survivable — a band's value is recoverable
   from its neighbours even when its own marker is unreadable.
4. **Close the bands.** Build polygons from the contour set plus the national
   boundary, and check every band is bounded and single-valued.
5. **Sample the places.** Point-in-polygon at coordinates taken from an
   official gazetteer (DANE or IGAC), hash-locked like every other source.
   Report the band value and the distance to the nearest contour.
6. **Cross-check.** Compare against the figure's own labelled places, against
   the NSR-10 Aa/Av spatial pattern (shape agreement only, different return
   period so values must not match), and against Apéndice C3's stated zone
   counts.

## Measured feasibility of step 1

`georeference.py` is runnable now. It verifies the Section 3 PDF against the
locked hash `55f53d68…`, renders each figure at scale 5, detects the graticule,
and fits pixels per degree. Measured output (`georeference-report.json`):

| Figure | Page | Meridian fit | Parallel fit | Axis agreement | Ground sampling |
| --- | --- | --- | --- | --- | --- |
| PGA | 51 | 0.46 px rms, 0.97 px max | 0.28 px rms, 0.68 px max | 0.01 % | 669 m/px |
| Ss | 52 | 0.45 px rms, 0.84 px max | 0.42 px rms, 0.98 px max | 0.17 % | 664 m/px |
| S1 | 53 | 0.43 px rms, 0.94 px max | 1.97 px rms, 7.87 px max | 0.01 % | 669 m/px |

Reading this:

- Longitude and latitude scales agree to within 0.17 %, so the projection is
  equirectangular and pixel → lon/lat is a plain affine with no reprojection.
- Meridians fit to **under half a pixel rms** on all three figures — about
  300 m on the ground, far below any contour's own width.
- One horizontal on S1 survives rejection with a 7.9 px residual (≈ 5 km). It
  is a map feature, not a graticule rule. Worth pinning down, but it does not
  move the fitted scale, which matches PGA to 0.002 %.
- Rendering higher than scale 5 costs nothing and improves sampling linearly.

**Georeferencing is not where the risk lives.** Steps 2–5 are.

## Acceptance criteria

Ship nothing unless all of these hold:

1. Every extracted contour carries a legend value derived from at least one
   legible región marker, with the propagation path recorded.
2. Bands reconstruct the legend exactly: 11 PGA regions (0.05–0.55), 13 Ss
   regions (0.10–1.30), 14 S1 regions (0.05–0.70) as printed on the figures.
3. Every sampled place reports its distance to the nearest contour. Anything
   inside one contour width is flagged as indeterminate and falls back to
   manual entry rather than guessing a side.
4. San Andrés y Providencia reproduces 0.05 / 0.10 / 0.05 — the one location
   the figures assign directly, so it is a free correctness check on the whole
   pipeline.
5. The pipeline is offline, deterministic, and rerunnable from the locked PDF
   bytes by a reviewer with no network access.
6. A bridge-seismic reviewer signs off, as `research/review-record.json`
   requires. This is the gate, not a formality.

## Known failure modes

| Risk | Severity | Handling |
| --- | --- | --- |
| Contours run into coastlines and borders and vectorize as one stroke | High | Separate on stroke weight and colour before vectorizing; visually diff every extracted band against the render |
| An overprinted marker leaves a band unseeded and unreachable by adjacency | Medium | Report the band as indeterminate; those places fall back to manual entry |
| City coordinates disagree between gazetteers | Medium | Lock one official source; record the coordinate with the value |
| A city sits within one contour width of a boundary | Medium | Flag as indeterminate — 3.10.2.1 requires interpolation there anyway |
| Users read digitized values as official | **Critical** | Label every digitized value in the UI, the memoria and the export; never present it as a source-locked coefficient |
| Apéndice C3 disagrees with the printed legends on Ss and S1 zone counts | Low | Already recorded as an unresolved conflict; follow the legends |

## What would change in the product

If accepted and reviewed, the location selector gains a third state. Today it is
either "assigned by the figure" (San Andrés only) or "read it yourself". It
would gain "digitized by espectr0" — prefilling the three coefficients, marked
distinctly from source-locked values, editable, and printed in the memoria as a
digitization with its method, its distance-to-contour and its reviewer.

If rejected, the map location selector stays exactly as it is and the
coefficients stay manual. That is a defensible product either way, which is why
this is a proposal rather than a branch waiting to merge.

## Estimate

Steps 2–5 are the work; step 1 is done. The contour separation in step 2 is the
part that could go badly and is worth prototyping on the PGA figure alone before
committing to all three. Expect the review in criterion 6 to be the long pole.

## Reproducing the measurement

The official PDFs are external-only and are not committed. Download the CCP-14
ZIP from INVÍAS portal file ID 29584, extract the Section 3 member, then:

```
pip install pypdfium2 numpy pillow
python lib/ccp14/research/map-digitization/georeference.py \
  --section3 "path/to/SECCION 3 - CARGAS Y FACTORES DE CARGA.pdf"
```

The script refuses to run if the file does not match the locked hash.
