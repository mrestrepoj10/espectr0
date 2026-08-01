// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentProps } from "react";

const {
	adaptNsr10SpectrumMock,
	downloadNormalizedSpectrumMemoriaPdf,
	spectrumMockState,
	toastSuccess,
} = vi.hoisted(() => ({
	adaptNsr10SpectrumMock: vi.fn(),
	downloadNormalizedSpectrumMemoriaPdf: vi.fn().mockResolvedValue(undefined),
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

vi.mock("@/components/spectrum-result", async (importOriginal) => {
	const actual = await importOriginal<
		typeof import("@/components/spectrum-result")
	>();
	const { forwardRef } = await import("react");
	const SharedSpectrumChart = forwardRef<
		HTMLDivElement,
		ComponentProps<typeof actual.SharedSpectrumChart>
	>(function SharedSpectrumChartStub(
		{ actions, result, title, transitionMetrics = [] },
		ref,
	) {
		return (
			<div data-slot="shared-spectrum-chart" ref={ref}>
				<span>{title}</span>
				<span data-slot="chart-return-period">
					{actual.formatSpectrumReturnPeriod(result.hazard.returnPeriodYears)}
				</span>
				<span data-slot="chart-period-domain">
					{result.points.at(0)?.tSeconds}–{result.points.at(-1)?.tSeconds}
				</span>
				<span data-slot="chart-transition-labels">
					{transitionMetrics.map(({ label }) => label).join(" · ")}
				</span>
				{actions}
			</div>
		);
	});
	return { ...actual, SharedSpectrumChart };
});

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: toastSuccess,
	},
}));

