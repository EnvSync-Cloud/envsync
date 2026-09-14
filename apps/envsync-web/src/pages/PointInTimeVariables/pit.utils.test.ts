import { describe, expect, test } from "bun:test";

import {
	buildPitHref,
	buildPitDiffRows,
	canSubmitPitRollback,
	createDefaultTimeRange,
	createPresetRange,
	getDefaultSnapshotCompareIds,
	getPitKindFromPathname,
	getPitRangeSummary,
	MASKED_PIT_VALUE,
} from "./pit.utils";

describe("pit.utils", () => {
	test("defaults snapshot compare to newest and previous snapshot", () => {
		const history = [
			{ id: "newest", created_at: "", updated_at: "", org_id: "", app_id: "", env_type_id: "", change_request_message: "", user_id: "", changes_count: 1 },
			{ id: "previous", created_at: "", updated_at: "", org_id: "", app_id: "", env_type_id: "", change_request_message: "", user_id: "", changes_count: 1 },
			{ id: "older", created_at: "", updated_at: "", org_id: "", app_id: "", env_type_id: "", change_request_message: "", user_id: "", changes_count: 1 },
		];

		expect(getDefaultSnapshotCompareIds(history)).toEqual({
			fromPitId: "previous",
			toPitId: "newest",
		});
	});

	test("keeps a preferred snapshot when it still exists", () => {
		const history = [
			{ id: "newest", created_at: "", updated_at: "", org_id: "", app_id: "", env_type_id: "", change_request_message: "", user_id: "", changes_count: 1 },
			{ id: "selected", created_at: "", updated_at: "", org_id: "", app_id: "", env_type_id: "", change_request_message: "", user_id: "", changes_count: 1 },
			{ id: "older", created_at: "", updated_at: "", org_id: "", app_id: "", env_type_id: "", change_request_message: "", user_id: "", changes_count: 1 },
		];

		expect(getDefaultSnapshotCompareIds(history, "selected")).toEqual({
			fromPitId: "older",
			toPitId: "selected",
		});
	});

	test("creates the default 7d range", () => {
		const now = new Date("2026-04-19T12:00:00.000Z");
		expect(createDefaultTimeRange(now)).toEqual({
			preset: "7d",
			start: "2026-04-12T12:00:00.000Z",
			end: "2026-04-19T12:00:00.000Z",
		});
	});

	test("creates the all-history preset with the epoch lower bound", () => {
		const now = new Date("2026-04-19T12:00:00.000Z");
		expect(createPresetRange("all", now)).toEqual({
			preset: "all",
			start: "1970-01-01T00:00:00.000Z",
			end: "2026-04-19T12:00:00.000Z",
		});
	});

	test("builds diff rows for the inline table", () => {
		expect(
			buildPitDiffRows({
				added: [{ key: "A", value: "1" }],
				modified: [{ key: "B", old_value: "1", new_value: "2" }],
				deleted: [{ key: "C", value: "3" }],
			}, "variables")
		).toEqual([
			{ type: "Added", key: "A", before: "Not set", after: "1" },
			{ type: "Modified", key: "B", before: "1", after: "2" },
			{ type: "Deleted", key: "C", before: "3", after: "Not set" },
		]);
	});

	test("masks secret diff values in inline rows", () => {
		expect(
			buildPitDiffRows({
				added: [{ key: "A", value: "secret-1" }],
				modified: [{ key: "B", old_value: "old-secret", new_value: "new-secret" }],
				deleted: [{ key: "C", value: "secret-3" }],
			}, "secrets")
		).toEqual([
			{ type: "Added", key: "A", before: "Not set", after: MASKED_PIT_VALUE },
			{ type: "Modified", key: "B", before: MASKED_PIT_VALUE, after: MASKED_PIT_VALUE },
			{ type: "Deleted", key: "C", before: MASKED_PIT_VALUE, after: "Not set" },
		]);
	});

	test("summarizes range results", () => {
		const history = [
			{ id: "latest", created_at: "", updated_at: "", org_id: "", app_id: "", env_type_id: "", change_request_message: "", user_id: "", changes_count: 1 },
			{ id: "middle", created_at: "", updated_at: "", org_id: "", app_id: "", env_type_id: "", change_request_message: "", user_id: "", changes_count: 1 },
			{ id: "earliest", created_at: "", updated_at: "", org_id: "", app_id: "", env_type_id: "", change_request_message: "", user_id: "", changes_count: 1 },
		];

		expect(getPitRangeSummary(history)).toEqual({
			total: 3,
			latest: history[0],
			earliest: history[2],
		});
	});

	test("derives variables as the default PiT kind", () => {
		expect(getPitKindFromPathname("/applications/pit/app-123")).toBe("variables");
		expect(getPitKindFromPathname("/projects/app-123/pit")).toBe("variables");
	});

	test("derives secrets from the PiT secrets route", () => {
		expect(getPitKindFromPathname("/applications/pit/app-123/secrets")).toBe("secrets");
		expect(getPitKindFromPathname("/projects/app-123/pit/secrets")).toBe("secrets");
	});

	test("builds PiT hrefs that preserve the selected environment", () => {
		expect(buildPitHref("app-123", "variables", "development")).toBe(
			"/projects/app-123/pit?env=development"
		);
		expect(buildPitHref("app-123", "secrets", "staging")).toBe(
			"/projects/app-123/pit/secrets?env=staging"
		);
	});

	test("requires both the exact PIT ID and a rollback message before submitting", () => {
		expect(
			canSubmitPitRollback({
				expectedPitId: "pit-123",
				typedPitId: "pit-123",
				rollbackMessage: "Rollback for incident recovery",
			})
		).toBe(true);
		expect(
			canSubmitPitRollback({
				expectedPitId: "pit-123",
				typedPitId: "pit-12",
				rollbackMessage: "Rollback for incident recovery",
			})
		).toBe(false);
		expect(
			canSubmitPitRollback({
				expectedPitId: "pit-123",
				typedPitId: "pit-123",
				rollbackMessage: "   ",
			})
		).toBe(false);
	});
});
