import { type Logger } from "kysely";

import infoLogs, { LogTypes } from "@/libs/logger";
import { config } from "@/utils/env";

/** Log the SQL for queries. */
export const KyselyLogger: Logger = event => {
	if (config.DB_LOGGING === "false") return;

	const { query, queryDurationMillis } = event;
	const { sql, parameters } = query;

	infoLogs(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		`SQL: ${sql} \nPARAMS: ${JSON.stringify(parameters, (_, val) => (typeof val === "bigint" ? val.toString() : val))} \nTIME: ${queryDurationMillis}ms`,
		LogTypes.LOGS,
		"DB:Kysely",
	);
};
