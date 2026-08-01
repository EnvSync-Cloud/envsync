import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
	ensureSetupTokenFile,
	generateSetupToken,
	parseOrgCreateArgs,
	readSetupTokenFile,
	setupTokenFingerprint,
} from "./org-setup";

describe("org-setup helpers", () => {
	test("generateSetupToken produces stable prefix and entropy", () => {
		const a = generateSetupToken();
		const b = generateSetupToken();
		expect(a.startsWith("es_setup_")).toBe(true);
		expect(a).not.toBe(b);
		expect(a.length).toBeGreaterThan(40);
	});

	test("ensureSetupTokenFile persists and reuses token", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-setup-"));
		const file = path.join(dir, "setup.token");
		const first = ensureSetupTokenFile(file);
		const second = ensureSetupTokenFile(file);
		expect(first).toBe(second);
		expect(readSetupTokenFile(file)).toBe(first);
		expect(setupTokenFingerprint(first).length).toBe(12);
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test("parseOrgCreateArgs reads flags", () => {
		const parsed = parseOrgCreateArgs([
			"--name",
			"Acme",
			"--email",
			"admin@acme.test",
			"--password",
			"S3cret!pass",
			"--json",
		]);
		expect(parsed.org_name).toBe("Acme");
		expect(parsed.admin_email).toBe("admin@acme.test");
		expect(parsed.admin_password).toBe("S3cret!pass");
		expect(parsed.json).toBe(true);
		expect(parsed.interactive).toBe(false);
	});
});
