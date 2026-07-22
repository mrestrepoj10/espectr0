#!/usr/bin/env python3
"""Generate the NSR-10 design-spectrum oracle independently of TypeScript."""

from __future__ import annotations

import argparse
import hashlib
import json
from decimal import Decimal, getcontext
from pathlib import Path
from typing import Any


getcontext().prec = 50

REQUIRED_SPECTRUM_EQUATIONS = [
    "A.2.6-1",
    "A.2.6-2",
    "A.2.6-3",
    "A.2.6-4",
    "A.2.6-5",
    "A.2.6-6",
]

ROOT = Path(__file__).resolve().parent.parent
INPUT_PATH = ROOT / "lib/nsr10/data/oracle-input.json"
OUTPUT_PATH = ROOT / "lib/nsr10/data/oracle.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decimal_text(value: Decimal) -> str:
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def json_number(value: Decimal) -> int | float:
    text = decimal_text(value)
    return int(text) if "." not in text else float(text)


def interpolate(table: dict[str, Any], profile: str, value: Decimal) -> tuple[Decimal, str]:
    breakpoints = [Decimal(item) for item in table["breakpoints"]]
    values = [Decimal(item) for item in table["profiles"][profile]]
    label = table["label"]

    if value <= breakpoints[0]:
        result = values[0]
        return result, f"{label}({profile}, {table['parameter']}={decimal_text(value)}): clamp({decimal_text(value)}) at {decimal_text(breakpoints[0])} -> {decimal_text(result)}"
    if value >= breakpoints[-1]:
        result = values[-1]
        return result, f"{label}({profile}, {table['parameter']}={decimal_text(value)}): clamp({decimal_text(value)}) at {decimal_text(breakpoints[-1])} -> {decimal_text(result)}"

    for index in range(len(breakpoints) - 1):
        lower = breakpoints[index]
        upper = breakpoints[index + 1]
        if value <= upper:
            lower_value = values[index]
            upper_value = values[index + 1]
            result = lower_value + (value - lower) * (upper_value - lower_value) / (upper - lower)
            arithmetic = (
                f"{label}({profile}, {table['parameter']}={decimal_text(value)}): "
                f"{decimal_text(lower_value)} + ({decimal_text(value)} - {decimal_text(lower)}) * "
                f"({decimal_text(upper_value)} - {decimal_text(lower_value)}) / "
                f"({decimal_text(upper)} - {decimal_text(lower)}) = {decimal_text(result)}"
            )
            return result, arithmetic
    raise AssertionError("unreachable interpolation branch")


def point(period: Decimal, anchors: list[str], aa: Decimal, av: Decimal, fa: Decimal,
          fv: Decimal, importance: Decimal, tc: Decimal, tl: Decimal,
          sa_max: Decimal) -> dict[str, Any]:
    if period <= tc:
        sa = sa_max
        branch = "plateau-A.2.6-3"
        arithmetic = f"2.5*{decimal_text(aa)}*{decimal_text(fa)}*{decimal_text(importance)} = {decimal_text(sa)}"
    elif period <= tl:
        sa = Decimal("1.2") * av * fv * importance / period
        branch = "inverse-T-A.2.6-1"
        arithmetic = f"1.2*{decimal_text(av)}*{decimal_text(fv)}*{decimal_text(importance)}/{decimal_text(period)} = {decimal_text(sa)}"
    else:
        sa = Decimal("1.2") * av * fv * tl * importance / (period * period)
        branch = "inverse-T2-A.2.6-5"
        arithmetic = f"1.2*{decimal_text(av)}*{decimal_text(fv)}*{decimal_text(tl)}*{decimal_text(importance)}/{decimal_text(period)}^2 = {decimal_text(sa)}"
    return {
        "period": json_number(period),
        "period_decimal": decimal_text(period),
        "anchors": anchors,
        "sa": json_number(sa),
        "sa_decimal": decimal_text(sa),
        "branch": branch,
        "arithmetic": arithmetic,
    }


