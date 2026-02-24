import { SpanStatusCode, context } from "@opentelemetry/api";
import { type Logger } from "kysely";

import infoLogs, { LogTypes } from "@/libs/logger";
import { getTracer } from "@/libs/telemetry";
import { dbQueryDuration } from "@/libs/telemetry/metrics";
import { config } from "@/utils/env";

/** Extract table name and field names from a SQL string. */
function parseSQL(sql: string): { table: string; fields: string[]; keywords: string[] } {
	const tableMatch = sql.match(/(?:FROM|INTO|UPDATE|JOIN)\s+"?(\w+)"?/i);
	const table = tableMatch?.[1] ?? "unknown";

	// Track all keywords in the SQL query
	const keywordsMatch = sql.match(/(?:FROM|INTO|UPDATE|JOIN|WHERE|ORDER BY|GROUP BY|LIMIT|OFFSET|SELECT|INSERT|DELETE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|SET|SHOW|USE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|PREPARE|EXECUTE|DEALLOCATE|EXPLAIN|ANALYZE|VACUUM|COPY|LOCK|UNLOCK|EXPLAIN|ANALYZE|VACUUM|COPY|LOCK|UNLOCK)\s+"?(\w+)"?/i);
	const keywords = keywordsMatch?.map(match => match[1]) ?? [];
	const fields: string[] = [];
	const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/is);
	if (selectMatch) {
		const cols = selectMatch[1].match(/"(\w+)"/g);
		if (cols) fields.push(...cols.map(c => c.replace(/"/g, "")));
	}
	return { table, fields, keywords };
}

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

	// Fast path: extract operation name without full SQL parsing
	const operationName = sql.trimStart().split(/\s/)[0]?.toUpperCase() || "QUERY";

	dbQueryDuration.record(queryDurationMillis, {
		"db.operation.name": operationName,
	});

	// Only create detailed OTEL spans with full SQL parsing for errors or when logging is enabled
	const isError = event.level === "error";
	const needsDetailedSpan = isError || config.DB_LOGGING !== "false";

	const tracer = getTracer();
	if (needsDetailedSpan) {
		const { table, fields, keywords } = parseSQL(sql);
		const span = tracer.startSpan(
			`db.query ${operationName}`,
			{
				attributes: {
					"db.system": "postgresql",
					"db.operation.name": operationName,
					"db.sql.table": table,
					"db.sql.fields": fields.join(", "),
					"db.sql.keywords": keywords.join(", "),
					"db.statement": sql,
					"db.query.duration_ms": queryDurationMillis,
				},
			},
			context.active(),
		);

		if (isError) {
			span.setStatus({ code: SpanStatusCode.ERROR, message: "Query failed" });
			span.recordException(event.error as Error);
		} else {
			span.setStatus({ code: SpanStatusCode.OK });
		}

		span.end();
	} else {
		// Lightweight span without expensive SQL parsing
		const span = tracer.startSpan(
			`db.query ${operationName}`,
			{
				attributes: {
					"db.system": "postgresql",
					"db.operation.name": operationName,
					"db.statement": sql,
					"db.query.duration_ms": queryDurationMillis,
				},
			},
			context.active(),
		);
		span.setStatus({ code: SpanStatusCode.OK });
		span.end();
	}
};
