import { defineConfig } from "tsup";
import { fileURLToPath } from "node:url";

const deployCoreSource = fileURLToPath(new URL("../deploy-core/src/index.ts", import.meta.url));

/**
 * OSS deploy CLI build: bundles the shared lifecycle engine from packages/deploy-cli
 * with ENVSYNC_DEPLOY_FORCE_EDITION=oss, producing a self-contained dist/ without monorepo spawn.
 * Runtime deps (chalk, yaml) stay external so Node ESM works cleanly.
 */
export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	platform: "node",
	target: "node18",
	outDir: "dist",
	bundle: true,
	splitting: false,
	clean: true,
	sourcemap: false,
	dts: false,
	// Keep runtime deps external (listed in package.json dependencies).
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
