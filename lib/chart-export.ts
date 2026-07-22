const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const INLINE_STYLE_PROPERTIES = [
	"fill",
	"stroke",
	"stroke-width",
	"stroke-dasharray",
	"opacity",
	"font-family",
	"font-size",
	"font-weight",
	"color",
	"text-anchor",
	"stop-color",
	"stop-opacity",
] as const;

export type ChartPoint = {
	t: number;
	sa: number;
};

function colorToHex(value: string) {
	if (!value.toLowerCase().includes("oklch")) return value;

	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) return value;

	context.clearRect(0, 0, 1, 1);
	context.fillStyle = value;
	context.fillRect(0, 0, 1, 1);
	const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
	const hex = [red, green, blue]
		.map((channel) => channel.toString(16).padStart(2, "0"))
		.join("");

	return alpha === 255
		? `#${hex}`
		: `#${hex}${alpha.toString(16).padStart(2, "0")}`;
}

function svgDimensions(svgEl: SVGSVGElement) {
	const bounds = svgEl.getBoundingClientRect();
	const viewBox = svgEl.viewBox.baseVal;
	const width = bounds.width || viewBox.width || svgEl.width.baseVal.value;
	const height = bounds.height || viewBox.height || svgEl.height.baseVal.value;

	if (!width || !height) {
		throw new Error("El gráfico no tiene dimensiones exportables.");
	}

	return { width, height };
}

/** Clones an SVG and makes its rendered appearance independent from page CSS. */
export function serializeChartSvg(svgEl: SVGSVGElement) {
	const clone = svgEl.cloneNode(true) as SVGSVGElement;
	const sourceElements = [svgEl, ...svgEl.querySelectorAll<SVGElement>("*")];
	const clonedElements = [clone, ...clone.querySelectorAll<SVGElement>("*")];

	for (const [index, source] of sourceElements.entries()) {
		const target = clonedElements[index];
		if (!target) continue;

		const computedStyle = getComputedStyle(source);
		for (const property of INLINE_STYLE_PROPERTIES) {
			const value = computedStyle.getPropertyValue(property).trim();
			if (value) target.style.setProperty(property, colorToHex(value));
		}
	}

	const { width, height } = svgDimensions(svgEl);
	clone.setAttribute("xmlns", SVG_NAMESPACE);
	clone.setAttribute("width", String(width));
	clone.setAttribute("height", String(height));

	return new XMLSerializer().serializeToString(clone);
}

function dimensionsFromMarkup(svg: string) {
	const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
	const width = Number.parseFloat(root.getAttribute("width") ?? "");
	const height = Number.parseFloat(root.getAttribute("height") ?? "");

	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		throw new Error("El SVG no tiene dimensiones válidas.");
	}

	return { width, height };
}

/** Rasterizes serialized chart SVG at the requested scale with an opaque background. */
export async function svgToPngBlob(
	svg: string,
	scale: number,
	background = "#ffffff",
) {
	if (!Number.isFinite(scale) || scale <= 0) {
		throw new RangeError("La escala debe ser un número positivo.");
	}

	const { width, height } = dimensionsFromMarkup(svg);
	const source = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
	const url = URL.createObjectURL(source);

	try {
		const image = new Image();
		image.decoding = "async";
		image.src = url;
		await image.decode();

		const canvas = document.createElement("canvas");
		canvas.width = Math.ceil(width * scale);
		canvas.height = Math.ceil(height * scale);
		const context = canvas.getContext("2d");
		if (!context) throw new Error("No fue posible crear el lienzo PNG.");

		context.scale(scale, scale);
		context.fillStyle = colorToHex(background);
		context.fillRect(0, 0, width, height);
		context.drawImage(image, 0, 0, width, height);

		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (blob) resolve(blob);
				else reject(new Error("No fue posible codificar el PNG."));
			}, "image/png");
		});
	} finally {
		URL.revokeObjectURL(url);
	}
}

function isTransparent(color: string) {
	return color === "transparent" || /rgba\([^)]*,\s*0(?:\.0+)?\s*\)/i.test(color);
}

function chartBackground(container: Element | null) {
	let current = container;
	while (current) {
		const background = getComputedStyle(current).backgroundColor;
		if (background && !isTransparent(background)) return background;
		current = current.parentElement;
	}

	return "#ffffff";
}

export function copyTextToClipboard(text: string) {
	if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
		return Promise.reject(new Error("The Async Clipboard API is unavailable."));
	}

	return navigator.clipboard.writeText(text);
}

/** Must be invoked directly from a click handler to retain Safari clipboard activation. */
export function copyChartPng(svgEl: SVGSVGElement, container?: Element | null) {
	const svg = serializeChartSvg(svgEl);
	const scale = Math.max(window.devicePixelRatio || 1, 2);
	const pngPromise = svgToPngBlob(
		svg,
		scale,
		chartBackground(container ?? svgEl.closest('[data-slot="chart"]')),
	);

	// Safari requires ClipboardItem to be constructed synchronously in the click event.
	const item = new ClipboardItem({ "image/png": pngPromise });
	return navigator.clipboard.write([item]);
}

export function copyChartSvg(svgEl: SVGSVGElement) {
	const svg = serializeChartSvg(svgEl);
	const ClipboardItemWithSupport = globalThis.ClipboardItem as
		| (typeof ClipboardItem & {
		supports?: (type: string) => boolean;
		  })
		| undefined;

	if (ClipboardItemWithSupport?.supports?.("image/svg+xml")) {
		const item = new ClipboardItemWithSupport({
			"image/svg+xml": new Blob([svg], { type: "image/svg+xml" }),
		});
		return navigator.clipboard.write([item]);
	}

	return navigator.clipboard.writeText(svg);
}

export function formatEtabsTxt(points: readonly ChartPoint[]) {
	return points.map(({ t, sa }) => `${t}\t${sa}`).join("\n");
}

export function downloadEtabsTxt(
	points: readonly ChartPoint[],
	filename = "espectr0-etabs.txt",
) {
	const blob = new Blob([formatEtabsTxt(points)], {
		type: "text/plain;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
