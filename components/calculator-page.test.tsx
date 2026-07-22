// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { downloadCalculationMemoriaPdf, toastSuccess } = vi.hoisted(() => ({
	downloadCalculationMemoriaPdf: vi.fn().mockResolvedValue(undefined),
	toastSuccess: vi.fn(),
}));

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
