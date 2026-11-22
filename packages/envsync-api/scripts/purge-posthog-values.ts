/**
 * List or delete PostHog events and person properties whose names are value fields.
 *
 * Dry-run is the default. --apply deletes matching events and unsets those person properties.
 * Reads POSTHOG_HOST and POSTHOG_KEY. Calls PostHog only when POSTHOG_KEY is a personal key.
 * Prints counts and property names, never property values or the key.
 *
 *   bun run packages/envsync-api/scripts/purge-posthog-values.ts
 *   bun run packages/envsync-api/scripts/purge-posthog-values.ts --apply
 *
 * Imports the analytics source file so the helpers stay out of the browser barrel.
 */
import {
	POSTHOG_PURGE_PROPERTY_NAMES,
	deletionReceipt,
	eventCountQuery,
	eventCountWidth,
	eventCountsFromRow,
	eventDeletionQuery,
	personCountQuery,
	personCountWidth,
	personCountsFromRow,
	personIdQuery,
	personIdsFromQuery,
	personUnsetBody,
	planPosthogPurge,
	projectIdsFromList,
	purgeReport,
	purgeSubmissionId,
	readCountRow,
	redactOperatorText,
	safeErrorDetail,
	soleProjectId,
} from "../../envsync-analytics/src/posthog-value-purge.ts";

const PAGE = 500;
const MAX_PERSONS = 10_000;

function say(message: string): void {
	console.log(redactOperatorText(message));
}

function stop(message: string, code: number): never {
	say(message);
	process.exit(code);
}

async function callPosthog(
	origin: string,
	key: string,
	path: string,
	init?: { method?: string; body?: unknown },
): Promise<{ status: number; body: unknown }> {
	const headers: Record<string, string> = {
		Accept: "application/json",
		Authorization: `Bearer ${key}`,
	};
	let body: string | undefined;
	if (init?.body !== undefined) {
		headers["Content-Type"] = "application/json";
		body = JSON.stringify(init.body);
	}
	const response = await fetch(new URL(path, origin), {
		method: init?.method ?? "GET",
		headers,
		body,
		redirect: "manual",
		signal: AbortSignal.timeout(30_000),
	});
	if (response.status >= 300 && response.status < 400) {
		throw new Error("PostHog redirected the request");
	}
	const text = await response.text();
	if (!text) return { status: response.status, body: null };
	try {
		return { status: response.status, body: JSON.parse(text) as unknown };
	} catch {
		return { status: response.status, body: { detail: "non-json response" } };
	}
}

async function hogql(origin: string, key: string, projectId: number, sql: string): Promise<unknown> {
	const response = await callPosthog(origin, key, `/api/projects/${projectId}/query/`, {
		method: "POST",
		body: {
			query: { kind: "HogQLQuery", query: sql },
			name: "envsync value-field counts",
		},
	});
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`PostHog query failed (${response.status}): ${safeErrorDetail(response.body)}`);
	}
	return response.body;
}

async function listPersonIds(origin: string, key: string, projectId: number): Promise<string[]> {
	const ids: string[] = [];
	for (let offset = 0; offset < MAX_PERSONS; offset += PAGE) {
		const body = await hogql(origin, key, projectId, personIdQuery(offset, PAGE));
		const page = personIdsFromQuery(body);
		if (!page) throw new Error("PostHog person id query returned an unexpected shape");
		ids.push(...page);
		if (page.length < PAGE) return ids;
	}
	throw new Error("PostHog person id query exceeded the page cap");
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.some((arg) => arg !== "--apply")) {
		stop("Usage: bun run packages/envsync-api/scripts/purge-posthog-values.ts [--apply]", 1);
	}
	const apply = args.includes("--apply");
	const plan = planPosthogPurge(
		{ POSTHOG_HOST: process.env.POSTHOG_HOST, POSTHOG_KEY: process.env.POSTHOG_KEY },
		{ apply },
	);
	if (!plan.run) stop(plan.message, plan.exitCode);

	const key = process.env.POSTHOG_KEY?.trim() ?? "";
	const projects = await callPosthog(plan.appOrigin, key, "/api/projects/");
	if (projects.status < 200 || projects.status >= 300) {
		stop(`PostHog purge was not run (project list failed, status ${projects.status}).`, 1);
	}
	const projectId = soleProjectId(projects.body);
	if (projectId === null) {
		stop(`PostHog purge was not run (${projectIdsFromList(projects.body).length} projects visible).`, apply ? 1 : 0);
	}

	const eventRow = readCountRow(await hogql(plan.appOrigin, key, projectId, eventCountQuery()), eventCountWidth());
	const personRow = readCountRow(
		await hogql(plan.appOrigin, key, projectId, personCountQuery()),
		personCountWidth(),
	);
	if (!eventRow || !personRow) stop("PostHog purge was not run (count query returned an unexpected shape).", 1);
	const events = eventCountsFromRow(eventRow);
	const persons = personCountsFromRow(personRow);

	let unset = 0;
	let eventDeletion: { id: string | null; status: string | null; count: number | null } | null = null;
	if (apply) {
		if (persons.matched > 0) {
			const personIds = await listPersonIds(plan.appOrigin, key, projectId);
			if (personIds.length !== persons.matched) {
				throw new Error("PostHog person id count did not match");
			}
			const unsetBody = personUnsetBody();
			for (const personId of personIds) {
				const response = await callPosthog(
					plan.appOrigin,
					key,
					`/api/projects/${projectId}/persons/${encodeURIComponent(personId)}/delete_property/`,
					{ method: "POST", body: unsetBody },
				);
				if (response.status < 200 || response.status >= 300) {
					stop(
						`PostHog person property delete failed (${response.status}): ${safeErrorDetail(response.body)}`,
						1,
					);
				}
				unset += 1;
			}
		}
		if (events.matched > 0) {
			const response = await callPosthog(plan.appOrigin, key, `/api/projects/${projectId}/data_deletion_requests/`, {
				method: "POST",
				body: {
					query: eventDeletionQuery(),
					submission_id: purgeSubmissionId(POSTHOG_PURGE_PROPERTY_NAMES),
				},
			});
			if (response.status === 409) {
				eventDeletion = { id: null, status: "pending", count: null };
			} else if (response.status < 200 || response.status >= 300) {
				stop(`PostHog event deletion failed (${response.status}): ${safeErrorDetail(response.body)}`, 1);
			} else {
				eventDeletion = deletionReceipt(response.body);
			}
		}
	}

	say(
		JSON.stringify(
			purgeReport({
				dryRun: !apply,
				applied: apply,
				events,
				persons: { ...persons, unset },
				eventDeletion,
			}),
			null,
			2,
		),
	);
}

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : "purge failed";
	stop(message.slice(0, 300), 1);
}
