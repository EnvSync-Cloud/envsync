import { describe, expect, test } from "bun:test";

import { consumeAcmeNonce, issueAcmeNonce, verifyEab } from "./acme-jws";

describe("ACME nonce and EAB", () => {
	test("issues a nonce that can be consumed once", () => {
		const nonce = issueAcmeNonce();
		expect(consumeAcmeNonce(nonce)).toBe(true);
		expect(consumeAcmeNonce(nonce)).toBe(false);
	});

	test("rejects a missing nonce", () => {
		expect(consumeAcmeNonce(undefined)).toBe(false);
	});

	test("rejects EAB with the wrong kid", () => {
		expect(() =>
			verifyEab(
				{ protected: Buffer.from(JSON.stringify({ kid: "a" })).toString("base64url"), payload: "e30", signature: "aa" },
				Buffer.from("secret").toString("base64url"),
				"b",
			),
		).toThrow(/kid/);
	});
});
