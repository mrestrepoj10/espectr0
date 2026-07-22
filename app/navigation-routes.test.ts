import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDirectory = fileURLToPath(new URL(".", import.meta.url));
const projectDirectory = fileURLToPath(new URL("..", import.meta.url));

describe("navigation routes", () => {
	it("does not publish a standalone /memoria page", () => {
		expect(existsSync(`${appDirectory}/memoria/page.tsx`)).toBe(false);
	});

	it("reserves /microzonificacion for SGC Amenaza Sísmica 2018", () => {
		const source = readFileSync(
			`${appDirectory}/microzonificacion/page.tsx`,
			"utf8",
		);

		expect(source).toContain("SGC Amenaza Sísmica 2018 · próximamente");
		expect(source).toContain("reservado exclusivamente");
		expect(source).not.toMatch(
			/Bogotá|Medellín|Cali|Manizales|Armenia|Pereira|Santa Rosa|Dosquebradas|CCP-14/,
		);
	});

	it("keeps contextual memoria PDF implementation in place", () => {
		expect(existsSync(`${projectDirectory}/lib/memoria-pdf.ts`)).toBe(true);
		expect(existsSync(`${projectDirectory}/lib/memoria-pdf-renderer.tsx`)).toBe(
			true,
		);
		expect(existsSync(`${projectDirectory}/lib/memoria-pdf.test.ts`)).toBe(true);
	});
});
