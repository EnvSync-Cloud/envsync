import { describe, expect, test } from "bun:test";

import { slugifyName } from "@/utils/random";

describe("slugifyName", () => {
	test("builds a lowercase slug with a 6-digit suffix", () => {
		expect(slugifyName("DevTest")).toMatch(/^devtest-\d{6}$/);
	});

	test("replaces spaces and drops symbols", () => {
		expect(slugifyName("Acme Corp!")).toMatch(/^acme-corp-\d{6}$/);
	});

	test("still works when the Web Crypto global has no randomInt", () => {
		const original = globalThis.crypto;
		Object.defineProperty(globalThis, "crypto", {
			configurable: true,
			value: { getRandomValues: original.getRandomValues.bind(original) },
		});
		try {
			expect(slugifyName("DevTest")).toMatch(/^devtest-\d{6}$/);
		} finally {
			Object.defineProperty(globalThis, "crypto", {
				configurable: true,
				value: original,
			});
		}
	});
});