vi.mock("@/lib/memoria-pdf-renderer", () => ({
	downloadNormalizedSpectrumMemoriaPdf,
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

async function chooseSelectOption(triggerId: string, label: string) {
	const trigger = document.querySelector<HTMLButtonElement>(`#${triggerId}`);
	expect(trigger).toBeTruthy();
	await act(async () => {
		trigger?.click();
	});
	const option = await waitForElement('[role="option"]', label);
	await act(async () => {
		option.click();
	});
}

async function setNumberInput(id: string, value: string) {
	const input = document.querySelector<HTMLInputElement>(`#${id}`);
	expect(input).toBeTruthy();
	await act(async () => {
		const setter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		setter?.call(input, value);
		input?.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

function chartAnnotationText() {
	return container.querySelector<HTMLElement>("[data-slot='chart-transition-labels']")
		?.textContent ?? "";
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
	downloadNormalizedSpectrumMemoriaPdf.mockClear();
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
			expect(downloadNormalizedSpectrumMemoriaPdf).toHaveBeenCalledTimes(1);
		});
		expect(downloadNormalizedSpectrumMemoriaPdf).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "ok",
				scenarioEvidenceKey: expect.objectContaining({
					studyId: "nsr10-national",
					optionId: "76001",
				}),
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

	it("labels NSR-10 damage chart transitions as TCd and TLd", async () => {
		const hazardTrigger = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Nivel de amenaza"]',
		);
		expect(hazardTrigger).toBeTruthy();
		await act(async () => {
			hazardTrigger?.click();
		});
		const damageOption = await waitForElement(
			'[role="option"]',
			"Umbral de daño",
		);
		await act(async () => {
			damageOption.click();
		});

		await vi.waitFor(() => {
			expect(chartAnnotationText()).toContain("TCd");
			expect(chartAnnotationText()).toContain("TLd");
		});
	});
});

describe("unified municipal mode selector", () => {
	async function chooseMode(label: string) {
		await chooseSelectOption("calculation-mode-trigger", label);
	}

	it("switches NSR, Bogotá, and Cali while preserving independent active results", async () => {
		await chooseMode("Bogotá D. C.");

		await vi.waitFor(() => {
			const shell = container.querySelector<HTMLElement>(
				"[data-slot='calculator-shell']",
			);
			expect(shell?.dataset.calculationMode).toBe("bogota-microzonation");
		});
		expect(container.textContent).toContain("Parámetros de Bogotá");
		expect(container.textContent).toContain("Seleccione…");
		expect(container.textContent).toContain("Selecciona la zona de Bogotá");
		expect(container.textContent).not.toContain("Datos del espectro");
		await chooseSelectOption("bogota-zone-trigger", "CERROS");
		await vi.waitFor(() => {
			expect(container.textContent).toContain("Datos del espectro");
		});
		expect(container.textContent).toContain("Datos del espectro");
		expect(container.textContent).toContain("Validación profesional obligatoria");
		expect(container.textContent).toContain("CERROS");

		await chooseMode("Cali");
		await vi.waitFor(() => {
			expect(
				container.querySelector<HTMLElement>("[data-slot='calculator-shell']")
					?.dataset.calculationMode,
			).toBe("cali-microzonation");
		});
		expect(container.textContent).toContain("Parámetros de Cali");
		expect(container.textContent).toContain("Selecciona la zona de Cali");
		expect(container.textContent).not.toContain("Datos del espectro");
		await chooseSelectOption("cali-zone-trigger", "Zona 1");
		await vi.waitFor(() => {
			expect(container.textContent).toContain("Datos del espectro");
		});

		await chooseMode("NSR-10 Nacional");
		await vi.waitFor(() => {
			expect(container.querySelector("#period-lookup-input")).toBeTruthy();
		});
		expect(container.textContent).toContain("Parámetros del sitio");
	});

	it("renders Bogotá typed site-specific and invalid outcomes from the adapter", async () => {
		await chooseMode("Bogotá D. C.");
		await chooseSelectOption("bogota-zone-trigger", "CERROS");
		await setNumberInput("bogota-fill-thickness", "3.1");

		await vi.waitFor(() => {
			expect(container.textContent).toContain(
				"Estudio de respuesta sísmica particular requerido",
			);
		});
		expect(container.textContent).toContain("supera 3 m");
		expect(container.querySelector("#period-lookup-input")).toBeNull();

		await setNumberInput("bogota-fill-thickness", "");
		await setNumberInput("bogota-importance-factor", "0");
		await vi.waitFor(() => {
			expect(container.textContent).toContain("Resultado no disponible");
		});
		expect(container.textContent).toContain("Entrada inválida");
	});

	it("labels Bogotá damage chart transitions as T0d, TCd, and TLd", async () => {
		await chooseMode("Bogotá D. C.");
		await chooseSelectOption("bogota-zone-trigger", "CERROS");
		await chooseSelectOption("bogota-hazard-trigger", "Umbral de daño");

		await vi.waitFor(() => {
			expect(chartAnnotationText()).toContain("T0d");
			expect(chartAnnotationText()).toContain("TCd");
			expect(chartAnnotationText()).toContain("TLd");
		});
	});

	it("keeps Cali damage threshold visible as a localized unsupported result", async () => {
		await chooseMode("Cali");
		await chooseSelectOption("cali-zone-trigger", "Zona 1");
		await chooseSelectOption("cali-hazard-trigger", "Umbral de daño");

		await vi.waitFor(() => {
			expect(container.textContent).toContain("Resultado no disponible");
		});
		expect(container.textContent).toContain("no publica A0d ni Fa");
		expect(container.textContent).toContain("Validación profesional obligatoria");
		expect(container.textContent).not.toContain("Datos del espectro");
		expect(container.textContent).not.toContain("Exportar");
	});

	it("uses result capability metadata to gate Bogotá and enable Cali actions", async () => {
		await chooseMode("Bogotá D. C.");
		await chooseSelectOption("bogota-zone-trigger", "CERROS");
		const bogotaTrace = await waitForElement("button", "Ver trazabilidad");
		expect(bogotaTrace).toHaveProperty("disabled", true);
		expect(bogotaTrace.title).toContain("resolvedor del visor");

		const bogotaExport = await waitForElement("button", "Exportar");
		await act(async () => {
			bogotaExport.click();
		});
		const bogotaPdf = await waitForElement(
			'[role="menuitem"]',
			"Descargar memoria PDF",
		);
		expect(bogotaPdf.getAttribute("aria-disabled")).toBe("true");
		expect(bogotaPdf.title).toContain("renderizador PDF");

		await act(async () => {
			document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		});
		await chooseMode("Cali");
		await chooseSelectOption("cali-zone-trigger", "Zona 1");
		const caliTrace = await waitForElement("button", "Ver trazabilidad");
		expect(caliTrace).not.toHaveProperty("disabled", true);
	});

	it("presents ten Cali zones and requires a curve choice for concurrent zones", async () => {
		await chooseMode("Cali");
		const trigger = document.querySelector<HTMLButtonElement>("#cali-zone-trigger");
		await act(async () => {
			trigger?.click();
		});
		await waitForElement('[role="option"]', "Zona 1");
		const zoneOptions = [
			...document.querySelectorAll<HTMLElement>('[role="option"]'),
		].filter((option) => option.textContent?.trim().startsWith("Zona "));
		expect(zoneOptions.length).toBe(10);
		const zone4b = zoneOptions
			.find((option) => option.textContent?.trim() === "Zona 4B");
		expect(zone4b).toBeTruthy();
		await act(async () => {
			zone4b?.click();
		});

		expect(container.textContent).toContain("Comprobación concurrente");
		expect(container.textContent).toContain("verificar independientemente");
		expect(container.textContent).toContain("Selecciona el componente de curva");
		expect(container.textContent).not.toContain("Datos del espectro");
		await chooseSelectOption("cali-component-trigger", "componente Tc");
		await vi.waitFor(() => {
			expect(container.textContent).toContain("Datos del espectro");
		});
	});

	it("exposes keyboard-labelled manual selectors and no map or GIS controls", async () => {
		await chooseMode("Bogotá D. C.");
		for (const id of ["bogota-zone-trigger", "bogota-hazard-trigger"]) {
			const trigger = document.querySelector<HTMLElement>(`#${id}`);
			expect(trigger?.getAttribute("role")).toBe("combobox");
			expect(trigger?.getAttribute("tabindex")).not.toBe("-1");
		}
		expect(container.querySelector("[data-slot='manual-zone-warning']")).toBeTruthy();
		const interactiveText = [...container.querySelectorAll("button, input")]
			.map((element) => element.textContent ?? element.getAttribute("aria-label") ?? "")
			.join(" ")
			.toLowerCase();
		expect(interactiveText).not.toMatch(/mapa|gis|coordenad|ubicación automática/);
	});

	it("activates Medellín only after selecting one of 14 zones and an explicit hazard", async () => {
		await chooseMode("Medellín");
		expect(container.textContent).toContain("Parámetros de Medellín");
		expect(container.textContent).toContain("Selecciona la zona de Medellín");
		expect(container.textContent).not.toContain("Datos del espectro");
		expect(container.textContent).not.toContain(String.fromCodePoint(0xfffd));

		const zoneTrigger = document.querySelector<HTMLButtonElement>(
			"#medellin-zone-trigger",
		);
		await act(async () => zoneTrigger?.click());
		await waitForElement('[role="option"]', "Zona homogénea 1");
		const zoneOptions = [
			...document.querySelectorAll<HTMLElement>('[role="option"]'),
		].filter((option) =>
			option.textContent?.trim().startsWith("Zona homogénea"),
		);
		expect(zoneOptions).toHaveLength(14);
		await act(async () => {
			zoneOptions
				.find((option) => option.textContent?.includes("Zona homogénea 12"))
				?.click();
		});

		expect(container.textContent).toContain(
			"Selecciona la familia de amenaza de Medellín",
		);
		expect(container.textContent).not.toContain("Datos del espectro");
		const hazardTrigger = document.querySelector<HTMLButtonElement>(
			"#medellin-hazard-trigger",
		);
		await act(async () => hazardTrigger?.click());
		await waitForElement('[role="option"]', "Sismo de diseño");
		const hazardOptions = [
			...document.querySelectorAll<HTMLElement>('[role="option"]'),
		].filter((option) => option.textContent?.includes("Sismo de"));
		expect(hazardOptions).toHaveLength(2);
		expect(hazardOptions.map((option) => option.textContent)).toEqual(
			expect.arrayContaining([
				expect.stringContaining("Sismo de diseño"),
				expect.stringContaining(
					"Sismo de control de daños (también llamado de servicio)",
				),
			]),
		);
		await act(async () => {
			hazardOptions
				.find((option) => option.textContent?.includes("control de daños"))
				?.click();
		});

		await vi.waitFor(() =>
			expect(container.textContent).toContain("Datos del espectro"),
		);
		expect(container.textContent).toContain("amortiguamiento crítico del 2 %");
		expect(
			container.querySelector("[data-slot='chart-return-period']")?.textContent,
		).toBe("TR no declarado");
		expect(chartAnnotationText()).toContain("T0");
		expect(chartAnnotationText()).toContain("Tc");
		expect(container.textContent).toContain("Exportar");
		expect(container.textContent).toContain("Soporte técnico oficial DAP · Medellín");
		expect(container.textContent).not.toContain(String.fromCodePoint(0xfffd));

		await chooseSelectOption("medellin-hazard-trigger", "Sismo de diseño");
		await vi.waitFor(() => {
			expect(container.textContent).toContain("amortiguamiento crítico del 5 %");
		});
		expect(
			container.querySelector("[data-slot='chart-return-period']")?.textContent,
		).toBe("TR no declarado");
	});

	it("keeps Medellín period limitations localized to lookup and charts only T0 through 4 s", async () => {
		await chooseMode("Medellín");
		await chooseSelectOption("medellin-zone-trigger", "Zona homogénea 3");
		await chooseSelectOption("medellin-hazard-trigger", "Sismo de diseño");

		await vi.waitFor(() =>
			expect(container.textContent).toContain("Datos del espectro"),
		);
		expect(
			container.querySelector("[data-slot='chart-period-domain']")?.textContent,
		).toBe("0.2–4");

		await setNumberInput("period-lookup-input", "0.1");
		await vi.waitFor(() => {
			expect(container.textContent).toContain(
				"no publica la ecuación de la rama ascendente",
			);
		});
		await setNumberInput("period-lookup-input", "4.1");
		await vi.waitFor(() => {
			expect(container.textContent).toContain(
				"limita el espectro publicado a 4 s",
			);
		});
		expect(container.textContent).toContain("La curva normalizada inicia en T0=0.2 s");
		expect(container.textContent).not.toContain(String.fromCodePoint(0xfffd));
	});

	it("activates CCP-14 only after every manual input and applicability check", async () => {
		await chooseMode("CCP-14 · Puentes");
		expect(container.textContent).toContain("Parámetros CCP-14");
		expect(container.textContent).toContain("Interpretación de T₀");
		expect(container.textContent).not.toContain(String.fromCodePoint(0xfffd));
		expect(container.textContent).toContain("Completa los datos manuales de CCP-14");
		expect(container.textContent).not.toContain("Datos del espectro");
		expect(container.querySelector("#ccp14-city-trigger")).toBeNull();

		await setNumberInput("ccp14-pga", "0.25");
		await setNumberInput("ccp14-ss", "0.5");
		await setNumberInput("ccp14-s1", "0.2");
		await chooseSelectOption("ccp14-soil-trigger", "Suelo D");
		await chooseSelectOption("ccp14-t0-trigger", "Figura: T₀ = 0,2·Ts");
		await setNumberInput("ccp14-fault-distance", "12");
		await chooseSelectOption("ccp14-long-duration-trigger", "No se esperan");
		await chooseSelectOption("ccp14-enhanced-hazard-trigger", "No se requiere");

		await vi.waitFor(() => expect(container.textContent).toContain("Datos del espectro"));
		expect(container.textContent).toContain("PGA, Ss and S1 are manual engineering inputs");
		expect(chartAnnotationText()).toContain("T0");
		expect(chartAnnotationText()).toContain("Ts");
		expect(container.textContent).toContain("Exportar");
	});

	it("keeps CCP-14 site-specific triggers localized to the entered scenario", async () => {
		await chooseMode("CCP-14 · Puentes");
		await setNumberInput("ccp14-pga", "0.25");
		await setNumberInput("ccp14-ss", "0.5");
		await setNumberInput("ccp14-s1", "0.2");
		await chooseSelectOption("ccp14-soil-trigger", "Suelo F");
		await chooseSelectOption("ccp14-t0-trigger", "Figura: T₀ = 0,2·Ts");
		await setNumberInput("ccp14-fault-distance", "12");
		await chooseSelectOption("ccp14-long-duration-trigger", "No se esperan");
		await chooseSelectOption("ccp14-enhanced-hazard-trigger", "No se requiere");

		await vi.waitFor(() => {
			expect(container.textContent).toContain("Estudio de respuesta sísmica particular requerido");
		});
		expect(container.textContent).toContain("soil class F");
		expect(container.textContent).not.toContain("Datos del espectro");
	});

	it("activates one Dosquebradas scenario and localizes unsupported periods", async () => {
		await chooseMode("Dosquebradas");
		expect(container.textContent).toContain("Selecciona la zona de Dosquebradas");
		expect(container.textContent).toContain("To ≤ T ≤ TL");
		expect(container.textContent).not.toContain(String.fromCodePoint(0xfffd));
		expect(container.textContent).not.toContain("Datos del espectro");

		const zoneTrigger = document.querySelector<HTMLButtonElement>("#dosquebradas-zone-trigger");
		await act(async () => zoneTrigger?.click());
		await waitForElement('[role="option"]', "Zona 1");
		expect(
			[...document.querySelectorAll<HTMLElement>('[role="option"]')].filter(
				(option) => option.textContent?.trim().startsWith("Zona "),
			),
		).toHaveLength(5);
		await act(async () => {
			[...document.querySelectorAll<HTMLElement>('[role="option"]')]
				.find((option) => option.textContent?.includes("Zona 1"))
				?.click();
		});

		await vi.waitFor(() => expect(container.textContent).toContain("Datos del espectro"));
		expect(container.textContent).toContain("To=0.05 s");
		expect(container.textContent).toContain("TL=2.5 s");
		expect(chartAnnotationText()).toContain("To");
		expect(chartAnnotationText()).toContain("Tc");
		expect(chartAnnotationText()).toContain("TL");

		await setNumberInput("period-lookup-input", "0.01");
		await vi.waitFor(() => {
			expect(container.textContent).toContain("no publica una rama de entrada verificable");
		});
	});
});
