import { describe, expect, test } from "bun:test";

import { composeProfileName, splitProfileName } from "./profile-name";

describe("composeProfileName", () => {
	test("keeps the current side when only one name is sent", () => {
		expect(
			composeProfileName({
				firstName: "Ada",
				currentFullName: "Grace Hopper",
			}),
		).toBe("Ada Hopper");
		expect(
			composeProfileName({
				lastName: "Lovelace",
				currentFullName: "Ada Byron",
			}),
		).toBe("Ada Lovelace");
	});

	test("uses full_name when neither side is sent", () => {
		expect(composeProfileName({ fullName: "Ada Lovelace", currentFullName: "Old Name" })).toBe(
			"Ada Lovelace",
		);
	});

	test("drops an empty side instead of keeping a placeholder", () => {
		expect(splitProfileName("Ada -")).toEqual({ firstName: "Ada", lastName: "" });
		expect(
			composeProfileName({
				firstName: "Ada",
				lastName: "",
				currentFullName: "Ada Lovelace",
			}),
		).toBe("Ada");
	});
});
