import { once } from "node:events";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";

const projectDirectory = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
async function waitForResponse(url, timeoutMs = 30_000) {
	const deadline = Date.now() + timeoutMs;
	let lastError;

	while (Date.now() < deadline) {
		try {
			return await fetch(url);
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	throw new Error(`Next server did not become ready: ${lastError}`);
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

const nextApp = next({ dev: false, dir: projectDirectory, quiet: true });
const handle = nextApp.getRequestHandler();
await nextApp.prepare();
const nextServer = createServer((request, response) => {
	void handle(request, response);
});
nextServer.listen(0, "127.0.0.1");
await once(nextServer, "listening");
const address = nextServer.address();
if (!address || typeof address === "string") {
	throw new Error("Could not start the local Next server for route verification.");
}
const origin = `http://127.0.0.1:${address.port}`;

try {
	const microzonificacion = await waitForResponse(`${origin}/microzonificacion`);
	const microzonificacionHtml = await microzonificacion.text();
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
			(microzonificacionHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? "")
				.replace(/<script[\s\S]*?<\/script>/g, "")
				.replace(/<[^>]+>/g, " "),
		),
		"The visible /microzonificacion body lists a municipal study or CCP-14.",
	);

	const memoria = await fetch(`${origin}/memoria`);
	assert(
		memoria.status === 404,
		`Expected /memoria to return 404, received ${memoria.status}.`,
	);

	const calculator = await fetch(`${origin}/calculadora`);
	const calculatorHtml = await calculator.text();
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
} finally {
	await new Promise((resolve, reject) =>
		nextServer.close((error) => (error ? reject(error) : resolve())),
	);
	await nextApp.close();
}
