/*
  Management API process build (Phase 5).
  Bundles entrypoints that depend on workspace packages by name
  (envsync-api, envsync-enterprise, envsync-kernel) — no monorepo
  relative path aliases into envsync-api/src.
*/

import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { BuildOptions } from "esbuild";
import { build } from "esbuild";
import { glob } from "glob";

const entryPoints = glob.sync("./src/**/*.ts", {
	ignore: ["./src/**/*.test.ts"],
});

const commonOptions: BuildOptions = {
	entryPoints,
	logLevel: "info",
	platform: "node",
	external: ["bun"],
};

const copyDirSync = (src: string, dest: string) => {
	if (!fs.existsSync(src)) {
		return;
	}
	fs.mkdirSync(dest, { recursive: true });
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDirSync(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
};

// Resolve @/ aliases inside bundled envsync-api sources (workspace package).
const envsyncApiSrc = path.resolve(import.meta.dir, "..", "envsync-api", "src");

await build({
	...commonOptions,
	bundle: true,
	outbase: "./src",
	outdir: "./dist",
	format: "esm",
	treeShaking: true,
	plugins: [
		{
			name: "envsync-api-internal-alias",
			setup(buildApi) {
				buildApi.onResolve({ filter: /^@\// }, args => {
					const relativePath = args.path.slice(2);
					const candidates = [
						path.join(envsyncApiSrc, `${relativePath}.ts`),
						path.join(envsyncApiSrc, `${relativePath}.tsx`),
						path.join(envsyncApiSrc, relativePath, "index.ts"),
					];
					const match = candidates.find(candidate => fs.existsSync(candidate));
					if (!match) return null;
					return { path: match };
				});
			},
		},
	],
});

// Templates still shipped with core mail package for now (shared asset).
copyDirSync("../envsync-api/src/libs/mail/templates/html", "./dist/templates/html");
copyDirSync("../envsync-api/src/libs/mail/templates/base", "./dist/templates/base");

exec("tsc --emitDeclarationOnly --declaration --project tsconfig.build.json");
