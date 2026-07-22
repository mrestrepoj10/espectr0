import { once } from "node:events";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import next from "next";

const projectDirectory = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const overallTimeoutMs = Number(
	process.env.NAVIGATION_VERIFY_TIMEOUT_MS ?? 30_000,
);
const fetchTimeoutMs = Number(
	process.env.NAVIGATION_VERIFY_FETCH_TIMEOUT_MS ?? 5_000,
);

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function remainingTime(deadline, label) {
	const remaining = deadline - Date.now();
	if (remaining <= 0) {
		throw new Error(`Navigation verification deadline exceeded during ${label}.`);
	}
	return remaining;
}

async function settleBefore(promise, deadline, label) {
	const timeoutMs = remainingTime(deadline, label);
	let timeout;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => {
				timeout = setTimeout(
					() => reject(new Error(`${label} timed out after ${timeoutMs} ms.`)),
					timeoutMs,
				);
			}),
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

async function fetchBefore(url, deadline, label) {
	const controller = new AbortController();
	const timeoutMs = Math.min(
		fetchTimeoutMs,
		remainingTime(deadline, label),
	);
	const timeout = setTimeout(
		() => controller.abort(new Error(`${label} fetch timed out.`)),
		timeoutMs,
	);
	try {
		return await fetch(url, { signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

async function waitUntilReady(url, deadline) {
	let lastError;
	while (Date.now() < deadline) {
		try {
			await fetchBefore(url, deadline, "readiness");
			return;
		} catch (error) {
			lastError = error;
			const pauseMs = Math.min(100, Math.max(0, deadline - Date.now()));
			if (pauseMs > 0) {
				await new Promise((resolve) => setTimeout(resolve, pauseMs));
			}
		}
	}
	throw new Error(`Next server did not become ready: ${lastError}`);
}

async function closeServer(server, deadline) {
	if (!server?.listening) return;
	server.closeAllConnections?.();
	await settleBefore(
		new Promise((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		),
		deadline,
		"HTTP server cleanup",
	);
}

async function verifyNavigationRoutes() {
	const deadline = Date.now() + overallTimeoutMs;
	let nextApp;
	let nextServer;
	let verificationError;
	const cleanupErrors = [];

	try {
		nextApp = next({ dev: false, dir: projectDirectory, quiet: true });
		const handle = nextApp.getRequestHandler();
		await settleBefore(nextApp.prepare(), deadline, "Next startup");
		nextServer = createServer((request, response) => {
			void handle(request, response);
		});
		nextServer.listen(0, "127.0.0.1");
		await settleBefore(once(nextServer, "listening"), deadline, "HTTP startup");
		const address = nextServer.address();
		if (!address || typeof address === "string") {
			throw new Error(
				"Could not start the local Next server for route verification.",
			);
		}
		const origin = `http://127.0.0.1:${address.port}`;
		await waitUntilReady(`${origin}/`, deadline);

		const microzonificacion = await fetchBefore(
			`${origin}/microzonificacion`,
			deadline,
			"microzonificacion contract",
		);
		const microzonificacionHtml = await settleBefore(
			microzonificacion.text(),
			deadline,
			"microzonificacion response body",
		);
		assert(
			microzonificacion.status === 200,
			`Expected /microzonificacion to return 200, received ${microzonificacion.status}.`,
		);
		assert(
			microzonificacionHtml.includes(
				"SGC Amenaza Sísmica 2018 · próximamente",
			),
			"The rendered /microzonificacion response is missing the exact SGC label.",
		);
		assert(
			microzonificacionHtml.includes("reservado exclusivamente"),
			"The rendered /microzonificacion response is missing its reserved-only copy.",
		);
		assert(
			!/(Bogotá|Medellín|Cali|Manizales|Armenia|Pereira|Santa Rosa|Dosquebradas|CCP-14)/.test(
				(
					microzonificacionHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ??
					""
				)
					.replace(/<script[\s\S]*?<\/script>/g, "")
					.replace(/<[^>]+>/g, " "),
			),
			"The visible /microzonificacion body lists a municipal study or CCP-14.",
		);

		const memoria = await fetchBefore(
			`${origin}/memoria`,
			deadline,
			"memoria contract",
		);
		await settleBefore(memoria.arrayBuffer(), deadline, "memoria response body");
		assert(
			memoria.status === 404,
			`Expected /memoria to return 404, received ${memoria.status}.`,
		);

		const calculator = await fetchBefore(
			`${origin}/calculadora`,
			deadline,
			"calculator contract",
		);
		const calculatorHtml = await settleBefore(
			calculator.text(),
			deadline,
			"calculator response body",
		);
		assert(
			calculator.status === 200,
			`Expected /calculadora to return 200, received ${calculator.status}.`,
		);
		assert(
			!calculatorHtml.includes('href="/memoria"'),
			"The rendered calculator navigation still links to /memoria.",
		);

		console.log(
			"Verified production routes: /microzonificacion 200 with reserved SGC copy; /memoria 404; calculator navigation has no /memoria link.",
		);
	} catch (error) {
		verificationError = error;
	} finally {
		const cleanupDeadline = Date.now() + 5_000;
		try {
			await closeServer(nextServer, cleanupDeadline);
		} catch (error) {
			cleanupErrors.push(error);
		}
		try {
			if (nextApp) {
				await settleBefore(nextApp.close(), cleanupDeadline, "Next cleanup");
			}
		} catch (error) {
			cleanupErrors.push(error);
		}
		if (cleanupErrors.length === 0) {
			console.log("Navigation route verifier cleanup complete.");
		}
	}

	if (verificationError || cleanupErrors.length > 0) {
		throw new AggregateError(
			[verificationError, ...cleanupErrors].filter(Boolean),
			"Navigation route verification failed.",
		);
	}
}

try {
	await verifyNavigationRoutes();
} catch (error) {
	console.error(error);
	process.exit(1);
}
