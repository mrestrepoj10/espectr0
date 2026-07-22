import { getMunicipalityTraceability } from "./nsr10/evidence"

import type { CalculationTrace, SpectrumPoint } from "./nsr10"

export type MemoriaSource = {
  document: string
  appendix: string | null
  municipalityPage: number | null
  municipalityPrintedPage: string | null
  pdfPath: string | null
  sourceUrl: string | null
  pdfSha256: string | null
  references: string[]
}

export type SpectrumChartGeometry = {
  path: string
  width: number
  height: number
  plotLeft: number
  plotTop: number
  plotWidth: number
  plotHeight: number
  maxT: number
  maxSa: number
}

export function slugifyPdfPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function calculationMemoriaFilename(trace: CalculationTrace) {
  const municipality = trace.context.municipality?.name ?? "sin-municipio"
  return `espectr0-memoria-${slugifyPdfPart(municipality)}-${trace.context.hazardLevel}.pdf`
}

export function flattenTracePoints(trace: CalculationTrace): SpectrumPoint[] {
  const byPeriod = new Map<number, SpectrumPoint>()
  for (const branch of trace.branches) {
    for (const point of branch.points) byPeriod.set(point.t, point)
  }
  return [...byPeriod.values()].sort((left, right) => left.t - right.t)
}

/** Selects formula checks at spectral branch boundaries, excluding chart-only endpoints. */
export function selectRepresentativeBoundaryPoints(trace: CalculationTrace) {
  return trace.representativePoints.filter(
    ({ label }) => label !== "Final del intervalo graficado",
  )
}

export function createSpectrumChartGeometry(
  points: SpectrumPoint[],
  width = 480,
  height = 210,
): SpectrumChartGeometry {
  if (points.length === 0) throw new Error("A spectrum chart needs at least one point")

  const plotLeft = 38
  const plotTop = 12
  const plotWidth = width - plotLeft - 12
  const plotHeight = height - plotTop - 30
  const maxT = Math.max(...points.map(({ t }) => t), 1)
  const maxSa = Math.max(...points.map(({ sa }) => sa), 0.01) * 1.08
  const coordinates = points.map(({ t, sa }) => ({
    x: plotLeft + (t / maxT) * plotWidth,
    y: plotTop + plotHeight - (sa / maxSa) * plotHeight,
  }))
  const path = coordinates
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")

  return {
    path,
    width,
    height,
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
    maxT,
    maxSa,
  }
}

export function collectMemoriaSource(trace: CalculationTrace): MemoriaSource {
  const code = trace.context.municipality?.code
  const evidence = code ? getMunicipalityTraceability(code) : undefined
  const references = new Set<string>()

  for (const step of trace.steps) references.add(step.reference)
  for (const branch of trace.branches) references.add(branch.reference)
  for (const point of selectRepresentativeBoundaryPoints(trace)) {
    references.add(point.step.reference)
  }

  return {
    document: trace.context.document,
    appendix: evidence?.source.appendix ?? null,
    municipalityPage: evidence?.pageNumber ?? null,
    municipalityPrintedPage: evidence?.printedPage ?? null,
    pdfPath: evidence?.source.pdfPath ?? null,
    sourceUrl: evidence?.source.sourceUrl ?? null,
    pdfSha256: evidence?.source.pdfSha256 ?? null,
    references: [...references].sort((left, right) => left.localeCompare(right, "es")),
  }
}

export function formatTraceNumber(value: number, maximumFractionDigits = 4) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
    useGrouping: false,
  }).format(value)
}

/** Keeps equations within the glyph set supported by the embedded PDF fonts. */
export function normalizePdfText(value: string) {
  return value
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/\u00a0/g, " ")
}
