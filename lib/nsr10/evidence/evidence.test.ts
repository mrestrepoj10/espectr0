import { describe, expect, it } from "vitest";

import overridesData from "../../../scripts/nsr10-evidence-overrides.json";
import municipiosData from "../data/municipios.json";
import manifestData from "./manifest.json";
import { getMunicipalityTraceability, getNormativeCitation } from "./index";
import { sourceEvidenceManifestSchema } from "./schema";

const manifest = sourceEvidenceManifestSchema.parse(manifestData);

describe("NSR-10 municipality traceability", () => {
	it("stores one compact citation for every canonical DANE code", () => {
		const canonicalCodes = new Set(
			municipiosData.map((municipality) => municipality.code),
		);
		const citationCodes = manifest.citations.map(([code]) => code);

		expect(manifest.citations).toHaveLength(1_123);
		expect(new Set(citationCodes).size).toBe(1_123);
		expect(new Set(citationCodes)).toEqual(canonicalCodes);
		for (const citation of manifest.citations) {
			expect(citation).toHaveLength(3);
		}
	});

	it("keeps fixed geometry and source metadata once", () => {
		expect(Buffer.byteLength(JSON.stringify(manifestData))).toBeLessThan(42_000);
		expect(manifest.source).toMatchObject({
			pdfPath: "/nsr10-titulo-a-2017.pdf",
			pdfSha256:
				"47207abe1e832f5feb5fb8448af884b8d539fddaf89b6b21ab466765dd8524b0",
		});
		expect(manifest.layout).toEqual({
			row: {
				left: 0.1340196078,
				width: 0.7318627451,
				height: 0.0141414142,
			},
			values: {
				aa: {
					left: 0.4835063725,
					width: 0.0327303922,
					topOffset: 0.0003787878,
					height: 0.0133838385,
				},
				av: {
					left: 0.5540696078,
					width: 0.0327509804,
					topOffset: 0.0003787878,
					height: 0.0133838385,
				},
				ae: {
					left: 0.7427622549,
					width: 0.0328303922,
					topOffset: 0.0003787878,
					height: 0.0133838385,
				},
				ad: {
					left: 0.8109357843,
					width: 0.0341406863,
					topOffset: 0.0003787878,
					height: 0.0133838385,
				},
			},
		});
	});

	it("stores PDF-region transcriptions for every base-shear normative value", () => {
		expect(manifest.normativeCitations.map(({ id }) => id)).toEqual([
			"a3.0-gravity-mass",
			"a3.4.2.1-fhe-applicability",
			"a3.4.2.2-dynamic-required",
			"a4.2.2-period-ceiling",
			"a4.2.3-approximate-period",
			"a4.3.1-base-shear",
			"a4.3.2-force-distribution",
			"a5.4.5-dynamic-minimum",
		]);
		for (const citation of manifest.normativeCitations) {
			expect(citation.printedPage).toBe(`A-${citation.pageNumber - 14}`);
			expect(citation.transcription.length).toBeGreaterThan(40);
			expect(getNormativeCitation(citation.id)).toEqual(citation);
		}
		expect(getNormativeCitation("a4.2.3-approximate-period")?.transcription).toContain(
			"0.047 0.9",
		);
		expect(getNormativeCitation("a5.4.5-dynamic-minimum")?.transcription).toContain(
			"80 por ciento",
		);
		expect(getNormativeCitation("unknown")).toBeUndefined();
	});

	it.each([
		["91001", 171, "A-157"],
		["11001", 183, "A-169"],
		["76001", 191, "A-177"],
		["99773", 192, "A-178"],
	])("composes %s from its canonical municipality and citation", (code, pageNumber, printedPage) => {
		const traceability = getMunicipalityTraceability(code);
		expect(traceability).toMatchObject({
			municipality: { code },
			pageNumber,
			printedPage,
			source: manifest.source,
		});
	});

	it("derives every printed page and contained rectangle on demand", () => {
		for (const [code, pageNumber] of manifest.citations) {
			const traceability = getMunicipalityTraceability(code);
			expect(traceability, code).toBeDefined();
			if (!traceability) continue;

			expect(traceability.printedPage).toBe(`A-${pageNumber - 14}`);
		for (const value of Object.values(traceability.values)) {
				expect(value.rect.left).toBeGreaterThanOrEqual(traceability.row.left);
				expect(value.rect.top).toBeGreaterThanOrEqual(traceability.row.top);
				expect(value.rect.left + value.rect.width).toBeLessThanOrEqual(
					traceability.row.left + traceability.row.width,
				);
				expect(value.rect.top + value.rect.height).toBeLessThanOrEqual(
					traceability.row.top + traceability.row.height,
				);
			}
		}
	});

	it("takes Cali coefficients only from the canonical municipality", () => {
		const traceability = getMunicipalityTraceability("76001");
		expect(traceability?.municipality).toMatchObject({
			municipio: "Cali",
			aa: 0.25,
			av: 0.25,
			ae: 0.15,
			ad: 0.09,
		});
		expect(traceability?.values.aa.value).toBe(traceability?.municipality.aa);
		expect(traceability?.values.av.value).toBe(traceability?.municipality.av);
		expect(traceability?.values.ae.value).toBe(traceability?.municipality.ae);
		expect(traceability?.values.ad.value).toBe(traceability?.municipality.ad);
	});

	it("documents only the earned duplicated Bogotá source row", () => {
		expect(overridesData).toEqual({
			schemaVersion: 1,
			sourceDuplicates: [
				{
					code: "11001",
					reason: expect.any(String),
					occurrencePageNumbers: [181, 183],
					chosenPageNumber: 183,
				},
			],
		});
	});

	it("does not invent traceability for an unknown code", () => {
		expect(getMunicipalityTraceability("00000")).toBeUndefined();
	});
});
