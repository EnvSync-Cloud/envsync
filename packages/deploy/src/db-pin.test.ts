import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { parse } from "yaml";

import { databaseImageLock, POSTGRES_IMAGE, REDIS_IMAGE } from "./render";

const repoRoot = join(import.meta.dir, "../../..");

function walk(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			files.push(...walk(full));
			continue;
		}
		if (entry.endsWith(".ts") || entry.endsWith(".json")) files.push(full);
	}
	return files;
}

/** Floating major tags. Built from parts so this file does not contain the tag text. */
function floatingTag(name: string, major: string) {
	return new RegExp(`${name}:${major}(?!\\.)`);
}

describe("fixture:db-pin-ac3 source scan", () => {
	test("deploy source and compose files have no floating Postgres or Redis major tags", () => {
		const files = [
			...walk(import.meta.dir),
			join(repoRoot, "docker-compose.yaml"),
			join(repoRoot, "docker-compose.prod.yaml"),
		];
		const patterns = [floatingTag("postgres", "17"), floatingTag("redis", "7")];
		const hits: string[] = [];
		for (const file of files) {
			const text = readFileSync(file, "utf8");
			for (const pattern of patterns) {
				pattern.lastIndex = 0;
				if (pattern.test(text)) hits.push(file.slice(repoRoot.length + 1));
			}
		}
		expect(hits).toEqual([]);
	});

	test("versions.lock.json matches the image lock used by the renderer", () => {
		const lock = JSON.parse(readFileSync(join(import.meta.dir, "../versions.lock.json"), "utf8"));
		expect(lock).toEqual(databaseImageLock());
		expect(lock.postgres).toBe(POSTGRES_IMAGE);
		expect(lock.redis).toBe(REDIS_IMAGE);
		expect(lock.digests.postgres).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(lock.digests.redis).toMatch(/^sha256:[a-f0-9]{64}$/);
	});

	test("compose files use the same pins and do not set Swarm replica policy", () => {
		for (const name of ["docker-compose.yaml", "docker-compose.prod.yaml"]) {
			const text = readFileSync(join(repoRoot, name), "utf8");
			expect(text).not.toContain("update_config");
			expect(text).not.toContain("rollback_config");
			expect(text).not.toMatch(/^\s*replicas:/m);
			const doc = parse(text) as { services: Record<string, { image?: string }> };
			const postgresServices = Object.entries(doc.services).filter(([, service]) => service.image?.startsWith("postgres:"));
			expect(postgresServices.length).toBeGreaterThanOrEqual(4);
			for (const [, service] of postgresServices) {
				expect(service.image).toBe(POSTGRES_IMAGE);
			}
			expect(doc.services.redis.image).toBe(REDIS_IMAGE);
		}
	});
});
