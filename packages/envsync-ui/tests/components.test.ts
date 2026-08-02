import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

describe("envsync-ui primitives (P2)", () => {
	test("exports button badge card input modules", () => {
		for (const name of ["button", "badge", "card", "input"]) {
			const path = join(root, "src/components", `${name}.tsx`);
			const text = readFileSync(path, "utf8");
			expect(text.length).toBeGreaterThan(50);
			expect(text).toContain("cn(");
		}
	});

	test("cn util is pure class merge helper", () => {
		const text = readFileSync(join(root, "src/lib/cn.ts"), "utf8");
		expect(text).toContain("twMerge");
		expect(text).toContain("clsx");
	});

	test("package exports include primitives", () => {
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
		expect(pkg.exports["./button"]).toBeTruthy();
		expect(pkg.exports["./cn"]).toBeTruthy();
	});
});
