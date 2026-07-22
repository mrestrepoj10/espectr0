// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	usePathname: () => "/calculadora",
}));

import { AppSidebar } from "./app-sidebar";
import { CustomSidebarTrigger } from "./custom-sidebar-trigger";
import { SidebarProvider } from "./ui/sidebar";

class ResizeObserverStub implements ResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

let container: HTMLDivElement;
let root: Root;

async function waitForMobileSidebar(timeoutMs = 2_000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const sidebar = document.querySelector<HTMLElement>('[data-mobile="true"]');
		if (sidebar) return sidebar;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
	}
	throw new Error("The mobile sidebar did not open.");
}

function getTrigger() {
	const trigger = document.querySelector<HTMLButtonElement>(
		'button[data-sidebar="trigger"]',
	);
	expect(trigger).not.toBeNull();
	expect(trigger?.dataset.slot).toBe("sidebar-trigger");
	return trigger as HTMLButtonElement;
}

function expectReservedNavigation(sidebar: HTMLElement) {
	expect(sidebar.textContent).toContain(
		"SGC Amenaza Sísmica 2018 · próximamente",
	);
}

beforeAll(() => {
	Object.assign(globalThis, {
		IS_REACT_ACT_ENVIRONMENT: true,
		ResizeObserver: ResizeObserverStub,
	});
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		value: 390,
	});
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			addEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
			matches: query.includes("767px"),
			media: query,
			onchange: null,
			removeEventListener: vi.fn(),
		})),
	});
	if (!("PointerEvent" in window)) {
		Object.defineProperty(window, "PointerEvent", { value: MouseEvent });
	}
	Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(async () => {
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () => {
		root.render(
			<SidebarProvider defaultOpen={false}>
				<AppSidebar />
				<CustomSidebarTrigger />
			</SidebarProvider>,
		);
	});
});

afterEach(async () => {
	await act(async () => {
		root.unmount();
	});
	container.remove();
	document.body.replaceChildren();
});

describe("custom mobile sidebar trigger", () => {
	it("opens the mounted navigation with a pointer activation", async () => {
		const trigger = getTrigger();

		await act(async () => {
			trigger.dispatchEvent(
				new PointerEvent("pointerdown", {
					bubbles: true,
					pointerType: "touch",
				}),
			);
			trigger.click();
		});

		expectReservedNavigation(await waitForMobileSidebar());
	});

	it("opens the mounted navigation with an Enter activation", async () => {
		const trigger = getTrigger();
		trigger.focus();

		await act(async () => {
			trigger.dispatchEvent(
				new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
			);
			// jsdom does not synthesize a button click from Enter as a browser does.
			trigger.click();
			trigger.dispatchEvent(
				new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }),
			);
		});

		expectReservedNavigation(await waitForMobileSidebar());
	});
});
