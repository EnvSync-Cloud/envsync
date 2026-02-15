/*
  This script is heavily inspired by `built.ts` used in @honojs/hono.
  https://github.com/honojs/hono/blob/main/build.ts
*/

import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { BuildOptions, Plugin, PluginBuild } from "esbuild";
import { build } from "esbuild";
import glob from "glob";

const entryPoints = glob.sync("./src/**/*.ts", {
	ignore: ["./src/**/*.test.ts"],
});

const addExtension = (extension: string = ".js", fileExtension: string = ".ts"): Plugin => ({
	name: "add-extension",
	setup(build: PluginBuild) {
		build.onResolve({ filter: /.*/ }, args => {
			if (args.importer) {
				const p = path.join(args.resolveDir, args.path);
				let tsPath = `${p}${fileExtension}`;

				let importPath = "";
				if (fs.existsSync(tsPath)) {
					importPath = args.path + extension;
				} else {
					tsPath = path.join(args.resolveDir, args.path, `index${fileExtension}`);
					if (fs.existsSync(tsPath)) {
						importPath = `${args.path}/index${extension}`;
					}
				}
				return { path: importPath, external: true };
			}
		});
	},
});

const commonOptions: BuildOptions = {
	entryPoints,
	logLevel: "info",
	platform: "node",
};

const esmBuild = () => {
	return build({
		...commonOptions,
		bundle: true,
		outbase: "./src",
		outdir: "./dist",
		format: "esm",
		plugins: [addExtension(".js")],
		treeShaking: true,
	});
};

Promise.all([esmBuild()]);

exec("tsc --emitDeclarationOnly --declaration --project tsconfig.build.json");
