/**
 * Export unified OpenAPI (core + manage when EE modules load) with unique operationIds.
 *
 * Usage:
 *   bun run scripts/export-openapi.ts [out.json]
 *   bun run scripts/export-openapi.ts --stdout
 *
 * Env:
 *   ENVSYNC_EXPORT_OSS=1  — skip enterprise manage modules (core-only spec)
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createApiApp } from "../src/app/factory";
import {
	disambiguateOpenApiOperationIds,
	findDuplicateOperationIds,
	type OpenApiDocument,
} from "../src/libs/openapi-disambiguate";
import {
	clearManagementModulesForTests,
	registerManagementModules,
	tryRegisterEnterpriseManageModules,
} from "../src/modules/load-modules";

const args = process.argv.slice(2);
const stdout = args.includes("--stdout");
const outPath =
	args.find(a => a !== "--stdout" && !a.startsWith("--")) ??
	resolve(import.meta.dir, "../../../sdks/envsync-ts-sdk/openapi.json");

clearManagementModulesForTests();
if (process.env.ENVSYNC_EXPORT_OSS !== "1") {
	// Prefer explicit monorepo registration; fall back to dynamic import gate.
	try {
		const { enterpriseManagementModules } = await import("envsync-enterprise");
		registerManagementModules(enterpriseManagementModules);
	} catch {
		await tryRegisterEnterpriseManageModules();
	}
}

const app = await createApiApp("core");
const res = await app.request("http://localhost/openapi");
if (!res.ok) {
	console.error(`Failed to export OpenAPI: ${res.status} ${res.statusText}`);
	process.exit(1);
}

const spec = (await res.json()) as OpenApiDocument;
// Handler already disambiguates; re-run for safety if called on raw docs later.
disambiguateOpenApiOperationIds(spec);

const dups = findDuplicateOperationIds(spec);
if (dups.size > 0) {
	console.error("Duplicate operationIds remain after disambiguation:");
	for (const [id, paths] of dups) {
		console.error(`  ${id}: ${paths.join(" | ")}`);
	}
	process.exit(1);
}

const json = `${JSON.stringify(spec, null, 2)}\n`;
if (stdout) {
	process.stdout.write(json);
} else {
	writeFileSync(outPath, json, "utf8");
	const pathCount = Object.keys(spec.paths ?? {}).length;
	console.log(`Wrote OpenAPI (${pathCount} paths) → ${outPath}`);
}
