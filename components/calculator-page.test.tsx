import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { downloadCalculationMemoriaPdf, toastSuccess } = vi.hoisted(() => ({
	downloadCalculationMemoriaPdf: vi.fn().mockResolvedValue(undefined),
	toastSuccess: vi.fn(),
}));

vi.mock("react", async () => {
	const react = await vi.importActual<typeof import("react")>("react");
	return {
		...react,
		useMemo: <T,>(factory: () => T) => factory(),
		useRef: <T,>(initialValue: T) => ({ current: initialValue }),
		useState: <T,>(initialValue: T | (() => T)) => [
			typeof initialValue === "function"
				? (initialValue as () => T)()
				: initialValue,
			vi.fn(),
		],
	};
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

function findElement(
	node: ReactNode,
	predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>> | undefined {
	if (Array.isArray(node)) {
		for (const child of node) {
			const match = findElement(child, predicate);
			if (match) return match;
		}
		return undefined;
	}
	if (!isValidElement<Record<string, unknown>>(node)) return undefined;
	if (predicate(node)) return node;
	return findElement(node.props.children as ReactNode, predicate);
}

function renderFunctionElement(
	element: ReactElement<Record<string, unknown>>,
): ReactNode {
	if (typeof element.type !== "function") {
		throw new Error("Expected a function component element.");
	}
	const Component = element.type as (
		props: Record<string, unknown>,
	) => ReactNode;
	return Component(element.props);
}

function componentName(element: ReactElement<Record<string, unknown>>) {
	return typeof element.type === "function" ? element.type.name : "";
}

function hasText(node: ReactNode, text: string): boolean {
	if (typeof node === "string") return node.includes(text);
	if (Array.isArray(node)) return node.some((child) => hasText(child, text));
	return isValidElement<Record<string, unknown>>(node)
		? hasText(node.props.children as ReactNode, text)
		: false;
}

describe("calculator contextual PDF action", () => {
	beforeEach(() => {
		downloadCalculationMemoriaPdf.mockClear();
		toastSuccess.mockClear();
	});

	it("invokes the contextual PDF downloader from a successful result", async () => {
		const calculator = CalculatorPage();
		const spectrumChart = findElement(
			calculator,
			(element) => componentName(element) === "SpectrumChart",
		);
		expect(spectrumChart).toBeDefined();

		const chart = renderFunctionElement(spectrumChart!);
		const exportActions = findElement(
			chart,
			(element) => componentName(element) === "ExportActions",
		);
		expect(exportActions).toBeDefined();

		const actions = renderFunctionElement(exportActions!);
		const exportTrigger = findElement(
			actions,
			(element) =>
				"disabled" in element.props &&
				hasText(element.props.children as ReactNode, "Exportar"),
		);
		expect(exportTrigger?.props.disabled).toBe(false);

		const pdfAction = findElement(
			actions,
			(element) =>
				typeof element.props.onClick === "function" &&
				hasText(
					element.props.children as ReactNode,
					"Descargar memoria PDF",
				),
		);
		expect(pdfAction).toBeDefined();

		(pdfAction!.props.onClick as () => void)();

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
