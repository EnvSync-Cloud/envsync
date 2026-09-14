import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";

import { resolveKmsProtoDir } from "@/libs/kms/proto-path";

const temps: string[] = [];

afterEach(() => {
	for (const dir of temps.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function tempDir() {
	const dir = mkdtempSync(path.join(tmpdir(), "kms-proto-"));
	temps.push(dir);
	return dir;
}

describe("resolveKmsProtoDir", () => {
	test("finds proto next to the module (source / OSS dist)", () => {
		const root = tempDir();
		mkdirSync(path.join(root, "proto"));
		writeFileSync(path.join(root, "proto", "kms.proto"), "syntax = \"proto3\";\n");
		expect(resolveKmsProtoDir(root)).toBe(path.resolve(root, "proto"));
	});

	test("finds proto under libs/kms when import.meta.dir is the enterprise bundle dist/", () => {
		const dist = tempDir();
		mkdirSync(path.join(dist, "libs", "kms", "proto"), { recursive: true });
		writeFileSync(path.join(dist, "libs", "kms", "proto", "kms.proto"), "syntax = \"proto3\";\n");
		expect(resolveKmsProtoDir(dist)).toBe(path.resolve(dist, "libs/kms/proto"));
	});

	test("throws when no candidate contains kms.proto", () => {
		const empty = tempDir();
		expect(() => resolveKmsProtoDir(empty)).toThrow(/miniKMS proto files not found/);
	});
});
