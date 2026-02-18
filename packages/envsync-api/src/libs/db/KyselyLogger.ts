import { SpanStatusCode } from "@opentelemetry/api";
import { type Logger } from "kysely";

import infoLogs, { LogTypes } from "@/libs/logger";
import { getTracer } from "@/libs/telemetry";
import { dbQueryDuration } from "@/libs/telemetry/metrics";
import { config } from "@/utils/env";

/** Log the SQL for queries and create OTEL spans. */
export const KyselyLogger: Logger = event => {
	const { query, queryDurationMillis } = event;
	const { sql, parameters } = query;

	if (config.DB_LOGGING !== "false") {
		infoLogs(
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			`SQL: ${sql} \nPARAMS: ${JSON.stringify(parameters, (_, val) => (typeof val === "bigint" ? val.toString() : val))} \nTIME: ${queryDurationMillis}ms`,
			LogTypes.LOGS,
			"DB:Kysely",
		);
	}

	// Create OTEL span for every query
	const tracer = getTracer();
	const operationName = sql.trimStart().split(/\s/)[0]?.toUpperCase() || "QUERY";
	const span = tracer.startSpan(`db.query ${operationName}`, {
		attributes: {
			"db.system": "postgresql",
			"db.statement": sql,
			"db.operation.name": operationName,
			"db.query.duration_ms": queryDurationMillis,
		},
	});

	dbQueryDuration.record(queryDurationMillis, {
		"db.operation.name": operationName,
	});

	if (event.level === "error") {
		span.setStatus({ code: SpanStatusCode.ERROR, message: "Query failed" });
		span.recordException(event.error as Error);
	} else {
		span.setStatus({ code: SpanStatusCode.OK });
	}

	span.end();
};
