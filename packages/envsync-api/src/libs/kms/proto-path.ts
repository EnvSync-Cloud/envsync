import fs from "node:fs";
import path from "node:path";

/**
 * Source + OSS per-file dist keep protos next to the gRPC client.
 * The enterprise image is a single-file bundle (`dist/entrypoint.enterprise.js`),
 * so `import.meta.dir` is `dist/` and protos live at `dist/libs/kms/proto`
 * (and `dist/proto` after the enterprise builder copy).
 */
export function resolveKmsProtoDir(fromDir: string): string {
	const candidates = [
		path.resolve(fromDir, "proto"),
		path.resolve(fromDir, "libs/kms/proto"),
		path.resolve(fromDir, "../src/libs/kms/proto"),
	];
	const match = candidates.find(dir => fs.existsSync(path.join(dir, "kms.proto")));
	if (!match) {
		throw new Error(
			`miniKMS proto files not found (looked for kms.proto in ${candidates.join(", ")})`,
		);
	}
	return match;
}
