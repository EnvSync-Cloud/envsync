import { describe, expect, test } from "bun:test";

import { buildAuditExportCsv, csvEscape } from "./useAuditLogs";

describe("audit export helpers", () => {
  test("escapes quotes and commas", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape('say "hi", now')).toBe('"say ""hi"", now"');
  });

  test("builds a csv with a header row", () => {
    const csv = buildAuditExportCsv([
      {
        created_at: "2026-01-01T00:00:00.000Z",
        action: "app_created",
        user_name: "Ada",
        details: '{"name":"demo"}',
      },
    ]);
    expect(csv).toBe(
      'timestamp,action,user,details\n2026-01-01T00:00:00.000Z,app_created,Ada,"{""name"":""demo""}"\n',
    );
  });
});
