"""Measure whether the CCP-14 hazard maps can be georeferenced reproducibly.

Step 1 of the digitization proposed in PROPOSAL.md. This script establishes the
pixel-to-(longitude, latitude) transform of Figuras 3.10.2.1-1 a 3.10.2.1-3 and
reports how well it fits, so the proposal rests on a measurement instead of an
assumption. It reads nothing but the official INVIAS Section 3 PDF, whose bytes
are verified against the hash locked in lib/ccp14/evidence/study-data.mjs.

It deliberately stops before contour extraction. Georeferencing is the part that
can be shown correct from the graticule alone; assigning a coefficient to a city
cannot, and that is the work the proposal asks to have reviewed.

Usage:
    python georeference.py --section3 "SECCION 3 - CARGAS Y FACTORES DE CARGA.pdf"

The PDF is not redistributed with this repository. Download the official ZIP
(INVIAS portal file ID 29584) and point the script at the Section 3 member.

Requires: pypdfium2, numpy, pillow.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import pypdfium2 as pdfium
from PIL import Image

SECTION3_SHA256 = "55f53d68dfc568a930b726b0c7dba510ea608128490353bf604f827a27ffc8ca"

# Physical page (1-based) of each hazard figure inside the Section 3 PDF, with
# the printed page number the figure carries and the coefficient it maps.
FIGURES = (
    ("PGA", "figura-3.10.2.1-1", 51, "3-47"),
    ("Ss", "figura-3.10.2.1-2", 52, "3-48"),
    ("S1", "figura-3.10.2.1-3", 53, "3-49"),
)

RENDER_SCALE = 5.0
# The graticule is drawn in light grey over white; map ink is much darker. A
# gridline is a column or row that is non-white across most of the sheet.
INK_THRESHOLD = 230
COVERAGE_FRACTION = 0.6
# A detected line joins the ladder only if it lands within this fraction of the
# median spacing of an integer multiple of it.
LADDER_TOLERANCE = 0.25
# Metres per degree of longitude at the equator, WGS84.
METRES_PER_DEGREE = 111_320.0


@dataclass(frozen=True)
class AxisFit:
    lines_detected: int
    lines_on_ladder: int
    lines_rejected: int
    pixels_per_degree: float
    residual_rms_px: float
    residual_max_px: float


@dataclass(frozen=True)
class FigureFit:
    coefficient: str
    figure_id: str
    physical_page: int
    printed_page: str
    render_scale: float
    longitude: AxisFit
    latitude: AxisFit
    axis_agreement_percent: float
    ground_sampling_metres_per_px: float


def verify_source(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != SECTION3_SHA256:
        raise SystemExit(
            f"Section 3 PDF does not match the locked hash.\n"
            f"  expected {SECTION3_SHA256}\n  found    {digest}"
        )
    return digest


def render_page(document: pdfium.PdfDocument, physical_page: int) -> np.ndarray:
    page = document[physical_page - 1]
    image: Image.Image = page.render(scale=RENDER_SCALE).to_pil().convert("L")
    return np.asarray(image)


def detect_lines(grey: np.ndarray, axis: str) -> list[float]:
    """Centres of the long straight rules that make up the graticule."""
    ink = grey < INK_THRESHOLD
    if axis == "longitude":
        coverage = ink.sum(axis=0) / ink.shape[0]
    else:
        coverage = ink.sum(axis=1) / ink.shape[1]
    hits = [int(i) for i, value in enumerate(coverage) if value > COVERAGE_FRACTION]
    if not hits:
        return []
    # Rules are a few pixels wide; collapse each run to its centre.
    centres: list[float] = []
    run = [hits[0]]
    for value in hits[1:]:
        if value - run[-1] <= 4:
            run.append(value)
        else:
            centres.append(sum(run) / len(run))
            run = [value]
    centres.append(sum(run) / len(run))
    return centres


def fit_axis(centres: list[float]) -> AxisFit:
    """Fit a regular ladder, discarding lines that are not part of the graticule.

    Degree labels are never read: the graticule is a constant-interval grid, so
    indexing the lines on their own spacing recovers the scale without assuming
    which meridian the leftmost rule is. Missing lines - the denser maps hide a
    few under contour bundles - simply leave a gap in the index sequence.
    """
    if len(centres) < 3:
        raise SystemExit("Too few graticule lines detected to fit an axis")
    positions = np.array(sorted(centres))
    spacing = float(np.median(np.diff(positions)))
    index = np.round((positions - positions[0]) / spacing)
    off_ladder = np.abs((positions - positions[0]) / spacing - index)
    on_ladder = off_ladder < LADDER_TOLERANCE

    # One robust pass: refit on the surviving lines, then drop anything more
    # than three residual sigmas out. Non-graticule horizontals - a map border,
    # a long coastline segment - land here rather than in the scale.
    for _ in range(2):
        kept_positions = positions[on_ladder]
        kept_index = index[on_ladder]
        design = np.vstack([kept_index, np.ones(len(kept_index))]).T
        coefficients, *_ = np.linalg.lstsq(design, kept_positions, rcond=None)
        residuals = kept_positions - design @ coefficients
        sigma = float(np.sqrt((residuals**2).mean())) or 1.0
        promoted = on_ladder.copy()
        promoted[on_ladder] = np.abs(residuals) <= 3 * sigma
        if (promoted == on_ladder).all():
            break
        on_ladder = promoted

    return AxisFit(
        lines_detected=len(positions),
        lines_on_ladder=int(on_ladder.sum()),
        lines_rejected=int((~on_ladder).sum()),
        pixels_per_degree=float(coefficients[0]),
        residual_rms_px=float(np.sqrt((residuals**2).mean())),
        residual_max_px=float(np.abs(residuals).max()),
    )


def fit_figure(
    document: pdfium.PdfDocument,
    coefficient: str,
    figure_id: str,
    physical_page: int,
    printed_page: str,
) -> FigureFit:
    grey = render_page(document, physical_page)
    longitude = fit_axis(detect_lines(grey, "longitude"))
    latitude = fit_axis(detect_lines(grey, "latitude"))
    agreement = (
        abs(longitude.pixels_per_degree - latitude.pixels_per_degree)
        / longitude.pixels_per_degree
        * 100
    )
    return FigureFit(
        coefficient=coefficient,
        figure_id=figure_id,
        physical_page=physical_page,
        printed_page=printed_page,
        render_scale=RENDER_SCALE,
        longitude=longitude,
        latitude=latitude,
        axis_agreement_percent=agreement,
        ground_sampling_metres_per_px=METRES_PER_DEGREE / longitude.pixels_per_degree,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--section3",
        required=True,
        type=Path,
        help="Path to the official Section 3 PDF from INVIAS portal file ID 29584",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).with_name("georeference-report.json"),
        help="Where to write the measurement report",
    )
    arguments = parser.parse_args()

    digest = verify_source(arguments.section3)
    document = pdfium.PdfDocument(arguments.section3)
    fits = [fit_figure(document, *figure) for figure in FIGURES]

    report = {
        "schemaVersion": 1,
        "step": "georeference-only",
        "source": {
            "id": "invias-ccp14-section-3",
            "sha256": digest,
            "portalFileId": 29584,
        },
        "method": (
            "Render each figure at scale 5, detect the graticule as the rules "
            "covering more than 60 percent of the sheet, index them on their own "
            "median spacing, and fit pixels per degree by least squares with one "
            "robust rejection pass."
        ),
        "figures": [asdict(fit) for fit in fits],
    }
    arguments.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    for fit in fits:
        print(f"{fit.coefficient} (page {fit.physical_page}, printed {fit.printed_page})")
        print(
            f"  meridians {fit.longitude.lines_on_ladder} kept / "
            f"{fit.longitude.lines_rejected} rejected, "
            f"{fit.longitude.pixels_per_degree:.3f} px/deg, "
            f"rms {fit.longitude.residual_rms_px:.2f} px, "
            f"max {fit.longitude.residual_max_px:.2f} px"
        )
        print(
            f"  parallels {fit.latitude.lines_on_ladder} kept / "
            f"{fit.latitude.lines_rejected} rejected, "
            f"{fit.latitude.pixels_per_degree:.3f} px/deg, "
            f"rms {fit.latitude.residual_rms_px:.2f} px, "
            f"max {fit.latitude.residual_max_px:.2f} px"
        )
        print(
            f"  axes agree to {fit.axis_agreement_percent:.2f} %, "
            f"ground sampling {fit.ground_sampling_metres_per_px:.0f} m/px"
        )
    print(f"\nWrote {arguments.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
