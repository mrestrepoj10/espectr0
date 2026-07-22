import { describe, expect, it } from "vitest";

import { navGroups } from "./app-shared";

describe("primary navigation", () => {
	it("omits the standalone memoria route", () => {
		const items = navGroups.flatMap((group) => group.items);

		expect(items).not.toContainEqual(
			expect.objectContaining({ path: "/memoria" }),
		);
		expect(items.map((item) => item.title)).not.toContain("Memoria PDF");
	});

	it("labels the reserved SGC 2018 route explicitly", () => {
		const items = navGroups.flatMap((group) => group.items);

		expect(items).toContainEqual(
			expect.objectContaining({
				path: "/microzonificacion",
				title: "SGC Amenaza Sísmica 2018 · próximamente",
			}),
		);
	});
});
