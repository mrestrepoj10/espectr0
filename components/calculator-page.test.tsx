// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
	adaptNsr10SpectrumMock,
	downloadCalculationMemoriaPdf,
	spectrumMockState,
	toastSuccess,
} = vi.hoisted(() => ({
	adaptNsr10SpectrumMock: vi.fn(),
	downloadCalculationMemoriaPdf: vi.fn().mockResolvedValue(undefined),
	spectrumMockState: {
		actualAdapter: undefined as
			| ((...args: unknown[]) => unknown)
			| undefined,
	},
	toastSuccess: vi.fn(),
}));

vi.mock("@/lib/spectra", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/spectra")>();
	spectrumMockState.actualAdapter = actual.adaptNsr10Spectrum as (
		...args: unknown[]
	) => unknown;
	adaptNsr10SpectrumMock.mockImplementation(spectrumMockState.actualAdapter);
	return { ...actual, adaptNsr10Spectrum: adaptNsr10SpectrumMock };
});

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: toastSuccess,
	},
}));

vi.mock("@/lib/memoria-pdf-renderer", () => ({
	downloadCalculationMemoriaPdf,
}));

import { CalculatorPage } from "./calculator-page";

class ResizeObserverStub implements ResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

let container: HTMLDivElement;
let root: Root;

async function waitForElement(
	selector: string,
	text: string,
	timeoutMs = 2_000,
) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const match = [...document.querySelectorAll<HTMLElement>(selector)].find(
			(element) => element.textContent?.includes(text),
		);
		if (match) return match;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
	}
	throw new Error(`Could not find ${selector} containing “${text}”.`);
}

beforeAll(() => {
	Object.assign(globalThis, {
		IS_REACT_ACT_ENVIRONMENT: true,
		ResizeObserver: ResizeObserverStub,
	});
	if (!("PointerEvent" in window)) {
		Object.defineProperty(window, "PointerEvent", { value: MouseEvent });
	}
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			addEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
			matches: false,
			media: query,
			onchange: null,
			removeEventListener: vi.fn(),
		})),
	});
	Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(async () => {
	const actualAdapter = spectrumMockState.actualAdapter;
	if (!actualAdapter) throw new Error("The real NSR-10 adapter was not loaded.");
	adaptNsr10SpectrumMock.mockReset();
	adaptNsr10SpectrumMock.mockImplementation(actualAdapter);
	downloadCalculationMemoriaPdf.mockClear();
	toastSuccess.mockClear();
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () => {
		root.render(<CalculatorPage />);
	});
});

afterEach(async () => {
	await act(async () => {
		root.unmount();
	});
	container.remove();
	document.body.replaceChildren();
});

describe("calculator contextual PDF action", () => {
	it("opens the real export menu and downloads a successful trace", async () => {
		const exportTrigger = await waitForElement("button", "Exportar");
		expect(exportTrigger).not.toHaveProperty("disabled", true);

		await act(async () => {
			exportTrigger.click();
		});

		const pdfAction = await waitForElement(
			'[role="menuitem"]',
			"Descargar memoria PDF",
		);
		expect(document.body.contains(pdfAction)).toBe(true);

		await act(async () => {
			pdfAction.click();
		});

		await vi.waitFor(() => {
			expect(downloadCalculationMemoriaPdf).toHaveBeenCalledTimes(1);
		});
		expect(downloadCalculationMemoriaPdf).toHaveBeenCalledWith(
			expect.objectContaining({
				inputs: expect.objectContaining({ mode: "general" }),
			}),
		);
		expect(toastSuccess).toHaveBeenCalledWith("Memoria PDF descargada.");
	});
});

describe("unified calculator NSR-10 mode", () => {
	it("renders the controlled shell, shared Sa(T) lookup, and current default result", () => {
		const shell = container.querySelector<HTMLElement>("[data-slot='calculator-shell']");
		expect(shell?.dataset.calculationMode).toBe("nsr10-national");
		expect(container.textContent).toContain("NSR-10 Nacional");
		expect(container.querySelector("#period-lookup-input")).toBeTruthy();
		expect(container.querySelector("output")?.textContent).toMatch(/g/);
		expect(container.textContent).toContain("Datos del espectro");
	});

	it("renders the typed site-specific applicability state for soil profile F", async () => {
		const profileF = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
			(button) => button.textContent?.trim() === "F",
		);
		expect(profileF).toBeTruthy();

		await act(async () => {
			profileF?.click();
		});

		await vi.waitFor(() => {
			expect(container.textContent).toContain("Perfil F: análisis específico requerido");
		});
		const notices = container.querySelector<HTMLElement>(
			"[data-slot='calculator-notices']",
		);
		expect(notices?.dataset.applicability).toBe(
			"site-specific-study-required",
		);
		expect(container.querySelector("#period-lookup-input")).toBeNull();
	});

	it("renders unavailable state only from the normalized engine result", async () => {
		adaptNsr10SpectrumMock.mockImplementation((...args: unknown[]) => {
			const actualResult = spectrumMockState.actualAdapter?.(...args);
			if (
				typeof actualResult !== "object" ||
				actualResult === null ||
				!("status" in actualResult) ||
				actualResult.status === "ok"
			) {
				return actualResult;
			}
			const result = actualResult as Exclude<
				ReturnType<typeof import("@/lib/spectra").adaptNsr10Spectrum>,
				{ status: "ok" }
			>;
			return {
				...result,
				applicability: {
					...result.applicability,
					message: "APPLICABILITY_FROM_NORMALIZED_RESULT",
				},
				capabilities: {
					...result.capabilities,
					traceabilityViewer: {
						supported: false,
						reason: "TRACEABILITY_DISABLED_BY_NORMALIZED_RESULT",
					},
				},
				warnings: [
					{
						citationIds: [],
						code: "normalized-result-warning",
						message: "WARNING_FROM_NORMALIZED_RESULT",
						severity: "error",
					},
				],
			};
		});

		const profileF = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
			(button) => button.textContent?.trim() === "F",
		);
		await act(async () => {
			profileF?.click();
		});

		await vi.waitFor(() => {
			expect(container.textContent).toContain(
				"APPLICABILITY_FROM_NORMALIZED_RESULT",
			);
		});
		expect(container.textContent).toContain("WARNING_FROM_NORMALIZED_RESULT");
		const traceabilityAction = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
			(button) => button.textContent?.includes("Ver trazabilidad"),
		);
		expect(traceabilityAction?.disabled).toBe(true);
		expect(traceabilityAction?.title).toBe(
			"TRACEABILITY_DISABLED_BY_NORMALIZED_RESULT",
		);
		expect(container.textContent).not.toContain("Exportar");
	});
});
