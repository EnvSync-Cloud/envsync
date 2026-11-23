import { describe, expect, test } from "bun:test";

import infoLogs, { LogTypes } from "@/libs/logger";
import { LOG_REDACTED, redactLogPayload, redactWrittenLog } from "@/libs/logger/redact";

const SENTINEL = "envsync-log-sentinel-9f3c2a";

describe("redactLogPayload", () => {
	test("redacts env value fields in a logged payload", () => {
		const payload = {
			key: "DATABASE_URL",
			app_id: "app_1",
			value_count: 2,
			value: SENTINEL,
			VALUE: SENTINEL,
			nested: {
				old_value: SENTINEL,
				plaintext: SENTINEL,
				kept: "environment-name",
			},
			items: [{ key: "TOKEN", value: SENTINEL, old_value: SENTINEL }],
			body: JSON.stringify({
				key: "DATABASE_URL",
				new_value: SENTINEL,
				previous_value: SENTINEL,
				proposed_value: SENTINEL,
				secret: SENTINEL,
				changes: [{ key: "DATABASE_URL", value: SENTINEL, proposed_value: SENTINEL }],
			}),
		};

		const logged = redactLogPayload(payload) as {
			key: string;
			app_id: string;
			value_count: number;
			value: string;
			VALUE: string;
			nested: { old_value: string; plaintext: string; kept: string };
			items: Array<{ key: string; value: string; old_value: string }>;
			body: string;
		};
		const serialized = JSON.stringify(logged);

		expect(payload.value).toBe(SENTINEL);
		expect(serialized).not.toContain(SENTINEL);
		expect(logged.key).toBe("DATABASE_URL");
		expect(logged.app_id).toBe("app_1");
		expect(logged.value_count).toBe(2);
		expect(logged.value).toBe(LOG_REDACTED);
		expect(logged.VALUE).toBe(LOG_REDACTED);
		expect(logged.nested.old_value).toBe(LOG_REDACTED);
		expect(logged.nested.plaintext).toBe(LOG_REDACTED);
		expect(logged.nested.kept).toBe("environment-name");
		expect(logged.items[0]?.key).toBe("TOKEN");
		expect(logged.items[0]?.value).toBe(LOG_REDACTED);
		expect(logged.items[0]?.old_value).toBe(LOG_REDACTED);

		const body = JSON.parse(logged.body) as {
			key: string;
			new_value: string;
			previous_value: string;
			proposed_value: string;
			secret: string;
			changes: string;
		};
		expect(body.key).toBe("DATABASE_URL");
		expect(body.new_value).toBe(LOG_REDACTED);
		expect(body.previous_value).toBe(LOG_REDACTED);
		expect(body.proposed_value).toBe(LOG_REDACTED);
		expect(body.secret).toBe(LOG_REDACTED);
		expect(body.changes).toBe(LOG_REDACTED);
		expect(JSON.stringify(body)).not.toContain(SENTINEL);
	});

	test("redacts a JSON request body and prose value assignment in a log line", () => {
		const message = `request body ${JSON.stringify({
			key: "DATABASE_URL",
			value: SENTINEL,
			nested: { old_value: SENTINEL },
		})} proposed_value=${SENTINEL}`;
		const logged = redactLogPayload(message);

		expect(typeof logged).toBe("string");
		expect(logged).not.toContain(SENTINEL);
		expect(logged).toContain(LOG_REDACTED);
		expect(logged).toContain("DATABASE_URL");
		expect(logged).toContain("proposed_value=[REDACTED]");
		expect(redactLogPayload(`note proposed_value="${SENTINEL} extra words"`)).not.toContain(
			SENTINEL,
		);

		const record = `${JSON.stringify({
			level: 30,
			msg: `loaded value=${SENTINEL}`,
			req: { body: JSON.stringify({ key: "DATABASE_URL", plaintext: SENTINEL }) },
		})}\n`;
		const written = redactWrittenLog(record);
		expect(written.endsWith("\n")).toBe(true);
		expect(written).not.toContain(SENTINEL);
		const parsed = JSON.parse(written) as {
			level: number;
			msg: string;
			req: { body: string };
		};
		expect(parsed.level).toBe(30);
		expect(parsed.msg).toBe(`loaded value=${LOG_REDACTED}`);
		const reqBody = JSON.parse(parsed.req.body) as { key: string; plaintext: string };
		expect(reqBody.key).toBe("DATABASE_URL");
		expect(reqBody.plaintext).toBe(LOG_REDACTED);
	});

	test("infoLogs writes a payload without the env value", () => {
		const chunks: string[] = [];
		const original = process.stdout.write.bind(process.stdout);
		process.stdout.write = ((chunk: string | Uint8Array) => {
			chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
			return true;
		}) as typeof process.stdout.write;
		try {
			infoLogs(
				{
					key: "DATABASE_URL",
					value: SENTINEL,
					nested: { previous_value: SENTINEL },
					body: JSON.stringify({ proposed_value: SENTINEL, changes: [{ value: SENTINEL }] }),
				},
				LogTypes.CUSTOMOBJ,
				"logger-redaction-test",
			);
		} finally {
			process.stdout.write = original;
		}

		const logged = chunks.join("");
		expect(logged).not.toContain(SENTINEL);
		expect(logged).toContain(`"value":"${LOG_REDACTED}"`);
		expect(logged).toContain("DATABASE_URL");
		expect(logged).toContain("logger-redaction-test");
	});
});
