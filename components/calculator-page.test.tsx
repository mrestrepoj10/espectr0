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

/**
 * Scoped to the listbox this trigger opened. Several selects on the page share
 * option labels - a city name that is also a calculator mode, a region number
 * that appears on more than one figure - so a document-wide search silently
 * clicks the wrong list.
 */
async function chooseSelectOption(triggerId: string, label: string) {
	const trigger = document.querySelector<HTMLButtonElement>(`#${triggerId}`);
	expect(trigger).toBeTruthy();
	await act(async () => {
		trigger?.click();
	});
	const deadline = Date.now() + 2_000;
	let option: HTMLElement | undefined;
	while (Date.now() < deadline && !option) {
		// A closed popup keeps its listbox mounted under a hidden ancestor.
		const open = [
			...document.querySelectorAll<HTMLElement>('[role="listbox"]'),
		].filter((box) => !box.closest("[hidden]"));
		option = open
			.flatMap((box) => [...box.querySelectorAll<HTMLElement>('[role="option"]')])
			.find((candidate) => candidate.textContent?.includes(label));
		if (option) break;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
	}
	if (!option) {
		throw new Error(`Could not find option “${label}” in the list opened by #${triggerId}.`);
	}
	await act(async () => {
		option?.click();
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

	it("asks Bogotá only for the zone, the hazard and the use group", async () => {
		await chooseMode("Bogotá D. C.");

		// Fill thickness and rigid-base period describe the site the geotechnical
		// engineer characterises, not the study; their thresholds travel as the
		// site-specific warning the result already carries.
		expect(container.querySelector("#bogota-fill-thickness")).toBeNull();
		expect(container.querySelector("#bogota-rigid-base-period")).toBeNull();
		expect(container.querySelector("#bogota-importance-factor")).toBeNull();
		for (const id of [
			"bogota-zone-trigger",
			"bogota-hazard-trigger",
			"bogota-importance-group-trigger",
		]) {
			expect(container.querySelector(`#${id}`), id).not.toBeNull();
		}
	});

	it("asks every municipal mode for the zone, the hazard and the use group", async () => {
		// The published studies tabulate coefficients per zone and hazard; the
		// rest of the site is what the geotechnical engineer characterises, and
		// its thresholds travel as the site-specific warning each result carries.
		const modes = [
			{ mode: "Cali", prefix: "cali", zone: "cali-zone-trigger" },
			{ mode: "Medellín", prefix: "medellin", zone: "medellin-zone-trigger" },
			{
				mode: "Dosquebradas",
				prefix: "dosquebradas",
				zone: "dosquebradas-zone-trigger",
			},
		];

		for (const { mode, prefix, zone } of modes) {
			await chooseMode(mode);
			expect(
				container.querySelector(`#${prefix}-importance-factor`),
				mode,
			).toBeNull();
			expect(
				container.querySelector(`#${prefix}-importance-group-trigger`),
				mode,
			).not.toBeNull();
			expect(container.querySelector(`#${zone}`), mode).not.toBeNull();
		}

		// Cali keeps two more: unmanaged fill and colluvial deposit are not
		// cosmetic site description there, they raise Fa and Fv by a cited 20%.
		await chooseMode("Cali");
		expect(container.querySelector("#cali-fill-thickness")).not.toBeNull();
		expect(container.querySelector("#cali-colluvial-deposit")).not.toBeNull();
	});

	it("keeps Cali's cited 20% amplification reachable from the form", async () => {
		await chooseMode("Cali");
		await chooseSelectOption("cali-zone-trigger", "Zona 1");
		await vi.waitFor(() =>
			expect(container.textContent).toContain("Datos del espectro"),
		);
		expect(container.textContent).not.toContain("aumentaron Fa y Fv en 20%");

		await setNumberInput("cali-fill-thickness", "4");
		await vi.waitFor(() =>
			expect(container.textContent).toContain("aumentaron Fa y Fv en 20%"),
		);
	});

	it("scales the Bogotá spectrum by the chosen NSR-10 use group", async () => {
		await chooseMode("Bogotá D. C.");
		await chooseSelectOption("bogota-zone-trigger", "CERROS");
		await vi.waitFor(() => {
			expect(container.textContent).toContain("Datos del espectro");
		});
		const atGroupI = container.textContent ?? "";

		await chooseSelectOption(
			"bogota-importance-group-trigger",
			"IV — Edificación indispensable (I=1.50)",
		);
		await vi.waitFor(() => {
			expect(container.textContent).not.toBe(atGroupI);
		});
		expect(container.textContent).toContain("Datos del espectro");
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

	it("enables the Bogotá and Cali result actions from capability metadata", async () => {
		await chooseMode("Bogotá D. C.");
		await chooseSelectOption("bogota-zone-trigger", "CERROS");
		const bogotaTrace = await waitForElement("button", "Ver trazabilidad");
		expect(bogotaTrace).not.toHaveProperty("disabled", true);

		const bogotaExport = await waitForElement("button", "Exportar");
		await act(async () => {
			bogotaExport.click();
		});
		const bogotaPdf = await waitForElement(
			'[role="menuitem"]',
			"Descargar memoria PDF",
		);
		expect(bogotaPdf.getAttribute("aria-disabled")).not.toBe("true");

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

	it("asks for the region read off each figure, not the value", async () => {
		await chooseMode("CCP-14 · Puentes");
		expect(container.textContent).toContain("Parámetros CCP-14");
		const officialPublicationLink = container.querySelector<HTMLAnchorElement>(
			'a[href*="idFile=29584"]',
		);
		expect(officialPublicationLink?.href).toBe(
			"https://www.invias.gov.co/loader.php?lServicio=Tools2&lTipo=descargas&lFuncion=descargar&idFile=29584",
		);
		expect(container.textContent).not.toContain(String.fromCodePoint(0xfffd));
		expect(container.textContent).toContain("Completa los datos de CCP-14");
		expect(container.querySelector("#ccp14-t0-trigger")).toBeNull();
		expect(container.querySelector("#ccp14-fault-distance")).toBeNull();
		// The legend states each region's value, so the form asks for the region.
		expect(container.querySelector("#ccp14-pga-region")).not.toBeNull();
		expect(container.querySelector("#ccp14-ss-region")).not.toBeNull();
		expect(container.querySelector("#ccp14-s1-region")).not.toBeNull();

		await chooseSelectOption("ccp14-pga-region", "Región 6 — PGA 0,30 g");
		await chooseSelectOption("ccp14-ss-region", "Región 7 — Ss 0,70 g");
		await chooseSelectOption("ccp14-s1-region", "Región 6 — S1 0,30 g");
		await vi.waitFor(() => {
			expect(container.textContent).toContain("según la leyenda");
		});
		// Picking a region quotes the legend instead of asking for a number.
		expect(container.querySelector("#ccp14-pga")).toBeNull();

		await chooseSelectOption("ccp14-soil-trigger", "Perfil D");
		await vi.waitFor(() =>
			expect(container.textContent).toContain("Datos del espectro"),
		);
		expect(chartAnnotationText()).toContain("Ts");
	});

	it("prefills PGA, Ss and S1 from the map reading when a city is picked", async () => {
		await chooseMode("CCP-14 · Puentes");
		await chooseSelectOption("ccp14-map-location-trigger", "Armenia");

		await vi.waitFor(() => {
			expect(
				container.querySelector("[data-slot='ccp14-city-reading']"),
			).not.toBeNull();
		});
		// Armenia was read into PGA region 5, Ss region 6 and S1 region 6.
		expect(container.textContent).toContain("PGA = 0,25 g, según la leyenda");
		expect(container.textContent).toContain("Ss = 0,60 g, según la leyenda");
		expect(container.textContent).toContain("S1 = 0,30 g, según la leyenda");
		expect(container.textContent).toContain(
			"no un dato publicado por INVÍAS",
		);

		// Only the soil profile is left to choose.
		await chooseSelectOption("ccp14-soil-trigger", "Perfil C");
		await vi.waitFor(() =>
			expect(container.textContent).toContain("Datos del espectro"),
		);
		expect(container.textContent).not.toContain(String.fromCodePoint(0xfffd));
	});

	it("shows the reviewed status of a confirmed reading", async () => {
		await chooseMode("CCP-14 · Puentes");
		await chooseSelectOption("ccp14-map-location-trigger", "Cúcuta");

		await vi.waitFor(() => {
			expect(
				container.querySelector("[data-slot='ccp14-city-reading']"),
			).not.toBeNull();
		});
		expect(container.textContent).toContain(
			"revisada y confirmada por el ingeniero",
		);
		expect(container.textContent).toContain("PGA = 0,55 g, según la leyenda");
	});

	it("opens the figure evidence before anything is calculated", async () => {
		await chooseMode("CCP-14 · Puentes");
		expect(
			container.querySelector("[data-slot='ccp14-evidence-trigger']"),
		).toBeNull();

		await chooseSelectOption("ccp14-map-location-trigger", "Tunja");
		const trigger = container.querySelector<HTMLButtonElement>(
			"[data-slot='ccp14-evidence-trigger']",
		);
		expect(trigger).not.toBeNull();
		// No soil profile chosen, so no spectrum exists yet.
		expect(container.textContent).toContain("Completa los datos de CCP-14");

		await act(async () => trigger?.click());
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain(
				"Evidencia de la lectura del mapa",
			);
		});
		// One traceability surface, not a second drawer alongside it.
		expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
		expect(document.body.textContent).toContain("Trazabilidad normativa");
		const sheet = document.body.textContent ?? "";
		expect(sheet).toContain("PGA = 0,25 g");
		expect(sheet).toContain("Ss = 0,60 g");
		expect(sheet).toContain("S1 = 0,30 g");
		expect(sheet).toContain("fila resaltada: región 5");
		// The cuts of the official figure are rendered, not just described.
		const images = [
			...document.querySelectorAll<HTMLImageElement>("img[src^='/ccp14/']"),
		].map((image) => image.getAttribute("src"));
		expect(images).toContain("/ccp14/figura-3.10.2.1-1-leyenda.png");
		expect(images).toContain("/ccp14/figura-3.10.2.1-1.png");
		expect(images).toContain("/ccp14/figura-3.10.2.1-3.png");
	});

	it("opens the Bogotá map evidence before anything is calculated", async () => {
		await chooseMode("Bogotá D. C.");
		expect(
			container.querySelector("[data-slot='bogota-evidence-trigger']"),
		).toBeNull();

		await chooseSelectOption("bogota-zone-trigger", "CERROS");
		const trigger = container.querySelector<HTMLButtonElement>(
			"[data-slot='bogota-evidence-trigger']",
		);
		expect(trigger).not.toBeNull();

		await act(async () => trigger?.click());
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain(
				"Evidencia cartográfica de la zona",
			);
		});
		// One traceability surface, not a second drawer alongside it.
		expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
		expect(document.body.textContent).toContain("Trazabilidad normativa");
		expect(document.body.textContent).toContain("fila resaltada: CERROS");

		const images = [
			...document.querySelectorAll<HTMLImageElement>("img[src^='/bogota/']"),
		].map((image) => image.getAttribute("src"));
		expect(images).toContain("/bogota/mapa-2-leyenda.png");
		expect(images).toContain("/bogota/mapa-2-zonas-respuesta-sismica.png");
	});

	it("shows the Cali sheet with the selected zone highlighted", async () => {
		await chooseMode("Cali");
		expect(
			container.querySelector("[data-slot='cali-evidence-trigger']"),
		).toBeNull();

		await chooseSelectOption("cali-zone-trigger", "Zona 4C");
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>("[data-slot='cali-evidence-trigger']")
				?.click(),
		);
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain(
				"Evidencia cartográfica de la zona",
			);
		});
		expect(document.body.textContent).toContain("MZSC-R02");
		// The sheet prints its own coefficients, and they disagree with the
		// adopted decree in one cell; the panel has to say which governs.
		expect(document.body.textContent).toContain("gobierna el decreto");

		const images = [
			...document.querySelectorAll<HTMLImageElement>("img[src^='/cali/']"),
		].map((image) => image.getAttribute("src"));
		expect(images).toContain("/cali/mapa-mzsc-r02-leyenda.png");
		expect(images).toContain("/cali/mapa-mzsc-r02.png");
		expect(images).toContain("/cali/mapa-mzsc-r02-coeficientes.png");
	});

	it("opens traceability for Medellín and Dosquebradas", async () => {
		await chooseMode("Medellín");
		expect(
			container.querySelector("[data-slot='medellin-evidence-trigger']"),
		).toBeNull();
		await chooseSelectOption("medellin-zone-trigger", "Zona homogénea 1");
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>(
					"[data-slot='medellin-evidence-trigger']",
				)
				?.click(),
		);
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain(
				"Evidencia cartográfica de la zona",
			);
		});
		// The sheet labels zones 2 and 3 by lithology where the study labels them
		// by sector, so the panel has to say the row is matched by position.
		expect(document.body.textContent).toContain("por posición");
		await act(async () =>
			document
				.querySelector<HTMLButtonElement>('[role="dialog"] button')
				?.click(),
		);

		await chooseMode("Dosquebradas");
		await chooseSelectOption("dosquebradas-zone-trigger", "Zona 1");
		expect(
			container.querySelector("[data-slot='dosquebradas-evidence-trigger']"),
		).not.toBeNull();
	});

	it("splits the drawer into a source panel and a lineage panel", async () => {
		await chooseMode("Bogotá D. C.");
		await chooseSelectOption("bogota-zone-trigger", "CERROS");
		await act(async () =>
			container
				.querySelector<HTMLButtonElement>("[data-slot='bogota-evidence-trigger']")
				?.click(),
		);

		// Opens on the map, with the lineage one click away rather than six
		// screens of scroll below it.
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain(
				"Evidencia cartográfica de la zona",
			);
		});
		expect(document.body.textContent).not.toContain("Valores directos de fuente");

		const lineage = await waitForElement("button", "Linaje del resultado");
		await act(async () => lineage.click());
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain("Valores directos de fuente");
		});
		expect(document.body.textContent).not.toContain(
			"Evidencia cartográfica de la zona",
		);
	});

	it("lets the engineer override a prefilled coefficient", async () => {
		await chooseMode("CCP-14 · Puentes");
		await chooseSelectOption("ccp14-map-location-trigger", "Armenia");
		await vi.waitFor(() =>
			expect(container.textContent).toContain("PGA = 0,25 g, según la leyenda"),
		);

		await chooseSelectOption("ccp14-pga-region", "Entre contornos — interpolar");
		await vi.waitFor(() =>
			expect(document.querySelector("#ccp14-pga")).not.toBeNull(),
		);
		await setNumberInput("ccp14-pga", "0.27");
		await chooseSelectOption("ccp14-soil-trigger", "Perfil C");
		await vi.waitFor(() =>
			expect(container.textContent).toContain("Datos del espectro"),
		);
	});

	it("still accepts an interpolated value between contours", async () => {
		await chooseMode("CCP-14 · Puentes");
		await chooseSelectOption("ccp14-pga-region", "Entre contornos — interpolar");
		await vi.waitFor(() =>
			expect(container.querySelector("#ccp14-pga")).not.toBeNull(),
		);
		await setNumberInput("ccp14-pga", "0.27");
		await chooseSelectOption("ccp14-ss-region", "Región 7 — Ss 0,70 g");
		await chooseSelectOption("ccp14-s1-region", "Región 6 — S1 0,30 g");
		await chooseSelectOption("ccp14-soil-trigger", "Perfil D");
		await vi.waitFor(() =>
			expect(container.textContent).toContain("Datos del espectro"),
		);
	});

	it("shows the source backing each value in the traceability drawer", async () => {
		await chooseMode("CCP-14 · Puentes");
		await chooseSelectOption("ccp14-pga-region", "Región 6 — PGA 0,30 g");
		await chooseSelectOption("ccp14-ss-region", "Región 7 — Ss 0,70 g");
		await chooseSelectOption("ccp14-s1-region", "Región 6 — S1 0,30 g");
		await chooseSelectOption("ccp14-soil-trigger", "Perfil D");
		await vi.waitFor(() =>
			expect(container.textContent).toContain("Datos del espectro"),
		);

		const trace = [...container.querySelectorAll("button")].find((button) =>
			button.textContent?.includes("Ver trazabilidad"),
		);
		expect(trace).toBeTruthy();
		expect(trace?.hasAttribute("disabled")).toBe(false);
		await act(async () => trace?.click());

		// The drawer opens on the source evidence; the lineage is the other panel.
		const lineage = await waitForElement("button", "Linaje del resultado");
		await act(async () => lineage.click());
		await vi.waitFor(() => {
			expect(document.body.textContent).toContain("Valores directos de fuente");
		});
		const drawer = document.body.textContent ?? "";
		expect(drawer).toContain("PGA · región 6");
		expect(drawer).toContain("map-legend-pga");
		expect(drawer).toContain("Fpga");
		expect(drawer).toContain("Instituto Nacional de Vías (INVÍAS)");
		expect(drawer).toContain(
			"55f53d68dfc568a930b726b0c7dba510ea608128490353bf604f827a27ffc8ca",
		);
	});

	it("keeps CCP-14 site-specific triggers localized to the entered scenario", async () => {
		await chooseMode("CCP-14 · Puentes");
		await chooseSelectOption("ccp14-pga-region", "Región 5 — PGA 0,25 g");
		await chooseSelectOption("ccp14-ss-region", "Región 5 — Ss 0,50 g");
		await chooseSelectOption("ccp14-s1-region", "Región 4 — S1 0,20 g");
		await chooseSelectOption("ccp14-soil-trigger", "Perfil F");

		await vi.waitFor(() => {
			expect(container.textContent).toContain("Estudio de respuesta sísmica particular requerido");
		});
		expect(container.textContent).toContain(
			"exige un estudio particular de sitio",
		);
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
