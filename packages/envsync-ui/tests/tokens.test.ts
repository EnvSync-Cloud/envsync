import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import envsyncUiPreset from "../src/tailwind-preset";

const tokensPath = path.join(import.meta.dir, "../src/tokens.css");

describe("envsync-ui tokens (H5)", () => {
	test("tokens.css defines brand primary and light/dark roots", () => {
		const css = fs.readFileSync(tokensPath, "utf8");
		expect(css).toContain(":root");
		expect(css).toContain(".dark");
		expect(css).toContain("--primary: 153 74% 44%");
		expect(css).toContain("--radius:");
		expect(css).toContain("--sidebar-background:");
	});

	test("tailwind preset maps primary color to CSS variable", () => {
		const colors = envsyncUiPreset.theme?.extend?.colors as Record<string, unknown>;
		expect(colors).toBeDefined();
		const primary = colors.primary as { DEFAULT: string };
		expect(primary.DEFAULT).toContain("--primary");
		expect(colors.background).toContain("--background");
	});
});
