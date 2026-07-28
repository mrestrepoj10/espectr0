import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

import {
  SpectrumEngineRegistry,
  assertEngineResultIdentity,
  createSpectrumExport,
} from "../spectra"
import canonicalJson from "./data/canonical.json"
import {
  BOGOTA_ENGINE_ID,
  BOGOTA_FILL_SITE_SPECIFIC_THRESHOLD_METERS,
  BOGOTA_RIGID_BASE_SITE_SPECIFIC_THRESHOLD_SECONDS,
  BOGOTA_STUDY_ID,
  BOGOTA_STUDY_VERSION,
  adaptBogotaSpectrum,
  assertBogotaLineageResolves,
  bogotaBoundaryPolicy,
  bogotaCanonical,
  bogotaCanonicalSchema,
  bogotaComputationInputSchema,
  bogotaScenarioSchema,
  bogotaSpectrumEngine,
  bogotaTracePayloadSchema,
  createBogotaScenario,
  findBogotaHazard,
  preflightBogotaSpectrum,
  resolveBogotaCitation,
  resolveBogotaFormulaEvidence,
  resolveBogotaValueEvidence,
} from "."
import oracleJson from "./oracle/oracle.json"

type OracleWitness = {
  period: string
  branch: "ramp" | "plateau" | "decay" | "long"
  acceleration: string
}

type OracleRecord = {
  optionId: string
  hazardId: "design" | "limited-safety" | "damage-threshold"
  fields: Record<string, string>
  plateauToDecayJoinGap: string
  witnesses: OracleWitness[]
}

const oracleRecords = oracleJson.records as OracleRecord[]
const oracleBySelection = new Map(
  oracleRecords.map((record) => [
    `${record.optionId}/${record.hazardId}`,
    record,
  ]),
)

function successful(zoneId: string, hazardId: string, overrides = {}) {
  const result = adaptBogotaSpectrum({ zoneId, hazardId, ...overrides })
  if (result.status !== "ok") {
    throw new Error(`Expected successful Bogotá result, got ${result.status}`)
  }
  return result
}

function ordinate(result: ReturnType<typeof successful>, tSeconds: number) {
  const value = result.saAt(tSeconds)
  if (value.status !== "ok") {
    throw new Error(`Expected ordinate at T=${tSeconds}, got ${value.status}`)
  }
  return value.point
}

function shortBranch(branchId: string) {
  if (branchId.endsWith("ramp")) return "ramp"
  if (branchId.endsWith("plateau")) return "plateau"
  if (branchId.endsWith("decay")) return "decay"
  if (branchId.endsWith("long")) return "long"
  throw new Error(`Unexpected branch ${branchId}`)
}

