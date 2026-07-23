"""Independent high-precision oracle for the Bogotá research dossier.

This script intentionally reads only oracle-input.json. It never imports or reads
the generated canonical dataset or the JavaScript evidence generator.
"""

from __future__ import annotations

import hashlib
import json
import sys
from decimal import Decimal, getcontext
from pathlib import Path

getcontext().prec = 50
HERE = Path(__file__).resolve().parent
INPUT = HERE / "oracle-input.json"
OUTPUT = HERE / "oracle.json"
D = Decimal


def decimal_text(value: Decimal) -> str:
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text if text not in {"", "-0"} else "0"


def spectrum(hazard: str, fields: list[Decimal], constants: dict[str, Decimal], period: Decimal) -> tuple[str, Decimal]:
    fa, fv, t_start, t_end, t_long, peak = fields
    if hazard == "design":
        aa, av, importance = constants["Aa"], constants["Av"], constants["I"]
        if period <= t_end:
            return "plateau", D("2.5") * aa * fa * importance
        if period <= t_long:
            return "decay", D("1.2") * av * fv * importance / period
        return "long", D("1.2") * av * fv * t_long * importance / (period * period)
    if hazard == "limited-safety":
        ae, importance = constants["Ae"], constants["I"]
        if period <= t_end:
            return "plateau", D("2.5") * ae * fa * importance
        if period <= t_long:
            return "decay", D("1.2") * ae * fv * importance / period
        return "long", D("1.2") * ae * fv * t_long * importance / (period * period)
    ad = constants["Ad"]
    if period < t_start:
        return "ramp", peak + ((D("3") * ad * fa - peak) / t_start) * period
    if period <= t_end:
        return "plateau", D("3") * ad * fa
    if period <= t_long:
        return "decay", D("1.5") * ad * fv / period
    return "long", D("1.5") * ad * fv * t_long / (period * period)


def build() -> dict:
    input_bytes = INPUT.read_bytes()
    source = json.loads(input_bytes)
    records = []
    maximum_boundary_residual = D("0")
    maximum_join_gap = D("0")
    field_names = ["fa", "fv", "transition_start", "transition_end", "long_period", "ground_peak"]

    for hazard, hazard_data in source["hazards"].items():
        constants = {key: D(value) for key, value in hazard_data["constants"].items()}
        for option, string_fields in zip(source["options"], hazard_data["rows"], strict=True):
            fields = [D(value) for value in string_fields]
            fa, fv, t_start, t_end, t_long, _peak = fields
            if hazard == "design":
                formula_boundaries = {"transition_end": D("0.48") * constants["Av"] * fv / (constants["Aa"] * fa)}
                plateau_join = D("2.5") * constants["Aa"] * fa * constants["I"]
                decay_join = D("1.2") * constants["Av"] * fv * constants["I"] / t_end
            elif hazard == "limited-safety":
                formula_boundaries = {"transition_end": D("0.48") * fv / fa}
                plateau_join = D("2.5") * constants["Ae"] * fa * constants["I"]
                decay_join = D("1.2") * constants["Ae"] * fv * constants["I"] / t_end
            else:
                formula_boundaries = {
                    "transition_start": D("0.1") * fv / fa,
                    "transition_end": D("0.5") * fv / fa,
                }
                plateau_join = D("3") * constants["Ad"] * fa
                decay_join = D("1.5") * constants["Ad"] * fv / t_end

            residuals = {}
            for name, formula_value in formula_boundaries.items():
                table_value = t_start if name == "transition_start" else t_end
                residual = table_value - formula_value
                residuals[name] = residual
                maximum_boundary_residual = max(maximum_boundary_residual, abs(residual))
            join_gap = decay_join - plateau_join
            maximum_join_gap = max(maximum_join_gap, abs(join_gap))

            if hazard == "damage-threshold":
                periods = [D("0"), t_start / D("2"), t_start, t_end, (t_end + t_long) / D("2"), t_long, t_long * D("2")]
            else:
                periods = [D("0"), t_end / D("2"), t_end, (t_end + t_long) / D("2"), t_long, t_long * D("2")]
            witnesses = []
            for period in periods:
                branch, acceleration = spectrum(hazard, fields, constants, period)
                witnesses.append({"period": decimal_text(period), "branch": branch, "acceleration": decimal_text(acceleration)})

            records.append({
                "optionId": option,
                "hazardId": hazard,
                "fields": {name: text for name, text in zip(field_names, string_fields, strict=True)},
                "formulaBoundaries": {name: decimal_text(value) for name, value in formula_boundaries.items()},
                "tableMinusFormulaBoundary": {name: decimal_text(value) for name, value in residuals.items()},
                "plateauToDecayJoinGap": decimal_text(join_gap),
                "witnesses": witnesses,
            })

    return {
        "schemaVersion": 1,
        "engine": "Python decimal.Decimal, precision 50",
        "inputSha256": hashlib.sha256(input_bytes).hexdigest(),
        "boundaryPolicy": "Direct tabulated periods select branches; formula-derived boundaries are audit witnesses only.",
        "records": records,
        "auditSummary": {
            "recordCount": len(records),
            "maximumAbsoluteTableMinusFormulaBoundarySeconds": decimal_text(maximum_boundary_residual),
            "maximumAbsolutePlateauToDecayJoinGapG": decimal_text(maximum_join_gap),
            "expectedRecordCount": 48,
        },
    }


def serialized() -> str:
    return json.dumps(build(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> None:
    expected = serialized()
    if "--check" in sys.argv:
        actual = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else None
        if actual != expected:
            raise SystemExit("oracle.json differs from independent oracle generation")
        print("verified independent Bogotá oracle")
        return
    OUTPUT.write_text(expected, encoding="utf-8", newline="\n")
    print("generated independent Bogotá oracle")


if __name__ == "__main__":
    main()
