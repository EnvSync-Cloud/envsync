import { describe, expect, test } from "bun:test";

import { appCreateNeedsByokPlan } from "./app-create-policy";

describe("appCreateNeedsByokPlan", () => {
	test("does not require BYOK when secrets are off", () => {
		expect(appCreateNeedsByokPlan(false, false)).toBe(false);
	});

	test("does not require BYOK when EnvSync generates the key", () => {
		expect(appCreateNeedsByokPlan(true, true)).toBe(false);
	});

	test("requires BYOK when the caller supplies the public key", () => {
		expect(appCreateNeedsByokPlan(true, false)).toBe(true);
	});
});
