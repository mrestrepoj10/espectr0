// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
	default: () =>
		({ citations }: { citations: Array<{ physicalPage: number }> }) => (
			<div data-pdf-page={citations[0]?.physicalPage} />
		),
}));

import { adaptNsr10Spectrum, resolveSpectrumEvidence } from "@/lib/spectra";

import { EvidenceDocument, TraceabilityDetails } from "./traceability-details";

const params = {
	aa: 0.25,
	av: 0.25,
	ae: 0.15,
	ad: 0.09,
	soilProfile: "D",
	importanceGroup: "II",
} as const;
const cali = {
	municipality: {
		code: "76001",
		municipio: "Cali",
		departamento: "Valle del Cauca",
	},
} as const;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
});

describe("generic traceability details", () => {
	it("renders study, scenario, direct cells, lineage, source metadata, and fallback text", async () => {
		const result = adaptNsr10Spectrum(params, cali);
		await act(async () => {
			root.render(
				<TraceabilityDetails
					result={result}
					scenarioEvidenceKey={result.scenarioEvidenceKey}
				/>,
			);
		});

		expect(container.textContent).toContain("NSR-10 Nacional");
		expect(container.textContent).toContain("NSR-10-2010");
		expect(container.textContent).toContain("Cali, Valle del Cauca");
		expect(container.textContent).toContain("Valores directos de fuente");
		expect(container.textContent).toContain("Linaje del resultado");
		expect(container.textContent).toContain("Sa(T) por rama");
		expect(container.textContent).toContain("Instrumento de adopción");
		expect(container.textContent).toContain("Enlace oficial no disponible");
		expect(container.textContent).toContain("Página PDF 191");
		expect(container.textContent).toContain("Tabla:");
		expect(container.textContent).toContain("Fila:");
		expect(container.textContent).toContain("Celda:");
		expect(container.textContent).toContain("Transcripción accesible");
		expect(container.textContent).toContain(
			"47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0",
		);
	});

	it("renders an explicit unavailable state instead of a broken source viewer", async () => {
		const result = adaptNsr10Spectrum(params);
		await act(async () => {
			root.render(
				<TraceabilityDetails
					result={result}
					scenarioEvidenceKey={result.scenarioEvidenceKey}
				/>,
			);
		});

		expect(container.textContent).toContain("Evidencia no disponible");
		expect(container.textContent).toContain(
			"no declara una ubicación o zona verificable",
		);
		expect(container.textContent).not.toContain("Transcripción accesible");
	});

	it("renders one accessible source viewer per physical page", async () => {
		const result = adaptNsr10Spectrum(params, cali);
		const evidence = resolveSpectrumEvidence(result);
		const document = evidence.documents[0];
		const firstCell = evidence.citations.find(({ kind }) => kind === "cell");
		if (!document || !firstCell) throw new Error("Expected source fixtures");
		const secondPageCell = {
			...firstCell,
			id: `${firstCell.id}:page-192`,
			physicalPage: 192,
			printedPage: "A-178",
			transcription: "Celda accesible en segunda página",
		};

		await act(async () => {
			root.render(
				<EvidenceDocument
					citations={[firstCell, secondPageCell]}
					document={document}
				/>,
			);
		});

		expect(
			[...container.querySelectorAll("[data-pdf-page]")].map((node) =>
				node.getAttribute("data-pdf-page"),
			),
		).toEqual(["191", "192"]);
		expect(
			container.querySelector('[aria-label*="Página PDF 191"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[aria-label*="Página PDF 192"]'),
		).not.toBeNull();
		expect(container.textContent).toContain("Celda accesible en segunda página");
	});
});