function expectCloseToOracle(actual: number, expectedText: string) {
  const expected = Number(expectedText)
  const tolerance = Math.max(1e-12, Math.abs(expected) * 1e-12)
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

describe("Bogotá canonical runtime schema", () => {
  it("validates exactly 16 zones × 3 hazards × 6 fields", () => {
    const canonical = bogotaCanonicalSchema.parse(canonicalJson)
    expect(canonical.options).toHaveLength(16)
    expect(canonical.hazards).toHaveLength(3)
    expect(canonical.rows).toHaveLength(48)
    expect(
      canonical.rows.flatMap(({ fields }) => Object.values(fields)),
    ).toHaveLength(288)
  })

  it.each([
    [
      "duplicate row",
      (value: typeof canonicalJson) => {
        value.rows[1] = structuredClone(value.rows[0])
      },
    ],
    [
      "unexpected option",
      (value: typeof canonicalJson) => {
        value.rows[0].optionId = "synthetic-zone"
      },
    ],
    [
      "reversed boundaries",
      (value: typeof canonicalJson) => {
        value.rows[0].fields.transition_end = 9
      },
    ],
    [
      "nonzero graphical origin",
      (value: typeof canonicalJson) => {
        value.rows[0].fields.transition_start = 0.01
      },
    ],
  ])("fails closed for a synthetic %s", (_name, mutate) => {
    const synthetic = structuredClone(canonicalJson)
    mutate(synthetic)
    expect(bogotaCanonicalSchema.safeParse(synthetic).success).toBe(false)
  })
})

describe("Bogotá normalized adapter", () => {
  it.each(bogotaCanonical.rows)(
    "normalizes $optionId/$hazardId with complete evidence and direct lookup parity",
    (row) => {
      const result = successful(row.optionId, row.hazardId)
      expect(result.study).toEqual({
        id: BOGOTA_STUDY_ID,
        version: BOGOTA_STUDY_VERSION,
      })
      expect(result.scenarioEvidenceKey).toMatchObject({
        optionId: row.optionId,
        hazardId: row.hazardId,
      })
      expect(result.hazard.returnPeriodYears).toBe(
        bogotaCanonical.hazards.find(({ id }) => id === row.hazardId)!
          .returnPeriodYears,
      )
      expect(result.hazard.dampingRatio).toBe(
        bogotaCanonical.hazards.find(({ id }) => id === row.hazardId)!
          .dampingRatio,
      )
      expect(
        Object.fromEntries(result.metrics.map(({ id, unit }) => [id, unit])),
      ).toMatchObject({
        fa: "dimensionless",
        fv: "dimensionless",
        transition_start: "s",
        transition_end: "s",
        long_period: "s",
        ground_peak: "g",
        "sa-plateau": "g",
      })
      expect(result.points.length).toBeGreaterThan(200)
      for (const point of result.points) {
        expect(ordinate(result, point.tSeconds)).toEqual(point)
      }

      const trace = bogotaTracePayloadSchema.parse(result.trace.data)
      expect(trace.context.boundaryPolicy).toBe(bogotaBoundaryPolicy)
      expect(new Set(trace.steps.map(({ id }) => id)).size).toBe(
        trace.steps.length,
      )
      for (const step of trace.steps) {
        for (const evidenceId of step.evidenceIds) {
          expect(
            resolveBogotaValueEvidence(evidenceId) ??
              resolveBogotaFormulaEvidence(evidenceId),
          ).not.toBeNull()
        }
        step.citationIds.forEach((id) =>
          expect(resolveBogotaCitation(id)).not.toBeNull(),
        )
      }
      assertBogotaLineageResolves(createSpectrumExport(result).result)
      assertEngineResultIdentity(bogotaSpectrumEngine.metadata, result)
    },
  )

  it("uses the F2 scenario and engine contracts without activating a registry", () => {
    const scenario = createBogotaScenario({
      zoneId: "cerros",
      hazardId: "design",
    })
    expect(bogotaScenarioSchema.parse(scenario)).toEqual(scenario)
    expect(bogotaSpectrumEngine.accepts(scenario)).toBe(true)
    expect(bogotaSpectrumEngine.compute(scenario).status).toBe("ok")

    const isolatedRegistry = new SpectrumEngineRegistry()
    isolatedRegistry.register(bogotaSpectrumEngine)
    expect(isolatedRegistry.compute(BOGOTA_ENGINE_ID, scenario).status).toBe(
      "ok",
    )
  })

  it("snapshots normalized inputs and is deterministic", () => {
    const input = {
      zoneId: "cerros",
      hazardId: "design",
      importanceFactor: 1.25,
    }
    const first = successful(input.zoneId, input.hazardId, {
      importanceFactor: input.importanceFactor,
    })
    const before = JSON.stringify(createSpectrumExport(first))
    input.zoneId = "aluvial-300"
    input.importanceFactor = 9
    expect(JSON.stringify(createSpectrumExport(first))).toBe(before)

    const second = successful("cerros", "design", { importanceFactor: 1.25 })
    expect(JSON.stringify(createSpectrumExport(second))).toBe(before)
  })

  it.each([
    [{ zoneId: "unknown", hazardId: "design" }, "invalid-input"],
    [{ zoneId: "cerros", hazardId: "unknown" }, "invalid-input"],
    [{ zoneId: "cerros", hazardId: "design", importanceFactor: 0 }, "invalid-input"],
    [{ zoneId: "cerros", hazardId: "design", fillThicknessMeters: -1 }, "invalid-input"],
    [{ hazardId: "design" }, "invalid-input"],
    [null, "invalid-input"],
  ])("returns a typed result for adversarial input %#", (input, status) => {
    const result = adaptBogotaSpectrum(input)
    expect(result.status).toBe(status)
    expect(result.saAt(1).status).toBe(status)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, -Number.EPSILON])(
    "returns a typed invalid ordinate for T=%s",
    (period) => {
      const result = successful("cerros", "design")
      expect(result.saAt(period).status).toBe("invalid-input")
    },
  )

  it("keeps all 48 canonical rows typed and finite at Number.MAX_VALUE", () => {
    const observedBranches = new Set<string>()
    for (const row of bogotaCanonical.rows) {
      const result = adaptBogotaSpectrum({
        zoneId: row.optionId,
        hazardId: row.hazardId,
        importanceFactor: Number.MAX_VALUE,
      })
      expect(result.status, `${row.optionId}/${row.hazardId}`).toBe("ok")
      if (result.status !== "ok") continue
      expect(() => createSpectrumExport(result)).not.toThrow()

      for (const point of result.points) {
        expect(Number.isFinite(point.saG)).toBe(true)
        observedBranches.add(point.branchId)
      }
      const longPeriod = row.fields.long_period * 2
      const long = result.saAt(longPeriod)
      expect(long.status, `${row.optionId}/${row.hazardId} T=${longPeriod}`).toBe(
        "ok",
      )
      if (long.status === "ok") {
        expect(long.point.branchId).toMatch(/-long$/)
        expect(Number.isFinite(long.point.saG)).toBe(true)
      }
    }
    expect(observedBranches).toEqual(
      new Set([
        "bogota-design-plateau",
        "bogota-design-decay",
        "bogota-design-long",
        "bogota-limited-plateau",
        "bogota-limited-decay",
        "bogota-limited-long",
        "bogota-damage-ramp",
        "bogota-damage-plateau",
        "bogota-damage-decay",
        "bogota-damage-long",
      ]),
    )
  })

  it.each([
    ["lacustre-200", "design"],
    ["lacustre-200", "limited-safety"],
  ] as const)(
    "evaluates representable %s/%s long ordinates after division without intermediate overflow",
    (zoneId, hazardId) => {
      const row = bogotaCanonical.rows.find(
        (candidate) =>
          candidate.optionId === zoneId && candidate.hazardId === hazardId,
      )!
      const hazard = findBogotaHazard(hazardId)!
      const acceleration =
        hazard.id === "design"
          ? hazard.baseAccelerations.Av
          : hazard.id === "limited-safety"
            ? hazard.baseAccelerations.Ae
            : 0
      const tSeconds = row.fields.long_period * 2
      const oldNumerator =
        1.2 *
        acceleration *
        row.fields.fv *
        row.fields.long_period *
        Number.MAX_VALUE
      expect(oldNumerator).toBe(Number.POSITIVE_INFINITY)

      const result = successful(zoneId, hazardId, {
        importanceFactor: Number.MAX_VALUE,
      })
      const long = ordinate(result, tSeconds)
      const independentExpected =
        (Number.MAX_VALUE / tSeconds) *
        (1.2 * acceleration * row.fields.fv) *
        (row.fields.long_period / tSeconds)
      expect(Number.isFinite(long.saG)).toBe(true)
      expect(Math.abs(long.saG / independentExpected - 1)).toBeLessThan(1e-14)

      const extremePeriod = ordinate(result, Number.MAX_VALUE)
      expect(extremePeriod.branchId).toMatch(/-long$/)
      expect(Number.isFinite(extremePeriod.saG)).toBe(true)
      expect(extremePeriod.saG).toBeGreaterThan(0)
    },
  )

  it("fails closed in preflight when a mathematically required point is non-finite", () => {
    const row = structuredClone(
      bogotaCanonical.rows.find(
        ({ optionId, hazardId }) =>
          optionId === "cerros" && hazardId === "design",
      )!,
    )
    row.fields.fv = Number.MAX_VALUE
    const hazard = findBogotaHazard("design")!

    expect(() =>
      preflightBogotaSpectrum(row, hazard, Number.MAX_VALUE),
    ).not.toThrow()
    expect(
      preflightBogotaSpectrum(row, hazard, Number.MAX_VALUE),
    ).toMatchObject({
      status: "unsupported",
      reasonCode: "bogota-numerical-representation-unsupported",
    })
  })

  it("never throws for seeded schema-accepted importance factors or ordinate periods", () => {
    let state = 0x6d2b79f5
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 0x1_0000_0000
    }
    const fixedFactors = [
      Number.MIN_VALUE,
      Number.EPSILON,
      1,
      1e100,
      1e300,
      Number.MAX_VALUE,
    ]

    for (let index = 0; index < 192; index += 1) {
      const row = bogotaCanonical.rows[index % bogotaCanonical.rows.length]
      const exponent = Math.floor(random() * 2098) - 1074
      const generated = Math.min(
        Number.MAX_VALUE,
        (1 + random()) * 2 ** exponent,
      )
      const importanceFactor =
        index < fixedFactors.length ? fixedFactors[index] : generated
      const input = {
        zoneId: row.optionId,
        hazardId: row.hazardId,
        importanceFactor,
      }
      expect(bogotaComputationInputSchema.safeParse(input).success).toBe(true)

      let result: ReturnType<typeof adaptBogotaSpectrum> | undefined
      expect(() => {
        result = adaptBogotaSpectrum(input)
      }).not.toThrow()
      expect(result).toBeDefined()
      if (!result) continue
      expect(() => result!.saAt(Number.MAX_VALUE)).not.toThrow()
      expect(["ok", "unsupported"]).toContain(result.status)
      expect(["ok", "unsupported"]).toContain(
        result.saAt(Number.MAX_VALUE).status,
      )
    }
  })

  it("returns typed site-specific outcomes only above the approved strict limits", () => {
    expect(
      successful("cerros", "design", {
        fillThicknessMeters: BOGOTA_FILL_SITE_SPECIFIC_THRESHOLD_METERS,
        rigidBasePeriodSeconds:
          BOGOTA_RIGID_BASE_SITE_SPECIFIC_THRESHOLD_SECONDS,
      }).status,
    ).toBe("ok")

    for (const input of [
      {
        zoneId: "cerros",
        hazardId: "design",
        fillThicknessMeters:
          BOGOTA_FILL_SITE_SPECIFIC_THRESHOLD_METERS + 1e-9,
      },
      {
        zoneId: "cerros",
        hazardId: "design",
        rigidBasePeriodSeconds:
          BOGOTA_RIGID_BASE_SITE_SPECIFIC_THRESHOLD_SECONDS + 1e-9,
      },
    ]) {
      const result = adaptBogotaSpectrum(input)
      expect(result.status).toBe("site-specific-study-required")
      if (result.status !== "site-specific-study-required") {
        throw new Error("Expected typed site-specific Bogotá result")
      }
      expect(result.saAt(1).status).toBe("site-specific-study-required")
      expect(result.applicability.citationIds).toEqual([
        "warning-site-specific",
      ])
    }
  })
})

