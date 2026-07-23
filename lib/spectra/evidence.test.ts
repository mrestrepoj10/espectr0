import { describe, expect, it } from "vitest"

import { adaptNsr10Spectrum } from "./nsr10-adapter"
import {
  SpectrumEvidenceResolverRegistry,
  resolveSpectrumEvidence,
} from "./evidence"
import { NSR10_ENGINE_ID } from "./nsr10-evidence"

const cali = {
  municipality: {
    code: "76001",
    municipio: "Cali",
    departamento: "Valle del Cauca",
  },
} as const

const params = {
  aa: 0.25,
  av: 0.25,
  ae: 0.15,
  ad: 0.09,
  soilProfile: "D",
  importanceGroup: "II",
  hazardLevel: "design",
} as const

describe("normalized scenario evidence", () => {
  it("resolves the active study, selection, exact cells, source lock, and lineage", () => {
    const result = adaptNsr10Spectrum(params, cali)
    const evidence = resolveSpectrumEvidence(result)

    expect(result.scenarioEvidenceKey).toEqual({
      studyId: "nsr10-national",
      studyVersion: "NSR-10-2010",
      optionId: "76001",
      hazardId: "design",
    })
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      status: "partial",
      study: { id: "nsr10-national", version: "NSR-10-2010" },
      selection: {
        optionId: "76001",
        location: "Cali, Valle del Cauca",
        hazardId: "design",
      },
      documents: [
        {
          edition: "Versión consolidada 2017",
          adoptionInstrument: null,
          officialUrl: null,
          sha256:
            "47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0",
        },
      ],
    })
    expect(evidence.directValues.map(({ id, value }) => [id, value])).toEqual([
      ["aa", 0.25],
      ["av", 0.25],
      ["ae", 0.15],
      ["ad", 0.09],
    ])
    expect(evidence.citations.filter(({ kind }) => kind === "row")).toHaveLength(1)
    expect(evidence.citations.filter(({ kind }) => kind === "cell")).toHaveLength(4)
    for (const value of evidence.directValues) {
      const citation = evidence.citations.find(({ id }) => id === value.citationId)
      expect(citation).toMatchObject({
        kind: "cell",
        physicalPage: 191,
        printedPage: "A-177",
        table: "Apéndice A-4",
        row: "Cali (76001)",
      })
    }
    expect(evidence.metricLineage.find(({ id }) => id === "tc")).toMatchObject({
      formulaId: "tc",
      dependencyIds: ["fa", "fv"],
    })
    expect(evidence.branchLineage.length).toBeGreaterThan(2)
    expect(evidence.branchLineage.every(({ pointCount }) => pointCount > 0)).toBe(true)
  })

  it("fails closed when a caller supplies a key for another scenario", () => {
    const result = adaptNsr10Spectrum(params, cali)
    expect(() =>
      resolveSpectrumEvidence(result, {
        ...result.scenarioEvidenceKey,
        optionId: "11001",
      }),
    ).toThrow(/does not match/)
  })

  it("returns an explicit unavailable state when no option evidence can resolve", () => {
    const result = adaptNsr10Spectrum(params)
    const evidence = resolveSpectrumEvidence(result)

    expect(result.scenarioEvidenceKey.optionId).toBeNull()
    expect(evidence).toMatchObject({
      status: "unavailable",
      documents: [],
      directValues: [],
      citations: [],
    })
    expect(evidence.unavailableClaims.map(({ id }) => id)).toContain(
      "scenario-option",
    )
  })

  it("keeps source cells visible for the typed site-specific outcome", () => {
    const result = adaptNsr10Spectrum(
      { ...params, soilProfile: "F" },
      cali,
    )
    const evidence = resolveSpectrumEvidence(result)

    expect(result.status).toBe("site-specific-study-required")
    expect(evidence.directValues).toHaveLength(4)
    expect(evidence.metricLineage).toEqual([])
    expect(evidence.branchLineage).toEqual([])
    expect(evidence.unavailableClaims.map(({ id }) => id)).toContain(
      "site-specific-clause-region",
    )
  })

  it("does not invent evidence for an unregistered engine", () => {
    const result = adaptNsr10Spectrum(params, cali)
    const evidence = resolveSpectrumEvidence({
      ...result,
      engine: { ...result.engine, id: "future-study-engine" },
    })

    expect(evidence.status).toBe("unavailable")
    expect(evidence.unavailableClaims).toEqual([
      expect.objectContaining({ id: "evidence-resolver" }),
    ])
  })

  it("rejects duplicate providers and provider views with orphan direct values", () => {
    const result = adaptNsr10Spectrum(params, cali)
    const canonical = resolveSpectrumEvidence(result)
    const resolver = {
      engineId: NSR10_ENGINE_ID,
      resolve: () => ({
        ...canonical,
        directValues: canonical.directValues.map((value, index) =>
          index === 0 ? { ...value, citationId: "missing-cell" } : value,
        ),
      }),
    }
    const registry = new SpectrumEvidenceResolverRegistry().register(resolver)

    expect(() => registry.register(resolver)).toThrow(/already registered/)
    expect(() => registry.resolve(result)).toThrow(/no cell citation/)
  })
})
