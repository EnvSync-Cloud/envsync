import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Generate core TS SDK from unified OpenAPI (core + /api/v1/manage when EE modules load).
 *
 * Default: in-process export via packages/envsync-api/scripts/export-openapi.ts
 * Override: OPENAPI_SPEC=path-or-url or ENVSYNC_API_URL=http://host for live /openapi
 */
const sdkRoot = resolve(import.meta.dir, "..");
const specOutput = resolve(sdkRoot, "openapi.json");
const srcOutput = resolve(sdkRoot, "src");
const monorepoExport = resolve(
	sdkRoot,
	"../../packages/envsync-api/scripts/export-openapi.ts",
);

async function loadSpecText(): Promise<string> {
	if (process.env.OPENAPI_SPEC?.startsWith("http")) {
		const res = await fetch(process.env.OPENAPI_SPEC);
		if (!res.ok) {
			throw new Error(`Failed to fetch OpenAPI: ${res.status} ${res.statusText}`);
		}
		return await res.text();
	}
	if (process.env.OPENAPI_SPEC) {
		return await Bun.file(process.env.OPENAPI_SPEC).text();
	}
	if (process.env.ENVSYNC_API_URL) {
		const res = await fetch(`${process.env.ENVSYNC_API_URL.replace(/\/$/, "")}/openapi`);
		if (!res.ok) {
			throw new Error(`Failed to fetch OpenAPI: ${res.status} ${res.statusText}`);
		}
		return await res.text();
	}

// Write to file (not stdout) — Hono request logger would pollute stdout JSON.
	const result = spawnSync("bun", ["run", monorepoExport, specOutput], {
		cwd: resolve(sdkRoot, "../.."),
		encoding: "utf8",
		env: process.env,
		maxBuffer: 64 * 1024 * 1024,
	});
	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout || "export-openapi failed");
	}
	return await Bun.file(specOutput).text();
}

try {
	const specText = await loadSpecText();
	JSON.parse(specText);

	mkdirSync(sdkRoot, { recursive: true });
	writeFileSync(specOutput, specText.endsWith("\n") ? specText : `${specText}\n`);

	rmSync(srcOutput, { recursive: true, force: true });
	execSync(`openapi -i "${specOutput}" -o "${srcOutput}" -c fetch --name EnvSyncAPISDK`, {
		cwd: sdkRoot,
		stdio: "inherit",
	});

	console.log(`SDK generated successfully from ${specOutput}.`);
} catch (error) {
	console.error("Error generating SDK:", error);
	process.exit(1);
}