describe("Bogotá independent Decimal oracle", () => {
  it("matches every approved record and every independent witness", () => {
    expect(oracleRecords).toHaveLength(48)
    for (const record of oracleRecords) {
      const canonicalRow = bogotaCanonical.rows.find(
        ({ optionId, hazardId }) =>
          optionId === record.optionId && hazardId === record.hazardId,
      )!
      for (const [fieldId, expected] of Object.entries(record.fields)) {
        expect(
          canonicalRow.fields[fieldId as keyof typeof canonicalRow.fields],
        ).toBe(Number(expected))
      }
      const result = successful(record.optionId, record.hazardId)
      for (const witness of record.witnesses) {
        const point = ordinate(result, Number(witness.period))
        expect(shortBranch(point.branchId)).toBe(witness.branch)
        expectCloseToOracle(point.saG, witness.acceleration)
      }
    }
  })

  it("keeps every tabulated boundary left/exact/right and required joins", () => {
    const epsilon = 1e-9
    for (const row of bogotaCanonical.rows) {
      const result = successful(row.optionId, row.hazardId)
      const oracle = oracleBySelection.get(`${row.optionId}/${row.hazardId}`)!
      const { transition_start: t0, transition_end: tc, long_period: tl } =
        row.fields

      if (row.hazardId === "damage-threshold") {
        expect(shortBranch(ordinate(result, t0 - epsilon).branchId)).toBe("ramp")
        expect(shortBranch(ordinate(result, t0).branchId)).toBe("plateau")
        expect(shortBranch(ordinate(result, t0 + epsilon).branchId)).toBe(
          "plateau",
        )
        expect(
          Math.abs(
            ordinate(result, t0 - epsilon).saG - ordinate(result, t0).saG,
          ),
        ).toBeLessThan(1e-8)
      }

      expect(shortBranch(ordinate(result, tc - epsilon).branchId)).toBe(
        "plateau",
      )
      expect(shortBranch(ordinate(result, tc).branchId)).toBe("plateau")
      expect(shortBranch(ordinate(result, tc + epsilon).branchId)).toBe("decay")
      const observedJoinGap =
        ordinate(result, tc + epsilon).saG - ordinate(result, tc).saG
      expect(
        Math.abs(observedJoinGap - Number(oracle.plateauToDecayJoinGap)),
      ).toBeLessThan(1e-8)

      expect(shortBranch(ordinate(result, tl - epsilon).branchId)).toBe("decay")
      expect(shortBranch(ordinate(result, tl).branchId)).toBe("decay")
      expect(shortBranch(ordinate(result, tl + epsilon).branchId)).toBe("long")
      expect(
        Math.abs(ordinate(result, tl - epsilon).saG - ordinate(result, tl + epsilon).saG),
      ).toBeLessThan(1e-8)
    }
  })
})

describe("Bogotá ownership and purity", () => {
  it("does not import React, UI, routes, maps, GIS, or geocoding", async () => {
    const files = ["schema.ts", "evidence.ts", "engine.ts", "adapter.ts"]
    const content = (
      await Promise.all(
        files.map((file) => readFile(new URL(file, import.meta.url), "utf8")),
      )
    ).join("\n")
    expect(content).not.toMatch(/from ["']react/)
    expect(content).not.toMatch(/components|app\/|mapbox|leaflet|geocod|coordinate/i)
  })
})
