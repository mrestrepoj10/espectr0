import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const verifier = path.join(
	projectDirectory,
	"scripts",
	"verify-navigation-routes.mjs",
);

async function runFailureCase(name, injectedFetch, expectedOutput) {
	const preload = `data:text/javascript,${encodeURIComponent(injectedFetch)}`;
	const startedAt = Date.now();
	const child = spawn(process.execPath, ["--import", preload, verifier], {
		cwd: projectDirectory,
		env: {
			...process.env,
			NAVIGATION_VERIFY_FETCH_TIMEOUT_MS: "250",
			NAVIGATION_VERIFY_TIMEOUT_MS: "3000",
			NEXT_TELEMETRY_DISABLED: "1",
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "";
	child.stdout.on("data", (chunk) => {
		output += chunk;
	});
	child.stderr.on("data", (chunk) => {
		output += chunk;
	});

	const result = await Promise.race([
		new Promise((resolve) => {
			child.once("exit", (code, signal) => resolve({ code, signal }));
		}),
		new Promise((_, reject) =>
			setTimeout(() => {
				child.kill();
				reject(new Error(`${name} did not exit after cleanup.`));
			}, 10_000),
		),
	]);

	assert.notEqual(result.code, 0, `${name} unexpectedly exited successfully.`);
	assert.equal(result.signal, null, `${name} was terminated by ${result.signal}.`);
	assert.match(output, expectedOutput);
	assert.match(output, /Navigation route verifier cleanup complete\./);
	assert.ok(Date.now() - startedAt < 10_000, `${name} leaked resources.`);
	console.log(`Verified fail-closed ${name} path and cleanup.`);
}

await runFailureCase(
	"HTTP assertion failure",
	"globalThis.fetch=async()=>new Response('',{status:500});",
	/Expected \/microzonificacion to return 200, received 500\./,
);

await runFailureCase(
	"hung fetch",
	`globalThis.fetch=async(_url,{signal}={})=>new Promise((_,reject)=>{
		signal?.addEventListener('abort',()=>reject(signal.reason??new Error('aborted')),{once:true});
	});`,
	/Next server did not become ready|deadline exceeded|timed out/i,
);
