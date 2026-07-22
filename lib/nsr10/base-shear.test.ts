import { describe, expect, it } from "vitest"

import { getNormativeCitation } from "./evidence"
import { saAt } from "./spectrum"
import {
  approximatePeriod,
  baseShear,
  fheApplicability,
  forceDistribution,
  periodCeiling,
} from "./base-shear"
import {
  approximatePeriodCoefficients,
  approximatePeriodSystems,
  baseShearEvidenceIds,
} from "./base-shear-constants"

describe("NSR-10 base shear engine", () => {
  it.each([
    ["concrete-moment-frame", 0.047, 0.9],
    ["steel-moment-frame", 0.072, 0.8],
    ["steel-eccentric-or-brb-braced", 0.073, 0.75],
    ["all-other", 0.049, 0.75],
  ] as const)("computes Ta for %s", (system, ct, alpha) => {
    const result = approximatePeriod({ system, hn: 30 })

    expect(result).toMatchObject({
      status: "ok",
      system,
      hn: 30,
      ct,
      alpha,
      reference: "A.4.2-3 / Tabla A.4.2-1",
      evidenceId: "a4.2.3-approximate-period",
    })
    expect(result.ta).toBeCloseTo(ct * 30 ** alpha, 12)
  })

  it("rejects invalid heights for Ta", () => {
    expect(() => approximatePeriod({ system: "all-other", hn: 0 })).toThrow()
  })

  it("applies the Cu floor but uses Ta when no analytical period exists", () => {
    const result = periodCeiling({ av: 0.5, fv: 2, ta: 1.5 })

    expect(result).toMatchObject({
      status: "ok",
      cu: 1.2,
      governedBy: "approximate-period",
      reference: "A.4.2-2",
    })
    expect(result.maximumPeriod).toBeCloseTo(1.8, 12)
    expect(result.t).toBeCloseTo(1.5, 12)
  })

  it("selects or caps an analytical period and reports equality", () => {
    const below = periodCeiling({ av: 0.25, fv: 1.5, ta: 1, tAnalytical: 0.9 })
    expect(below.cu).toBeCloseTo(1.3, 12)
    expect(below).toMatchObject({ t: 0.9, governedBy: "analytical-period" })

    const equal = periodCeiling({ av: 0.25, fv: 1.5, ta: 1, tAnalytical: 1.3 })
    expect(equal).toMatchObject({ t: 1.3, governedBy: "equal" })

    const capped = periodCeiling({ av: 0.25, fv: 1.5, ta: 1, tAnalytical: 1.5 })
    expect(capped).toMatchObject({ t: 1.3, governedBy: "cu-times-ta" })
  })

  it("computes base shear consistently from mass and weight", () => {
    const fromMass = baseShear({ saAtT: 0.4, massKg: 100_000 })
    const fromWeight = baseShear({ saAtT: 0.4, weightKn: 980 })

    expect(fromMass).toMatchObject({
      status: "ok",
      inputBasis: "mass-kg",
      gravityMps2: 9.8,
      massKg: 100_000,
      vsOverWeight: 0.4,
    })
    if (fromMass.status !== "ok") return
    expect(fromMass.weightKn).toBeCloseTo(980, 12)
    expect(fromMass.vsKn).toBeCloseTo(392, 12)
    expect(fromWeight).toMatchObject({
      status: "ok",
      inputBasis: "weight-kn",
      weightKn: 980,
      vsKn: 392,
      vsOverWeight: 0.4,
    })
  })

  it("accepts a successful saAt result without reconstructing spectrum math", () => {
    const acceleration = saAt(1, {
      aa: 0.25,
      av: 0.25,
      soilProfile: "D",
      importanceGroup: "II",
    })
    const result = baseShear({ saAtT: acceleration, weightKn: 1_000 })

    expect(acceleration.status).toBe("ok")
    expect(result.status).toBe("ok")
    if (acceleration.status !== "ok" || result.status !== "ok") return
    expect(result.saAtT).toBe(acceleration.sa)
    expect(result.vsKn).toBeCloseTo(acceleration.sa * 1_000, 12)
  })

  it("propagates the soil-F site-specific-study result", () => {
    const acceleration = saAt(1, {
      aa: 0.25,
      av: 0.25,
      soilProfile: "F",
      importanceGroup: "II",
    })
    const result = baseShear({ saAtT: acceleration, weightKn: 1_000 })

    expect(result).toEqual(acceleration)
    expect(result).toMatchObject({
      status: "site-specific-study-required",
      section: "A.2.10",
      soilProfile: "F",
    })
  })

  it("rejects invalid or ambiguous base-shear inputs", () => {
    expect(() => baseShear({ saAtT: 0, weightKn: 1_000 })).toThrow(RangeError)
    expect(() => baseShear({ saAtT: 0.2, weightKn: 0 })).toThrow(RangeError)
    expect(() =>
      baseShear({ saAtT: 0.2, massKg: 100, weightKn: 1 } as never),
    ).toThrow(RangeError)
    expect(() => baseShear({ saAtT: 0.2 } as never)).toThrow(RangeError)
  })

  it.each([
    [0, 1],
    [0.5, 1],
    [0.500_001, 1.000_000_5],
    [2.5, 2],
    [2.500_001, 2],
  ])("uses the cited k branch at T=%s", (t, expectedK) => {
    const result = forceDistribution({
      stories: [
        { wx: 100, hx: 3 },
        { wx: 100, hx: 6 },
      ],
      t,
      vs: 300,
    })

    expect(result.k).toBeCloseTo(expectedK, 12)
  })

  it("distributes Fx to each story and accumulates story shears from the top", () => {
    const result = forceDistribution({
      stories: [
        { wx: 100, hx: 3 },
        { wx: 150, hx: 6 },
        { wx: 200, hx: 9 },
      ],
      t: 1,
      vs: 600,
    })

    expect(result.k).toBe(1.25)
    expect(result.stories.reduce((sum, story) => sum + story.cvx, 0)).toBeCloseTo(1, 12)
    expect(result.stories.reduce((sum, story) => sum + story.fx, 0)).toBeCloseTo(600, 12)
    expect(result.stories[0].storyShear).toBeCloseTo(600, 12)
    expect(result.stories[1].storyShear).toBeCloseTo(
      result.stories[1].fx + result.stories[2].fx,
      12,
    )
    expect(result.stories[2].storyShear).toBeCloseTo(result.stories[2].fx, 12)
  })

  it("is invariant when every story weight is scaled uniformly", () => {
    const unitWeights = forceDistribution({
      stories: [
        { wx: 1, hx: 3 },
        { wx: 1, hx: 6 },
        { wx: 1, hx: 9 },
      ],
      t: 0.4,
      vs: 450,
    })
    const physicalWeights = forceDistribution({
      stories: [
        { wx: 120, hx: 3 },
        { wx: 120, hx: 6 },
        { wx: 120, hx: 9 },
      ],
      t: 0.4,
      vs: 450,
    })

    expect(physicalWeights.stories.map(({ cvx }) => cvx)).toEqual(
      unitWeights.stories.map(({ cvx }) => cvx),
    )
    expect(physicalWeights.stories.map(({ fx }) => fx)).toEqual(
      unitWeights.stories.map(({ fx }) => fx),
    )
  })

  it("requires base-to-top strictly increasing story heights", () => {
    expect(() =>
      forceDistribution({
        stories: [
          { wx: 100, hx: 6 },
          { wx: 100, hx: 3 },
        ],
        t: 1,
        vs: 200,
      }),
    ).toThrow(RangeError)
  })

  it("permits every building in low hazard and group I in intermediate hazard", () => {
    const shared = {
      importanceGroup: "IV" as const,
      regularity: "irregular" as const,
      dynamicAnalysisIrregularity: "vertical-1aA" as const,
      stories: 50,
      heightM: 150,
      soilProfile: "F" as const,
      t: 4,
    }
    expect(fheApplicability({ ...shared, hazardZone: "low" })).toMatchObject({
      applicable: true,
      qualifyingRule: "low-hazard",
      warnings: [],
    })
    expect(
      fheApplicability({
        ...shared,
        hazardZone: "intermediate",
        importanceGroup: "I",
      }),
    ).toMatchObject({
      applicable: true,
      qualifyingRule: "intermediate-group-i",
      warnings: [],
    })
  })

  it("applies regular building limits inclusively and checks the soft-soil exception", () => {
    const boundary = fheApplicability({
      hazardZone: "high",
      importanceGroup: "II",
      regularity: "regular",
      dynamicAnalysisIrregularity: "none",
      stories: 20,
      heightM: 60,
      soilProfile: "D",
      t: 2,
      tc: 1,
    })
    expect(boundary).toMatchObject({
      applicable: true,
      qualifyingRule: "regular-within-limits",
      warnings: [],
    })

    const exceeded = fheApplicability({
      hazardZone: "high",
      importanceGroup: "II",
      regularity: "regular",
      dynamicAnalysisIrregularity: "none",
      stories: 21,
      heightM: 61,
      soilProfile: "D",
      t: 2.01,
      tc: 1,
    })
    expect(exceeded.applicable).toBe(false)
    expect(exceeded.warnings.map(({ code }) => code)).toEqual([
      "soft-soil-long-period",
      "regular-story-limit",
      "regular-height-limit",
    ])
  })

  it("requires Tc to evaluate a regular D, E, or F profile", () => {
    const result = fheApplicability({
      hazardZone: "high",
      importanceGroup: "II",
      regularity: "regular",
      dynamicAnalysisIrregularity: "none",
      stories: 10,
      heightM: 30,
      soilProfile: "F",
      t: 1,
    })

    expect(result.applicable).toBe(false)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].code).toBe("soft-soil-period-check-unavailable")
  })

  it("applies irregular limits inclusively and emits both exceeded-limit warnings", () => {
    const boundary = fheApplicability({
      hazardZone: "high",
      importanceGroup: "II",
      regularity: "irregular",
      dynamicAnalysisIrregularity: "none",
      stories: 6,
      heightM: 18,
      soilProfile: "E",
      t: 3,
      tc: 2,
    })
    expect(boundary).toMatchObject({
      applicable: true,
      qualifyingRule: "irregular-within-limits",
      warnings: [],
    })

    const exceeded = fheApplicability({
      hazardZone: "high",
      importanceGroup: "II",
      regularity: "irregular",
      dynamicAnalysisIrregularity: "none",
      stories: 7,
      heightM: 19,
      soilProfile: "A",
      t: 0.3,
    })
    expect(exceeded.applicable).toBe(false)
    expect(exceeded.warnings.map(({ code }) => code)).toEqual([
      "irregular-story-limit",
      "irregular-height-limit",
    ])
  })

  it("requires dynamic analysis for an irregular soft-soil building above 2Tc", () => {
    const result = fheApplicability({
      hazardZone: "high",
      importanceGroup: "II",
      regularity: "irregular",
      dynamicAnalysisIrregularity: "none",
      stories: 4,
      heightM: 12,
      soilProfile: "E",
      t: 2.01,
      tc: 1,
    })

    expect(result.applicable).toBe(false)
    expect(result.warnings.map(({ code }) => code)).toEqual(["soft-soil-long-period"])
  })

  it.each([
    "vertical-1aA",
    "vertical-1bA",
    "vertical-2A",
    "vertical-3A",
    "unclassified",
  ] as const)("requires dynamic analysis for %s irregularity", (dynamicAnalysisIrregularity) => {
    const result = fheApplicability({
      hazardZone: "high",
      importanceGroup: "II",
      regularity: "irregular",
      dynamicAnalysisIrregularity,
      stories: 4,
      heightM: 12,
      soilProfile: "A",
      t: 0.5,
    })

    expect(result.applicable).toBe(false)
    expect(result.qualifyingRule).toBeUndefined()
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "dynamic-analysis-irregularity",
        reference: "A.3.4.2.2",
        evidenceId: "a3.4.2.2-dynamic-required",
      }),
    )
  })

  it("reports the flexible-on-rigid exception and dynamic minimum information", () => {
    const regular = fheApplicability({
      hazardZone: "high",
      importanceGroup: "IV",
      regularity: "regular",
      dynamicAnalysisIrregularity: "none",
      stories: 40,
      heightM: 120,
      soilProfile: "A",
      t: 3,
      flexibleOnRigid: true,
    })
    const irregular = fheApplicability({
      hazardZone: "high",
      importanceGroup: "IV",
      regularity: "irregular",
      dynamicAnalysisIrregularity: "none",
      stories: 5,
      heightM: 15,
      soilProfile: "A",
      t: 1,
    })

    expect(regular).toMatchObject({
      applicable: true,
      qualifyingRule: "flexible-on-rigid",
      notes: [{ minimumRatio: 0.8, reference: "A.5.4.5" }],
    })
    expect(irregular.notes[0].minimumRatio).toBe(0.9)
  })

  it("maps every engine coefficient group to a verified normative citation", () => {
    expect(approximatePeriodSystems).toEqual(Object.keys(approximatePeriodCoefficients))
    for (const evidenceId of Object.values(baseShearEvidenceIds)) {
      expect(getNormativeCitation(evidenceId), evidenceId).toBeDefined()
    }
  })

  it("anchors the corrected period and irregularity rules to pinned PDF transcriptions", () => {
    expect(getNormativeCitation("a4.2.2-period-ceiling")?.transcription).toContain(
      "calculado a partir de las propiedades del sistema",
    )
    expect(getNormativeCitation("a4.2.3-approximate-period")?.transcription).toContain(
      "Alternativamente el valor de T puede ser igual al período fundamental aproximado",
    )
    expect(getNormativeCitation("a3.4.2.2-dynamic-required")?.transcription).toContain(
      "1aA, 1bA, 2A y 3A",
    )
  })
})
