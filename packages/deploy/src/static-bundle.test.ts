import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { normalizeExtractedStaticBundle, validateStaticBundle } from "./static-bundle";

function withTempDir(fn: (dir: string) => void) {
	const dir = mkdtempSync(path.join(tmpdir(), "envsync-static-bundle-"));
	try {
		fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe("static bundle helpers", () => {
	test("validateStaticBundle rejects directories without index.html", () => {
		withTempDir((dir) => {
			writeFileSync(path.join(dir, "asset.js"), "console.log('ok');\n");
			expect(() => validateStaticBundle("web", dir)).toThrow("missing index.html");
		});
	});

	test("normalizeExtractedStaticBundle flattens a single nested bundle root", () => {
		withTempDir((dir) => {
			const nestedRoot = path.join(dir, "dist");
			fs.mkdirSync(path.join(nestedRoot, "assets"), { recursive: true });
			writeFileSync(path.join(nestedRoot, "index.html"), "<html></html>\n");
			writeFileSync(path.join(nestedRoot, "assets", "app.js"), "console.log('ok');\n");

			normalizeExtractedStaticBundle("landing", dir);
			validateStaticBundle("landing", dir);

			expect(fs.existsSync(path.join(dir, "index.html"))).toBe(true);
			expect(fs.existsSync(path.join(dir, "assets", "app.js"))).toBe(true);
			expect(fs.existsSync(nestedRoot)).toBe(false);
		});
	});
});
