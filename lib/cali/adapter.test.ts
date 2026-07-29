import { describe, expect, it } from "vitest"

import { formatSpectrumCsv, formatSpectrumJson, spectrumResultData } from "../spectra"
import { adaptCaliSpectrum } from "./adapter"

describe("Cali normalized spectrum adapter", () => {
  it.each(["design", "safety-limited"] as const)(
    "emits a traceable normalized %s spectrum",
    (hazardId) => {
      const result = adaptCaliSpectrum({
        optionId: "zone-1",
        hazardId,
        importanceFactor: 1,
        uncontrolledFillThicknessMeters: null,
        colluvialDeposit: false,
      })

      expect(result.status).toBe("ok")
      if (result.status !== "ok") return
      expect(result.study).toEqual({
        id: "cali-microzonation",
        version: "D0158-2014/INGEOMINAS-DAGMA-2005-v1",
      })
      expect(result.points[0]).toMatchObject({ tSeconds: 0, branchId: "plateau" })
      expect(result.saAt(1)).toMatchObject({ status: "ok" })
      expect(result.saAt(2.51)).toMatchObject({
        status: "site-specific-study-required",
        applicability: { reasonCode: "cali-site-specific-long-period" },
      })
      expect(result.points.at(-1)?.tSeconds).toBe(2.5)
      expect(result.citationIds).toContain(`cell-${hazardId}-zone-1-column-2`)
      expect(result.sourceIds).toContain("nsr10-title-a-2017")
      expect(formatSpectrumCsv(result)).toContain("T (s),Sa (g)")
      expect(JSON.parse(formatSpectrumJson(result)).result.study.id).toBe(
        "cali-microzonation",
      )
      expect(spectrumResultData(result).status).toBe("ok")
    },
  )

  it("fails closed for the incomplete damage-threshold curve", () => {
    const result = adaptCaliSpectrum({
      optionId: "zone-1",
      hazardId: "damage-threshold",
      importanceFactor: 1,
      uncontrolledFillThicknessMeters: null,
      colluvialDeposit: false,
    })

    expect(result.status).toBe("unsupported")
    if (result.status !== "unsupported") return
    expect(result.applicability.reasonCode).toBe("cali-damage-inputs-missing")
    expect(result.applicability.message).toContain("A0d")
    expect(result.citationIds).toEqual([
      "formula-damage-ramp",
      "formula-damage-plateau",
    ])
    expect(result.evidenceAvailability.status).toBe("partial")
  })

  it.each([
    { uncontrolledFillThicknessMeters: 3.01, colluvialDeposit: false },
    { uncontrolledFillThicknessMeters: null, colluvialDeposit: true },
  ])("applies the cited 20% Fa/Fv increase for declared site condition %#", (site) => {
    const baseline = adaptCaliSpectrum({
      optionId: "zone-1",
      hazardId: "design",
      importanceFactor: 1,
      uncontrolledFillThicknessMeters: null,
      colluvialDeposit: false,
    })
    const amplified = adaptCaliSpectrum({
      optionId: "zone-1",
      hazardId: "design",
      importanceFactor: 1,
      ...site,
    })
    expect(baseline.status).toBe("ok")
    expect(amplified.status).toBe("ok")
    if (baseline.status !== "ok" || amplified.status !== "ok") return
    expect(amplified.saAt(1)).toMatchObject({ status: "ok" })
    const baselineAtOne = baseline.saAt(1)
    const amplifiedAtOne = amplified.saAt(1)
    if (baselineAtOne.status !== "ok" || amplifiedAtOne.status !== "ok") return
    expect(amplifiedAtOne.point.saG).toBeCloseTo(baselineAtOne.point.saG * 1.2, 12)
    expect(amplified.warnings.map(({ code }) => code)).toContain(
      "fill-colluvium-amplification",
    )
    expect(amplified.citationIds).toContain("claim-fill-colluvium")
    expect(amplified.trace.data.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cali-effective-fa", value: 1.032 }),
        expect.objectContaining({ id: "cali-effective-fv", value: 1.188 }),
        expect.objectContaining({
          id: "cali-site-coefficient-multiplier",
          dependencies: ["cali-input-fill-thickness", "cali-input-colluvial-deposit"],
        }),
      ]),
    )
    expect(amplified.trace.data.steps).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cali-representative-period-inverse-square" }),
      ]),
    )
  })

  it("keeps every numeric trace representative inside the ordinary 2.5 s domain", () => {
    const result = adaptCaliSpectrum({
      optionId: "zone-3",
      hazardId: "design",
      importanceFactor: 1,
      uncontrolledFillThicknessMeters: 3.01,
      colluvialDeposit: false,
    })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    const tracePeriods = result.trace.data.steps
      .filter(({ id }) => id.startsWith("cali-representative-period-"))
      .map(({ value }) => value)
      .filter((value): value is number => typeof value === "number")
    expect(tracePeriods.every((value) => value <= 2.5)).toBe(true)
    for (const [period, expected] of [[0.5, 1.02], [1.5, 0.7152], [2.5, 0.343296]]) {
      const ordinate = result.saAt(period)
      expect(ordinate.status).toBe("ok")
      if (ordinate.status === "ok") expect(ordinate.point.saG).toBeCloseTo(expected, 12)
    }
  })

  it("preserves both concurrent curve components as separate manual options", () => {
    const tcCurve = adaptCaliSpectrum({
      optionId: "zone-4b-tc",
      hazardId: "design",
      importanceFactor: 1,
      uncontrolledFillThicknessMeters: null,
      colluvialDeposit: false,
    })
    const tlCurve = adaptCaliSpectrum({
      optionId: "zone-4b-tl",
      hazardId: "design",
      importanceFactor: 1,
      uncontrolledFillThicknessMeters: null,
      colluvialDeposit: false,
    })
    expect(tcCurve.status).toBe("ok")
    expect(tlCurve.status).toBe("ok")
    if (tcCurve.status !== "ok" || tlCurve.status !== "ok") return
    expect(tcCurve.scenarioEvidenceKey.optionId).not.toBe(
      tlCurve.scenarioEvidenceKey.optionId,
    )
    expect(tcCurve.metrics.find(({ id }) => id === "tc")?.value).not.toBe(
      tlCurve.metrics.find(({ id }) => id === "tc")?.value,
    )
  })
})
