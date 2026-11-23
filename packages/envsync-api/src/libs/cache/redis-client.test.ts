import { describe, expect, test } from "bun:test";

import { shouldDropRedisClient } from "./index";

describe("shouldDropRedisClient", () => {
	test("keeps a client while its socket is open and reconnecting", () => {
		expect(shouldDropRedisClient({ isReady: false, isOpen: true })).toBe(false);
		expect(shouldDropRedisClient({ isReady: true, isOpen: true })).toBe(false);
		expect(shouldDropRedisClient({ isReady: false, isOpen: false })).toBe(true);
	});
});
