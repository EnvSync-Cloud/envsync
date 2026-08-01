import { defineConfig } from "tsup";
import { fileURLToPath } from "node:url";

const deployCoreSource = fileURLToPath(new URL("../deploy-core/src/index.ts", import.meta.url));

/**
 * OSS deploy CLI: owns the full engine (cli + helpers). Published dist is self-contained.
 * Enterprise package imports the engine via `@envsync-cloud/deploy/cli` (OSS → never imports EE).
 */
export default defineConfig({
	entry: {
		index: "src/index.ts",
		cli: "src/cli.ts",
	},
	format: ["esm"],
	platform: "node",
	target: "node18",
	outDir: "dist",
	bundle: true,
	splitting: false,
	clean: true,
	sourcemap: false,
	dts: false,
	external: ["chalk", "yaml", "zod"],
	esbuildPlugins: [
		{
			name: "workspace-deploy-core-source",
			setup(build) {
				build.onResolve({ filter: /^@envsync-cloud\/deploy-core$/ }, () => ({
					path: deployCoreSource,
				}));
			},
		},
	],
	banner: {
		js: "#!/usr/bin/env node",
	},
});
