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

	test("fixture: prod-config-unchanged", () => {
		const prod = readFileSync(path.join(root, "docker-compose.prod.yaml"), "utf8");
		const dev = readFileSync(path.join(root, "docker-compose.yaml"), "utf8");
		expect(prod).not.toContain("MINIKMS_DPOP_");
		expect(dev).not.toContain("MINIKMS_DPOP_");
	});
});
