import { describe, expect, test } from "bun:test";

import { redactCliCommand } from "./audit-metadata";

describe("redactCliCommand", () => {
	test("redacts values after = and keeps the name", () => {
		expect(redactCliCommand("envsync set KEY=cli-sentinel-value")).toBe("envsync set KEY=<redacted>");
		expect(redactCliCommand("envsync config set backend_url=https://api.example.test")).toBe(
			"envsync config set backend_url=<redacted>",
		);
		expect(redactCliCommand("envsync push --env=cli-sentinel-value --strict")).toBe(
			"envsync push --env=<redacted> --strict",
		);
	});

	test("redacts positional values on set and import commands", () => {
		expect(redactCliCommand("envsync set KEY cli-sentinel-value")).toBe("envsync set KEY <redacted>");
		expect(redactCliCommand('envsync set KEY "cli-sentinel-value"')).toBe("envsync set KEY <redacted>");
		expect(redactCliCommand("envsync import cli-sentinel-value")).toBe("envsync import <redacted>");
		expect(redactCliCommand("envsync import --file cli-sentinel-value")).toBe("envsync import --file <redacted>");
	});

	test("keeps a name passed to a name flag", () => {
		expect(redactCliCommand("envsync set --key KEY --value cli-sentinel-value")).toBe(
			"envsync set --key KEY --value <redacted>",
		);
	});

	test("leaves ordinary sentences unchanged", () => {
		expect(redactCliCommand("Environment variable DATABASE_URL updated in app app_1.")).toBe(
			"Environment variable DATABASE_URL updated in app app_1.",
		);
	});
});
