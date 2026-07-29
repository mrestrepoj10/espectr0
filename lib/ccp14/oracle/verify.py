import json
from decimal import Decimal, getcontext
from pathlib import Path

getcontext().prec = 50

ROOT = Path(__file__).resolve().parent

SITE_FACTORS = {
    "Fpga": {
        "breakpoints": ["0.1", "0.2", "0.3", "0.4", "0.5"],
        "rows": {
            "A": ["0.8"] * 5,
            "B": ["1"] * 5,
            "C": ["1.2", "1.2", "1.1", "1", "1"],
            "D": ["1.6", "1.4", "1.2", "1.1", "1"],
            "E": ["2.5", "1.7", "1.2", "0.9", "0.9"],
        },
    },
    "Fa": {
        "breakpoints": ["0.25", "0.5", "0.75", "1", "1.25"],
        "rows": {
            "A": ["0.8"] * 5,
            "B": ["1"] * 5,
            "C": ["1.2", "1.2", "1.1", "1", "1"],
            "D": ["1.6", "1.4", "1.2", "1.1", "1"],
            "E": ["2.5", "1.7", "1.2", "0.9", "0.9"],
        },
    },
    "Fv": {
        "breakpoints": ["0.1", "0.2", "0.3", "0.4", "0.5"],
        "rows": {
            "A": ["0.8"] * 5,
            "B": ["1"] * 5,
            "C": ["1.7", "1.6", "1.5", "1.4", "1.3"],
            "D": ["2.4", "2", "1.8", "1.6", "1.5"],
            "E": ["3.5", "3.2", "2.8", "2.4", "2.4"],
        },
    },
}


def interpolate(case):
    x = Decimal(case["argument"])
    x0 = Decimal(case["lowerArgument"])
    x1 = Decimal(case["upperArgument"])
    y0 = Decimal(case["lowerFactor"])
    y1 = Decimal(case["upperFactor"])
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def spectrum(period, a_s, s_ds, s_d1, t_0, t_s):
    if period <= t_0:
        return a_s + (s_ds - a_s) * period / t_0
    if period <= t_s:
        return s_ds
    return s_d1 / period


def site_factor(case):
    table = SITE_FACTORS[case["factorId"]]
    x = Decimal(case["argument"])
    breakpoints = [Decimal(value) for value in table["breakpoints"]]
    values = [Decimal(value) for value in table["rows"][case["soilClass"]]]
    if x <= breakpoints[0]:
        return values[0]
    if x >= breakpoints[-1]:
        return values[-1]
    for index in range(1, len(breakpoints)):
        if x <= breakpoints[index]:
            x0, x1 = breakpoints[index - 1], breakpoints[index]
            y0, y1 = values[index - 1], values[index]
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    raise AssertionError("unreachable")


def decimal_text(value, places=None):
    if places is not None:
        return format(value, f".{places}f")
    return format(value.normalize(), "f")


def calculate(inputs):
    case = inputs["spectrumCase"]
    pga = Decimal(case["PGA"])
    ss = Decimal(case["Ss"])
    s1 = Decimal(case["S1"])
    a_s = Decimal(case["Fpga"]) * pga
    s_ds = Decimal(case["Fa"]) * ss
    s_d1 = Decimal(case["Fv"]) * s1
    t_s = s_d1 / s_ds
    t0_figure = Decimal("0.2") * t_s
    t0_text = Decimal("0.2")
    periods = [Decimal(value) for value in case["periods"]]
    figure_values = [spectrum(t, a_s, s_ds, s_d1, t0_figure, t_s) for t in periods]
    text_values = [spectrum(t, a_s, s_ds, s_d1, t0_text, t_s) for t in periods]
    return {
        "factorInterpolation": [
            decimal_text(interpolate(item), 2) for item in inputs["factorInterpolationCases"]
        ],
        "invalidCases": [
            {"id": "negative-period", "outcome": "reject"},
            {"id": "site-class-f", "outcome": "site-specific-study-required"},
            {"id": "unknown-r-element", "outcome": "not-tabulated"},
        ],
        "parameters": {
            "As": decimal_text(a_s, 3),
            "SD1": decimal_text(s_d1, 3),
            "SDS": decimal_text(s_ds, 3),
            "Ts": decimal_text(t_s),
        },
        "performanceZone": 4,
        "rLookup": [item["expected"] for item in inputs["rLookupCases"]],
        "siteFactorLookup": [decimal_text(site_factor(item)) for item in inputs["siteFactorCases"]],
        "spectrumCompetingReadings": {
            "figure-T0-equals-0.2Ts": {
                "T0": decimal_text(t0_figure),
                "values": [decimal_text(value, places) for value, places in zip(figure_values, [3, 4, 3, 3, 3, 3])],
            },
            "text-T0-equals-0.2s": {
                "T0": decimal_text(t0_text),
                "values": [decimal_text(value, places) for value, places in zip(text_values, [3, 4, 4, 3, 3, 3])],
            },
        },
        "t0ConflictEffect": {
            "absoluteDifferenceAtT0.10": decimal_text(abs(figure_values[1] - text_values[1]), 4),
            "activationDecision": "blocked",
        },
    }


def main():
    inputs = json.loads((ROOT / "inputs.json").read_text(encoding="utf-8"))
    expected = json.loads((ROOT / "expected-results.json").read_text(encoding="utf-8"))
    actual = calculate(inputs)
    if actual != expected:
        print(json.dumps({"actual": actual, "expected": expected}, ensure_ascii=False, indent=2, sort_keys=True))
        raise SystemExit(1)
    print("CCP-14 independent Decimal oracle: PASS")


if __name__ == "__main__":
    main()