def generate_case(raw: dict[str, Any], inputs: dict[str, Any]) -> dict[str, Any]:
    aa = Decimal(raw["aa"])
    av = Decimal(raw["av"])
    importance = Decimal(inputs["importance_coefficients"][raw["importance_group"]])
    fa_table = {**inputs["site_coefficients"]["fa"], "label": "Fa", "parameter": "Aa"}
    fv_table = {**inputs["site_coefficients"]["fv"], "label": "Fv", "parameter": "Av"}
    fa, fa_arithmetic = interpolate(fa_table, raw["soil_profile"], aa)
    fv, fv_arithmetic = interpolate(fv_table, raw["soil_profile"], av)
    t0 = Decimal("0.1") * av * fv / (aa * fa)
    tc = Decimal("0.48") * av * fv / (aa * fa)
    tl = Decimal("2.4") * fv
    sa_max = Decimal("2.5") * aa * fa * importance

    periods: dict[Decimal, list[str]] = {}
    for fixed in inputs["fixed_periods"]:
        periods.setdefault(Decimal(fixed), []).append(f"fixed-{fixed}")
    for label, value in (("T0", t0), ("TC", tc), ("TL", tl)):
        periods.setdefault(value, []).append(label)

    return {
        "id": raw["id"],
        "sampling_band": raw["sampling_band"],
        "municipio": raw["municipio"],
        "departamento": raw["departamento"],
        "aa": json_number(aa),
        "av": json_number(av),
        "soil_profile": raw["soil_profile"],
        "importance_group": raw["importance_group"],
        "importance_coefficient": json_number(importance),
        "expected": {
            "fa": json_number(fa), "fv": json_number(fv), "t0": json_number(t0),
            "tc": json_number(tc), "tl": json_number(tl), "sa_max": json_number(sa_max),
        },
        "expected_decimal": {
            "fa": decimal_text(fa), "fv": decimal_text(fv), "t0": decimal_text(t0),
            "tc": decimal_text(tc), "tl": decimal_text(tl), "sa_max": decimal_text(sa_max),
        },
        "arithmetic": {
            "fa": fa_arithmetic,
            "fv": fv_arithmetic,
            "t0": f"0.1*{decimal_text(av)}*{decimal_text(fv)}/({decimal_text(aa)}*{decimal_text(fa)}) = {decimal_text(t0)}",
            "tc": f"0.48*{decimal_text(av)}*{decimal_text(fv)}/({decimal_text(aa)}*{decimal_text(fa)}) = {decimal_text(tc)}",
            "tl": f"2.4*{decimal_text(fv)} = {decimal_text(tl)}",
            "sa_max": f"2.5*{decimal_text(aa)}*{decimal_text(fa)}*{decimal_text(importance)} = {decimal_text(sa_max)}",
        },
        "expected_sa_points": [
            point(period, anchors, aa, av, fa, fv, importance, tc, tl, sa_max)
            for period, anchors in sorted(periods.items())
        ],
    }


def build_oracle() -> dict[str, Any]:
    inputs = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    if sha256(Path(__file__)) != inputs["generator"]["sha256"]:
        raise SystemExit("Oracle program SHA-256 does not match oracle-input.json")
    if inputs["source"]["spectrum_equations"] != REQUIRED_SPECTRUM_EQUATIONS:
        raise SystemExit("Oracle formula inventory is incomplete or out of order")
    cases = [generate_case(case, inputs) for case in inputs["cases"]]
    return {
        "schema_version": 2,
        "description": "Independent high-precision calculation oracle for NSR-10 design spectra.",
        "numeric_contract": {
            "calculation": "Python Decimal, 50 significant digits",
            "json_numbers": "shortest round-trip binary64-compatible numbers",
            "decimal_witnesses": "exact high-precision decimal strings retained beside calculated values",
            "absolute_tolerances": inputs["absolute_tolerances"],
        },
        "legal_qualification": "The default uses equation A.2.6-3's plateau from zero through TC. Equation A.2.6-7's rising branch below T0 is reserved for modal analysis under A.2.6.1.3.",
        "sampling_note": "low/intermediate/high coefficient labels are oracle coverage strata, not NSR-10 hazard-zone classifications.",
        "units": inputs["units"],
        "formula_inventory": inputs["source"]["spectrum_equations"],
        "sources": {
            "municipios": {"path": "lib/nsr10/data/municipios.json", "sha256": "6d6da041d21085f5ca79cbb796a68d62ff42babae52fd2b7474f10da14786a12"},
            "site_coefficients": {"path": "lib/nsr10/data/site-coefficients.json", "sha256": "2c22ab2cf3a49db81f18be486aec4b96aa3dbb3517aaeedad4b8a6c0e1f161c4"},
            "importance_coefficients": {"path": "lib/nsr10/data/importance-coefficients.json", "sha256": "a54ba4b218120482e47544223bae52b7c7e0e959d5b661944699bde011b08cb0"},
            "spectrum_formulas": {"path": "lib/nsr10/data/oracle-input.json", "sha256": sha256(INPUT_PATH)},
        },
        "coverage": {
            "case_count": len(cases),
            "soil_profiles": ["A", "B", "C", "D", "E"],
            "importance_groups": ["I", "II", "III", "IV"],
            "sampling_bands": ["high-coefficient", "intermediate-coefficient", "low-coefficient"],
            "fixed_periods": [json_number(Decimal(period)) for period in inputs["fixed_periods"]],
            "case_periods": "fixed periods plus exact T0, TC, and TL, deduplicated and sorted",
        },
        "cases": cases,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output = json.dumps(build_oracle(), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if OUTPUT_PATH.read_text(encoding="utf-8") != output:
            raise SystemExit(f"{OUTPUT_PATH} is not reproducible; run this generator")
        print("Verified independent NSR-10 oracle (12 Decimal scenarios).")
    else:
        OUTPUT_PATH.write_text(output, encoding="utf-8", newline="\n")
        print("Generated independent NSR-10 oracle (12 Decimal scenarios).")


if __name__ == "__main__":
    main()
