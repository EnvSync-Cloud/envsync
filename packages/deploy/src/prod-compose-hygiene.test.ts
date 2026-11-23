import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "bun:test";

const root = path.resolve(import.meta.dir, "../../..");

describe("production compose hygiene", () => {
	test("does not mount committed miniKMS development PEMs", () => {
		const compose = readFileSync(path.join(root, "docker-compose.prod.yaml"), "utf8");
		expect(compose).not.toMatch(/docker\/minikms\/[^:\s]+\.dev\.pem/);
	});

	test("deploy guide does not exclude Hosted from the public deploy CLI in the edition table", () => {
		const guide = readFileSync(path.join(root, "DEPLOY.md"), "utf8");
		expect(guide).not.toContain("not public deploy CLI");
	});

	test("fixture prod-compose-auxiliary-postgres-healthchecks: service_healthy where a healthcheck exists", () => {
		const compose = readFileSync(path.join(root, "docker-compose.prod.yaml"), "utf8");
		expect(compose).toContain('pg_isready -U atrium');
		expect(compose).toContain('pg_isready -U openfga');
		expect(compose).toContain("pg_isready -U ${MINIKMS_DB_USER:-postgres}");
		expect(compose).toMatch(/postgres:\n\s+condition: service_healthy/);
		expect(compose).toMatch(/redis:\n\s+condition: service_healthy/);
		expect(compose).toMatch(/atrium_db:\n\s+condition: service_healthy/);
		expect(compose).toMatch(/openfga_db:\n\s+condition: service_healthy/);
		expect(compose).toMatch(/minikms_db:\n\s+condition: service_healthy/);
		expect(compose).toMatch(/rustfs:\n\s+condition: service_started/);
		expect(compose).toMatch(/openfga:\n\s+condition: service_started/);
		expect(compose).toMatch(/minikms:\n\s+condition: service_started/);
		const renderSource = readFileSync(path.join(root, "packages/deploy/src/render.ts"), "utf8");
		expect(renderSource).not.toContain("depends_on");
	});
});
