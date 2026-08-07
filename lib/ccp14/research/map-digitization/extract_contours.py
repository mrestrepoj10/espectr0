"""Steps 2 and 3 of the digitization: extract the contours, then try to close them.

Step 1 (georeference.py) established that pixel to longitude/latitude is exact.
This script goes further and measures whether the contour field extracted from
the raster is topologically usable, which is what deciding a city's band
actually requires.

It is a measurement, not a value producer. It deliberately stops at the point
where an unverifiable judgement would be needed, and reports the numbers that
justify stopping there. Run it to reproduce the figures quoted in PROPOSAL.md.

Usage:
    python extract_contours.py --section3 "SECCION 3 - CARGAS Y FACTORES DE CARGA.pdf"

Requires: pypdfium2, numpy, scipy, pillow.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pypdfium2 as pdfium
from PIL import Image
from scipy import ndimage as ndi

SECTION3_SHA256 = "55f53d68dfc568a930b726b0c7dba510ea608128490353bf604f827a27ffc8ca"
RENDER_SCALE = 5.0

# Contour strokes are a light, thin grey; coastline, borders, city dots and all
# lettering are near-black. A single global threshold shatters the strokes
# wherever antialiasing lightens them, so the stroke is recovered by hysteresis:
# seed on the darker core, grow along connected pixels out to the faint limit.
BLACK_LIMIT = 100
STROKE_CORE = 230
STROKE_FAINT = 252
# Antialiasing around black features is grey too. Discard a collar around them.
BLACK_COLLAR_PX = 3
GRATICULE_COVERAGE = 0.6
MARKER_RADIUS_PX = 22.0
MARKER_MATCH = 0.85


def verify_source(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != SECTION3_SHA256:
        raise SystemExit(
            f"Section 3 PDF does not match the locked hash.\n"
            f"  expected {SECTION3_SHA256}\n  found    {digest}"
        )
    return digest


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(radius):
        grown = np.zeros_like(out)
        grown[1:, :] |= out[:-1, :]
        grown[:-1, :] |= out[1:, :]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out |= grown
    return out


def extract_strokes(grey: np.ndarray) -> np.ndarray:
    """Contour strokes only: no lettering, no coastline, no antialiasing collar."""
    black = grey < BLACK_LIMIT
    collar = dilate(black, BLACK_COLLAR_PX) & ~black
    core = (grey >= BLACK_LIMIT) & (grey < STROKE_CORE) & ~collar
    faint = (grey >= BLACK_LIMIT) & (grey < STROKE_FAINT) & ~collar
    labels, count = ndi.label(faint, structure=np.ones((3, 3)))
    seeded = np.zeros(count + 1, bool)
    seeded[np.unique(labels[core])] = True
    seeded[0] = False
    return seeded[labels]


def line_bands(indices: np.ndarray, pad: int = 5) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    run = [int(indices[0])]
    for value in indices[1:]:
        if value - run[-1] <= 5:
            run.append(int(value))
        else:
            out.append((run[0] - pad, run[-1] + pad))
            run = [int(value)]
    out.append((run[0] - pad, run[-1] + pad))
    return out


def inpaint_graticule(strokes: np.ndarray, grey: np.ndarray) -> np.ndarray:
    """Erase the graticule without cutting the contours that cross it.

    Deleting the rules outright leaves a gap in every contour that crossed one.
    Copying each rule's pixels from just outside the rule carries a crossing
    contour across and leaves blank map blank.
    """
    height, width = strokes.shape
    ink = grey < STROKE_FAINT
    columns = np.where(ink.sum(axis=0) / height > GRATICULE_COVERAGE)[0]
    rows = np.where(ink.sum(axis=1) / width > GRATICULE_COVERAGE)[0]
    out = strokes.copy()
    for low, high in line_bands(columns):
        low, high = max(low, 1), min(high, width - 2)
        left, right = out[:, low - 1].copy(), out[:, high + 1].copy()
        middle = (low + high) // 2
        for x in range(low, middle + 1):
            out[:, x] = left
        for x in range(middle + 1, high + 1):
            out[:, x] = right
    for low, high in line_bands(rows):
        low, high = max(low, 1), min(high, height - 2)
        top, bottom = out[low - 1, :].copy(), out[high + 1, :].copy()
        middle = (low + high) // 2
        for y in range(low, middle + 1):
            out[y, :] = top
        for y in range(middle + 1, high + 1):
            out[y, :] = bottom
    return out


def bridge_hairlines(strokes: np.ndarray) -> np.ndarray:
    """Close the sub-pixel breaks antialiasing leaves along a stroke."""
    return ndi.binary_closing(strokes, structure=np.ones((3, 3)), iterations=2)


def find_markers(strokes: np.ndarray) -> list[tuple[int, int]]:
    """Candidate región markers, by ring correlation.

    Candidates only: the template also fires on tight contour bends, so the
    confirmed set and its transcribed values live in pga-region-markers.json,
    read by eye from a contact sheet of these candidates.
    """
    from scipy.signal import fftconvolve

    grid_y, grid_x = np.mgrid[-26:27, -26:27]
    radius = np.hypot(grid_y, grid_x)
    ring = ((radius > MARKER_RADIUS_PX - 2.5) & (radius < MARKER_RADIUS_PX + 2.5)).astype(
        np.float32
    )
    ring /= ring.sum()
    score = fftconvolve(strokes.astype(np.float32), ring[::-1, ::-1], mode="same")
    peaks = (score >= ndi.maximum_filter(score, size=15)) & (score > MARKER_MATCH)
    ys, xs = np.nonzero(peaks)
    kept: list[tuple[int, int]] = []
    for index in np.argsort(-score[ys, xs]):
        y, x = int(ys[index]), int(xs[index])
        if all((y - ky) ** 2 + (x - kx) ** 2 > 30**2 for ky, kx in kept):
            kept.append((y, x))
    return kept


def measure_topology(strokes: np.ndarray) -> dict[str, int]:
    components = int(ndi.label(strokes, structure=np.ones((3, 3)))[1])
    neighbours = ndi.convolve(
        strokes.astype(np.uint8), np.ones((3, 3), np.uint8), mode="constant"
    )
    free_ends = int(
        ndi.label(strokes & (neighbours <= 2), structure=np.ones((3, 3)))[1]
    )
    return {"stroke_components": components, "free_ends": free_ends}


def measure_band_closure(
    strokes: np.ndarray, markers: list[tuple[int, int]], values: list[int | None]
) -> dict[str, object]:
    """Flood fill between contours, then test the fill against the markers.

    Each región marker states the value of the band it sits in, so a correct
    fill puts markers of exactly one value in each band. Markers of different
    values sharing a band prove the fill leaked through a gap.
    """
    height, width = strokes.shape
    bands, count = ndi.label(~strokes)
    free = ~strokes
    sizes = ndi.sum(free, bands, range(1, count + 1))
    angles = np.linspace(0, 2 * np.pi, 64, endpoint=False)

    assigned: dict[int, int] = {}
    conflicts = 0
    for (y, x), value in zip(markers, values):
        if value is None:
            continue
        found: list[int] = []
        for probe in (30, 33, 36):
            for angle in angles:
                py = int(round(y + probe * np.sin(angle)))
                px = int(round(x + probe * np.cos(angle)))
                if 0 <= py < height and 0 <= px < width and bands[py, px]:
                    found.append(int(bands[py, px]))
        if not found:
            continue
        ids, counts = np.unique(found, return_counts=True)
        band = int(ids[np.argmax(counts)])
        if band in assigned and assigned[band] != value:
            conflicts += 1
        else:
            assigned[band] = value
    return {
        "bands_found": int(count),
        "markers_used": int(sum(1 for v in values if v is not None)),
        "distinct_bands_carrying_markers": len(assigned),
        "marker_value_conflicts": conflicts,
        "largest_band_share_of_free_space_percent": float(
            100 * sizes.max() / free.sum()
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--section3", required=True, type=Path)
    parser.add_argument(
        "--markers",
        type=Path,
        default=Path(__file__).with_name("pga-region-markers.json"),
        help="Transcribed región markers used to test the fill",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).with_name("extraction-report.json"),
    )
    arguments = parser.parse_args()

    digest = verify_source(arguments.section3)
    document = pdfium.PdfDocument(arguments.section3)
    page = document[50]  # physical page 51, Figura 3.10.2.1-1
    grey = np.asarray(
        page.render(scale=RENDER_SCALE).to_pil().convert("L")
    ).astype(np.int16)

    raw = extract_strokes(grey)
    ungapped = inpaint_graticule(raw, grey)
    # Markers are found before the closing pass, which thickens strokes enough
    # to fire the ring template on contour bends.
    detected = find_markers(ungapped)
    strokes = bridge_hairlines(ungapped)
    topology = measure_topology(strokes)

    transcription = json.loads(arguments.markers.read_text(encoding="utf-8"))
    markers = [(entry["y"], entry["x"]) for entry in transcription["markers"]]
    values = [entry["region"] for entry in transcription["markers"]]
    closure = measure_band_closure(strokes, markers, values)

    report = {
        "schemaVersion": 1,
        "step": "contour-extraction-and-band-closure",
        "figure": {"id": "figura-3.10.2.1-1", "coefficient": "PGA", "physicalPage": 51},
        "source": {"id": "invias-ccp14-section-3", "sha256": digest},
        "strokeExtraction": {
            "method": (
                "hysteresis on grey level, seeded below "
                f"{STROKE_CORE} and grown to {STROKE_FAINT}, with a "
                f"{BLACK_COLLAR_PX} px collar around black features discarded, "
                "then the graticule inpainted from its flanking pixels"
            ),
            "stroke_pixels": int(strokes.sum()),
            **topology,
        },
        "markerDetection": {
            "ring_candidates": len(detected),
            "transcribed": len(markers),
            "transcribed_with_value": closure["markers_used"],
        },
        "bandClosure": closure,
        "conclusion": (
            "Stroke extraction succeeds. Band closure does not: the contour "
            "field retains roughly a thousand free ends where lettering, city "
            "dots and the región markers overprint the contours, and the fill "
            "leaks through them into one region spanning almost the whole map. "
            "Assigning a coefficient to a city needs those occlusions "
            "reconstructed first."
        ),
    }
    arguments.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"stroke pixels {report['strokeExtraction']['stroke_pixels']}")
    print(f"stroke components {topology['stroke_components']}")
    print(f"free ends {topology['free_ends']}")
    print(
        f"ring candidates {len(detected)}, "
        f"confirmed and transcribed {closure['markers_used']}"
    )
    print(f"bands found {closure['bands_found']}")
    print(f"marker value conflicts {closure['marker_value_conflicts']}")
    print(
        "largest band covers "
        f"{closure['largest_band_share_of_free_space_percent']:.1f}% of free space"
    )
    print(f"\nWrote {arguments.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
