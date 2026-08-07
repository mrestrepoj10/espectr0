import { isValidElement, type ReactNode } from "react"
import { describe, expect, it } from "vitest"

import {
  ccp14MemoriaPresentation,
  MunicipalMemoriaDocument,
} from "../municipal-memoria-pdf-renderer"
import { renderNormalizedSpectrumMemoriaPdf } from "../memoria-pdf-renderer"
import { adaptCcp14Spectrum } from "./adapter"

/** Collects every rendered string of a @react-pdf document tree. */
function documentText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (Array.isArray(node)) return node.map(documentText).join(" ")
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (!isValidElement(node)) return ""
  const { children, ...rest } = node.props as {
    children?: ReactNode
    [key: string]: unknown
  }
  const own =
    typeof node.type === "function"
      ? documentText(
          (node.type as (props: unknown) => ReactNode)(node.props),
        )
      : Object.values(rest)
          .filter((value): value is string => typeof value === "string")
          .join(" ")
  return `${own} ${documentText(children)}`
}

function normalizedDocumentText(node: ReactNode) {
  return documentText(node).replace(/\s+/g, " ")
}

const generalProcedureInput = {
  pgaG: 0.3,
  ssG: 0.75,
  s1G: 0.3,
  soilClass: "D" as const,
}

describe("CCP-14 memoria PDF", () => {
  it("is reachable through the contextual PDF registry", async () => {
    const result = adaptCcp14Spectrum(generalProcedureInput)
    expect(result.capabilities.contextualPdf).toEqual({ supported: true })

    const blob = await renderNormalizedSpectrumMemoriaPdf(result)
    expect(blob.size).toBeGreaterThan(1000)
  }, 30_000)

  it("renders when a published branch falls outside the sampled window", async () => {
    const result = adaptCcp14Spectrum({ ...generalProcedureInput, ssG: 0.001 })
    expect(result.status).toBe("ok")

    const blob = await renderNormalizedSpectrumMemoriaPdf(result)
    expect(blob.size).toBeGreaterThan(1000)
  }, 30_000)

  it("prints the official sources, hashes and cited pages", () => {
    const result = adaptCcp14Spectrum(generalProcedureInput)
    if (result.status !== "ok") throw new Error("Expected an applicable result")

    const text = normalizedDocumentText(
      <MunicipalMemoriaDocument
        presentation={ccp14MemoriaPresentation}
        result={result}
      />,
    )

    for (const expected of [
      "Resolución 0000108 del 26 de enero de 2015",
      "Ministerio de Transporte de Colombia",
      "Instituto Nacional de Vías (INVÍAS)",
      "e17c4aa764716c5533cb82499984f87e4eda032888c91544fab10b804d5a753a",
      "55f53d68dfc568a930b726b0c7dba510ea608128490353bf604f827a27ffc8ca",
      "idFile=29584",
      "idFile=29585",
      "CCP-14 3.10.2.1 - Procedimiento General",
      "impresa 3-46",
      "Figuras 3.10.2.1-1 a 3.10.2.1-3",
    ]) {
      expect(text).toContain(expected)
    }
  })
})
