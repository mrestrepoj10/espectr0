// @vitest-environment jsdom

import { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { readFileSync } from "node:fs"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  CalculatorNotices,
  CalculatorShell,
  SpectrumPeriodLookup,
} from "./calculator-shell"

class ResizeObserverStub implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

let container: HTMLDivElement
let root: Root

async function waitForElement(selector: string, text: string, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const match = [...document.querySelectorAll<HTMLElement>(selector)].find(
      (element) => element.textContent?.includes(text),
    )
    if (match) return match
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
  throw new Error(`Could not find ${selector} containing “${text}”.`)
}

beforeAll(() => {
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: ResizeObserverStub,
  })
  if (!("PointerEvent" in window)) {
    Object.defineProperty(window, "PointerEvent", { value: MouseEvent })
  }
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
  document.body.replaceChildren()
})

describe("controlled unified calculator shell", () => {
  it("switches the controlled calculation mode and its input-panel slot", async () => {
    function Harness() {
      const [mode, setMode] = useState("nsr10-national")
      return (
        <CalculatorShell
          inputPanel={<p>{mode} inputs</p>}
          modes={[
            {
              id: "nsr10-national",
              label: "NSR-10 Nacional",
              description: "National building spectrum.",
            },
            {
              id: "ccp14-test",
              label: "CCP-14 test mode",
              description: "Test-only second controlled mode.",
            },
          ]}
          onValueChange={setMode}
          value={mode}
        >
          <p>{mode} result</p>
        </CalculatorShell>
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })

    const shell = container.querySelector<HTMLElement>("[data-slot='calculator-shell']")
    const inputPanel = container.querySelector<HTMLElement>("[data-slot='mode-input-panel']")
    const results = container.querySelector<HTMLElement>("[data-slot='calculator-results']")
    expect(shell?.dataset.calculationMode).toBe("nsr10-national")
    expect(inputPanel?.textContent).toContain("nsr10-national inputs")
    expect(results?.textContent).toContain("nsr10-national result")

    const trigger = await waitForElement("button", "NSR-10 Nacional")
    await act(async () => {
      trigger.click()
    })
    const nextMode = await waitForElement('[role="option"]', "CCP-14 test mode")
    await act(async () => {
      nextMode.click()
    })

    expect(shell?.dataset.calculationMode).toBe("ccp14-test")
    expect(inputPanel?.textContent).toContain("ccp14-test inputs")
    expect(results?.textContent).toContain("ccp14-test result")
  })

  it("exposes responsive regions and accessible labels", async () => {
    await act(async () => {
      root.render(
        <CalculatorShell
          inputPanel={<p>Inputs</p>}
          modes={[
            {
              id: "nsr10-national",
              label: "NSR-10 Nacional",
              description: "National spectrum.",
            },
          ]}
          onValueChange={() => undefined}
          value="nsr10-national"
        >
          <p>Results</p>
        </CalculatorShell>,
      )
    })

    const grid = container.querySelector("[data-slot='mode-input-panel']")?.parentElement
    expect(grid?.className).toContain("minmax(0,1fr)")
    expect(container.querySelector("aside")?.getAttribute("aria-label")).toBe(
      "Entradas del modo seleccionado",
    )
    expect(
      container.querySelector("[data-slot='calculator-results']")?.getAttribute("aria-label"),
    ).toBe("Resultado del cálculo")
    expect(container.querySelector("[aria-describedby='calculation-mode-description']")).toBeTruthy()
  })
})

describe("shared result behavior", () => {
  it("evaluates Sa(T) through the supplied engine callback and validates the period", async () => {
    const evaluate = vi.fn((periodSeconds: number) => ({
      status: "ok" as const,
      saG: periodSeconds + 0.25,
      branchLabel: "Engine branch",
    }))
    await act(async () => {
      root.render(<SpectrumPeriodLookup evaluate={evaluate} />)
    })

    expect(evaluate).toHaveBeenCalledWith(1)
    expect(container.querySelector("output")?.textContent).toContain("1.250000 g")

    const input = container.querySelector<HTMLInputElement>("#period-lookup-input")
    expect(input).toBeTruthy()
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set
    await act(async () => {
      valueSetter?.call(input, "2")
      input?.dispatchEvent(new Event("input", { bubbles: true }))
    })

    expect(evaluate).toHaveBeenLastCalledWith(2)
    expect(container.querySelector("output")?.textContent).toContain("2.250000 g")

    await act(async () => {
      valueSetter?.call(input, "-1")
      input?.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(input?.getAttribute("aria-invalid")).toBe("true")
    expect(container.textContent).toContain("mayor o igual que cero")
  })

  it("renders typed applicability and warning states", async () => {
    await act(async () => {
      root.render(
        <CalculatorNotices
          applicability="site-specific-study-required"
          notices={[
            {
              code: "site-specific",
              severity: "warning",
              title: "Estudio específico requerido",
              message: "El motor no emite un espectro para esta entrada.",
            },
          ]}
        />,
      )
    })

    const notices = container.querySelector<HTMLElement>("[data-slot='calculator-notices']")
    expect(notices?.dataset.applicability).toBe("site-specific-study-required")
    expect(notices?.getAttribute("aria-label")).toBe("Advertencias y aplicabilidad")
    expect(notices?.textContent).toContain("El motor no emite un espectro")
  })
})

describe("formula ownership", () => {
  it("keeps known NSR-10 engineering formulas out of calculator components", () => {
    const source = [
      readFileSync("components/calculator-page.tsx", "utf8"),
      readFileSync("components/calculator-shell.tsx", "utf8"),
      readFileSync("components/spectrum-result.tsx", "utf8"),
    ].join("\n")

    for (const formulaPattern of [
      /0\.48\s*\*/,
      /2\.5\s*\*/,
      /1\.25\s*\*/,
      /2\.4\s*\*/,
      /3\s*\*\s*params\./,
      /\/\s*denominator/,
    ]) {
      expect(source).not.toMatch(formulaPattern)
    }
    expect(source).toContain("result.saAt(periodSeconds)")
  })
})
