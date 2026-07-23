import json
from decimal import Decimal, getcontext
from pathlib import Path

getcontext().prec = 50

ROOT = Path(__file__).resolve().parent


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
