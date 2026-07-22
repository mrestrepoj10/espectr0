import { describe, expect, it } from "vitest";

import { caliSourceEvidence, type NormalizedPdfRect } from "./source-evidence";

function expectNormalizedRect(rect: NormalizedPdfRect) {
	expect(rect.left).toBeGreaterThanOrEqual(0);
	expect(rect.top).toBeGreaterThanOrEqual(0);
	expect(rect.width).toBeGreaterThan(0);
	expect(rect.height).toBeGreaterThan(0);
	expect(rect.left + rect.width).toBeLessThanOrEqual(1);
	expect(rect.top + rect.height).toBeLessThanOrEqual(1);
}

describe("Cali source evidence", () => {
	it("points to the cited NSR-10 page", () => {
		expect(caliSourceEvidence.pageNumber).toBe(191);
		expect(caliSourceEvidence.printedPage).toBe("A-177");
	});

	it("keeps every PDF highlight inside the normalized page", () => {
		expectNormalizedRect(caliSourceEvidence.row);

		for (const evidenceValue of caliSourceEvidence.values) {
			expectNormalizedRect(evidenceValue.rect);
		}
	});

	it("identifies the direct Aa and Av values", () => {
		expect(
			caliSourceEvidence.values.map(({ key, value }) => ({ key, value })),
		).toEqual([
			{ key: "Aa", value: "0.25" },
			{ key: "Av", value: "0.25" },
		]);
	});
});
