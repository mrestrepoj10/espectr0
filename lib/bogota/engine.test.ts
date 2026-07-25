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
  bogotaScenarioSchema,
  bogotaSpectrumEngine,
  bogotaTracePayloadSchema,
  createBogotaScenario,
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
