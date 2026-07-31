import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const pkgRoot = path.join(import.meta.dir, "..");

function listSourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name === "dist") continue;
			out.push(...listSourceFiles(full));
		} else if (entry.name.endsWith(".ts")) {
			out.push(full);
		}
	}
	return out;
}

describe("management-api package boundary (Phase 5)", () => {
	test("source does not use relative path into envsync-api/src", () => {
		const files = listSourceFiles(path.join(pkgRoot, "src"));
		const piggyback = /from\s+["']\.\.\/\.\.\/envsync-api\//;
		const offenders: string[] = [];
		for (const file of files) {
			const text = fs.readFileSync(file, "utf8");
			if (piggyback.test(text)) {
				offenders.push(path.relative(pkgRoot, file));
			}
		}
		expect(offenders).toEqual([]);
	});

	test("package.json depends on envsync-enterprise + envsync-api + envsync-kernel", () => {
		const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8")) as {
			dependencies: Record<string, string>;
		};
		expect(pkg.dependencies["envsync-enterprise"]).toBe("workspace:*");
		expect(pkg.dependencies["envsync-api"]).toBe("workspace:*");
		expect(pkg.dependencies["envsync-kernel"]).toBe("workspace:*");
	});

	test("tsconfig does not map @/* into envsync-api/src", () => {
		const tsconfig = JSON.parse(fs.readFileSync(path.join(pkgRoot, "tsconfig.json"), "utf8")) as {
			compilerOptions?: { paths?: Record<string, string[]> };
		};
		const paths = tsconfig.compilerOptions?.paths ?? {};
		const alias = paths["@/*"]?.[0] ?? "";
		expect(alias.includes("envsync-api")).toBe(false);
	});
});
