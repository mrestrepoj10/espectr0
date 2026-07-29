import { describe, expect, it } from "vitest"

import { formatSpectrumReturnPeriod } from "../../components/spectrum-result"
import { formatMunicipalReturnPeriod } from "../municipal-memoria-pdf-renderer"

describe("unknown return-period presentation", () => {
  it("renders null truthfully in the shared spectrum UI", () => {
    expect(formatSpectrumReturnPeriod(null)).toBe("TR no declarado")
    expect(formatSpectrumReturnPeriod(475)).toBe("TR 475 años")
  })

  it("renders null truthfully in the municipal PDF", () => {
    expect(formatMunicipalReturnPeriod(null)).toBe(
      "período de retorno no declarado",
    )
    expect(formatMunicipalReturnPeriod(475)).toBe("475 años")
  })
})
