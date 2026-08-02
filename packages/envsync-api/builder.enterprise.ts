/*
  Enterprise API process build: bundle core entrypoint + envsync-enterprise
  into a single deployable dist (replaces packages/envsync-management-api).
*/
import fs from "node:fs";
import path from "node:path";

import type { BuildOptions } from "esbuild";
import { build } from "esbuild";

const packageRoot = import.meta.dir;
const envsyncApiSrc = path.join(packageRoot, "src");

const commonOptions: BuildOptions = {
	entryPoints: [path.join(packageRoot, "src/entrypoint.enterprise.ts")],
	absWorkingDir: packageRoot,
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

await build({
	...commonOptions,
	bundle: true,
	outfile: path.join(packageRoot, "dist/entrypoint.enterprise.js"),
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

copyDirSync(path.join(packageRoot, "src/libs/mail/templates/html"), path.join(packageRoot, "dist/templates/html"));
copyDirSync(path.join(packageRoot, "src/libs/mail/templates/base"), path.join(packageRoot, "dist/templates/base"));
copyDirSync(path.join(packageRoot, "src/libs/kms/proto"), path.join(packageRoot, "dist/libs/kms/proto"));
copyDirSync(path.join(packageRoot, "src/assets"), path.join(packageRoot, "dist/assets"));

console.log("enterprise API bundle ready:", path.join(packageRoot, "dist/entrypoint.enterprise.js"));
