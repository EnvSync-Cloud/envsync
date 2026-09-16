import { describe, expect, test } from "bun:test";

import { expandBrowserOrigins } from "@/libs/browser-origins";

describe("expandBrowserOrigins", () => {
	test("strips paths and adds www/apex twins", () => {
		expect(expandBrowserOrigins("https://envsync.cloud/docs")).toEqual(
			expect.arrayContaining(["https://envsync.cloud", "https://www.envsync.cloud"]),
		);
		expect(expandBrowserOrigins("https://www.envsync.cloud")).toEqual(
			expect.arrayContaining(["https://www.envsync.cloud", "https://envsync.cloud"]),
		);
	});

	test("keeps localhost without a www twin", () => {
		expect(expandBrowserOrigins("http://localhost:8002")).toEqual(["http://localhost:8002"]);
	});
});
