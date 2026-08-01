import { defineConfig } from "tsup";

/**
 * Enterprise deploy CLI: thin entry that forces edition=enterprise and loads
 * the OSS engine via `@envsync-cloud/deploy/cli` (open-core: EE → OSS).
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
	external: ["chalk", "yaml", "zod", "@envsync-cloud/deploy", "@envsync-cloud/deploy/cli"],
	banner: {
		js: "#!/usr/bin/env node",
	},
});
