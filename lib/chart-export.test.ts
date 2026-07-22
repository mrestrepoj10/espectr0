import { afterEach, describe, expect, it, vi } from "vitest";

import {
	copyTextToClipboard,
	formatEtabsTxt,
	serializeChartSvg,
} from "./chart-export";

class FakeStyle {
	values = new Map<string, string>();

	setProperty(property: string, value: string) {
		this.values.set(property, value);
	}
}

class FakeSvgNode {
	attributes = new Map<string, string>();
	children: FakeSvgNode[] = [];
	computed: Record<string, string> = {};
	style = new FakeStyle();
	viewBox = { baseVal: { width: 0, height: 0 } };
	width = { baseVal: { value: 0 } };
	height = { baseVal: { value: 0 } };
	clone: FakeSvgNode | null = null;

	cloneNode() {
		if (!this.clone) throw new Error("Missing fake clone");
		return this.clone;
	}

	getBoundingClientRect() {
		return { width: 640, height: 320 };
	}

	querySelectorAll() {
		return this.children;
	}

	setAttribute(name: string, value: string) {
		this.attributes.set(name, value);
	}
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("chart export formatting", () => {
	it("rejects predictably when text clipboard support is unavailable", async () => {
		vi.stubGlobal("navigator", {});

		await expect(copyTextToClipboard("spectrum")).rejects.toThrow(
			"Async Clipboard API is unavailable",
		);
	});

	it("writes text through the Async Clipboard API when supported", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { clipboard: { writeText } });

		await expect(copyTextToClipboard("spectrum")).resolves.toBeUndefined();
		expect(writeText).toHaveBeenCalledWith("spectrum");
	});

	it("formats ETABS points as two tab-separated columns without a header", () => {
		expect(
			formatEtabsTxt([
				{ t: 0, sa: 0.625 },
				{ t: 0.5, sa: 0.42 },
			]),
		).toBe("0\t0.625\n0.5\t0.42");
	});

	it("serializes explicit dimensions and computed SVG presentation styles", () => {
		const source = new FakeSvgNode();
		const sourcePath = new FakeSvgNode();
		const clone = new FakeSvgNode();
		const clonedPath = new FakeSvgNode();
		source.children = [sourcePath];
		clone.children = [clonedPath];
		source.clone = clone;
		source.computed = { fill: "none", opacity: "1" };
		sourcePath.computed = {
			fill: "oklch(0.5 0.2 250)",
			stroke: "rgb(10, 20, 30)",
			"stroke-width": "2.5px",
			"font-family": '"Geist"',
		};

		vi.stubGlobal("getComputedStyle", (element: FakeSvgNode) => ({
			getPropertyValue: (property: string) => element.computed[property] ?? "",
		}));
		vi.stubGlobal("document", {
			createElement: () => ({
				width: 0,
				height: 0,
				getContext: () => ({
					clearRect: vi.fn(),
					fillRect: vi.fn(),
					fillStyle: "",
					getImageData: () => ({ data: [17, 34, 51, 255] }),
				}),
			}),
		});
		vi.stubGlobal(
			"XMLSerializer",
			class {
				serializeToString(node: FakeSvgNode) {
					const attributes = [...node.attributes]
						.map(([name, value]) => `${name}="${value}"`)
						.join(" ");
					const pathStyles = [...node.children[0].style.values]
						.map(([name, value]) => `${name}:${value}`)
						.join(";");
					return `<svg ${attributes}><path style="${pathStyles}" /></svg>`;
				}
			},
		);

		const serialized = serializeChartSvg(source as unknown as SVGSVGElement);

		expect(serialized).toContain('xmlns="http://www.w3.org/2000/svg"');
		expect(serialized).toContain('width="640"');
		expect(serialized).toContain('height="320"');
		expect(serialized).toContain("fill:#112233");
		expect(serialized).toContain("stroke:rgb(10, 20, 30)");
		expect(serialized).toContain("stroke-width:2.5px");
		expect(serialized).toContain('font-family:"Geist"');
	});
});
