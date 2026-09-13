#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const STACK_NAME = process.env.ENVSYNC_STACK_NAME ?? "envsync";
const ROOT_DOMAIN = process.env.ENVSYNC_ROOT_DOMAIN ?? "envsync.local";
const CLICKSTACK_SERVICE_NAME = `${STACK_NAME}_clickstack`;
const CLICKSTACK_API_URL = "http://127.0.0.1:8000/api/v2";
const SELFHOST_OPERATOR_EMAIL = process.env.ENVSYNC_CLICKSTACK_OPERATOR_EMAIL ?? `operator@${ROOT_DOMAIN}`;
const SELFHOST_OPERATOR_PASSWORD = process.env.ENVSYNC_CLICKSTACK_OPERATOR_PASSWORD ?? "";
const SELFHOST_DASHBOARD_ACCESS_KEY =
	process.env.ENVSYNC_CLICKSTACK_ACCESS_KEY?.trim() || `envsync-selfhost-${ROOT_DOMAIN}-dashboard-access-key`;
const SELFHOST_BROWSER_API_KEY =
	process.env.ENVSYNC_CLICKSTACK_BROWSER_API_KEY?.trim() || `envsync-selfhost-${ROOT_DOMAIN}-browser-api-key`;
const ALERT_WEBHOOK_URL = process.env.ENVSYNC_CLICKSTACK_ALERT_WEBHOOK_URL ?? "";
const ALERT_WEBHOOK_HEADERS = parseJsonObject(process.env.ENVSYNC_CLICKSTACK_ALERT_WEBHOOK_HEADERS);
const REQUIRED_SAVED_SEARCHES = [
	"Frontend Errors - Web",
	"Frontend Errors - Landing",
	"API Errors",
	"Org Onboarding Completed",
	"Apps Created",
	"Users Invited",
	"Webhooks Created",
	"Slow API Traces",
	"Frontend API Calls",
];

function parseJsonObject(raw) {
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function run(cmd, args) {
	return execFileSync(cmd, args, {
		stdio: ["ignore", "pipe", "pipe"],
		encoding: "utf8",
	}).trim();
}

function resolveClickstackContainerId() {
	const output = run("docker", [
		"ps",
		"--filter",
		`label=com.docker.swarm.service.name=${CLICKSTACK_SERVICE_NAME}`,
		"--format",
		"{{.ID}}",
	]);
	const containerId = output.split(/\r?\n/).map(line => line.trim()).find(Boolean);
	if (!containerId) {
		throw new Error(`Could not resolve running ClickStack container for service ${CLICKSTACK_SERVICE_NAME}`);
	}
	return containerId;
}

function getClickstackBrowserApiKey(containerId) {
	try {
		const output = runClickstackMongoScript(containerId, `
var team = db.teams.findOne({ name: "EnvSync Self-Hosted Team" });
print(team && team.apiKey ? team.apiKey : "");
`);
		return output.split("\n").map(line => line.trim()).filter(Boolean).at(-1) ?? "";
	} catch {
		return "";
	}
}

function runClickstackNodeScript(containerId, script) {
	const payload = Buffer.from(script, "utf8").toString("base64");
	return run("docker", [
		"exec",
		"-e",
		`HDX_SCRIPT=${payload}`,
		containerId,
		"node",
		"-e",
		"eval(Buffer.from(process.env.HDX_SCRIPT, 'base64').toString('utf8'))",
	]);
}

function runClickstackMongoScript(containerId, script) {
	const payload = Buffer.from(script, "utf8").toString("base64");
	return run("docker", [
		"exec",
		"-e",
		`HDX_SCRIPT=${payload}`,
		containerId,
		"sh",
		"-lc",
		"printf '%s' \"$HDX_SCRIPT\" | base64 -d >/tmp/hdx-bootstrap.js && mongo hyperdx --quiet /tmp/hdx-bootstrap.js",
	]);
}

function ensureSelfHostedBootstrap(containerId) {
	const output = runClickstackMongoScript(containerId, `
var now = new Date();
var accessKey = ${JSON.stringify(SELFHOST_DASHBOARD_ACCESS_KEY)};
var browserApiKey = ${JSON.stringify(SELFHOST_BROWSER_API_KEY)};
var teamName = "EnvSync Self-Hosted Team";
var connectionName = "Default ClickHouse";

var team = db.teams.findOne({ name: teamName });
if (!team) {
  db.teams.insertOne({
    name: teamName,
    hookId: "envsync-selfhost-hook-id",
    apiKey: browserApiKey,
    collectorAuthenticationEnforced: false,
    createdAt: now,
    updatedAt: now
  });
  team = db.teams.findOne({ name: teamName });
} else {
  db.teams.updateOne(
    { _id: team._id },
    {
      $set: {
        apiKey: browserApiKey,
        updatedAt: now
      }
    }
  );
  team = db.teams.findOne({ _id: team._id });
}

var connection = db.connections.findOne({ team: team._id, name: connectionName });
if (!connection) {
  db.connections.insertOne({
    team: team._id,
    name: connectionName,
    host: "http://ch-server:8123",
    username: "default",
    password: "",
    createdAt: now,
    updatedAt: now
  });
  connection = db.connections.findOne({ team: team._id, name: connectionName });
}

function ensureSource(name, kind, document) {
  var source = db.sources.findOne({ team: team._id, name: name });
  var baseDocument = Object.assign({}, document, {
    name: name,
    kind: kind,
    team: team._id,
    connection: connection._id,
    updatedAt: now
  });
  if (!source) {
    baseDocument.createdAt = now;
    db.sources.insertOne(baseDocument);
  } else {
    db.sources.updateOne({ _id: source._id }, { $set: baseDocument });
  }
  source = db.sources.findOne({ team: team._id, name: name });
  return source;
}

var traces = ensureSource("Traces", "trace", {
  from: { databaseName: "default", tableName: "otel_traces" },
  timestampValueExpression: "Timestamp",
  displayedTimestampValueExpression: "Timestamp",
  defaultTableSelectExpression: "Timestamp, ServiceName, SpanName, StatusCode",
  durationExpression: "Duration",
  durationPrecision: 9,
  serviceNameExpression: "ServiceName",
  traceIdExpression: "TraceId",
  spanIdExpression: "SpanId",
  parentSpanIdExpression: "ParentSpanId",
  spanNameExpression: "SpanName",
  spanKindExpression: "SpanKind",
  statusCodeExpression: "StatusCode",
  statusMessageExpression: "StatusMessage",
  eventAttributesExpression: "SpanAttributes",
  spanEventsValueExpression: "Events",
  resourceAttributesExpression: "ResourceAttributes",
  highlightedTraceAttributeExpressions: [
    { sqlExpression: "ServiceName", alias: "service.name", luceneExpression: "ServiceName" },
    { sqlExpression: "ResourceAttributes['host.name']", alias: "host.name", luceneExpression: "ResourceAttributes.host.name" }
  ],
  highlightedRowAttributeExpressions: [
    { sqlExpression: "SpanAttributes['db.system']", alias: "db.system", luceneExpression: "SpanAttributes.db.system" },
    { sqlExpression: "SpanAttributes['db.operation.name']", alias: "db.operation.name", luceneExpression: "SpanAttributes.db.operation.name" },
    { sqlExpression: "SpanAttributes['http.method']", alias: "http.method", luceneExpression: "SpanAttributes.http.method" },
    { sqlExpression: "SpanAttributes['http.route']", alias: "http.route", luceneExpression: "SpanAttributes.http.route" },
    { sqlExpression: "SpanAttributes['http.status_code']", alias: "http.status_code", luceneExpression: "SpanAttributes.http.status_code" },
    { sqlExpression: "SpanAttributes['envsync.event_name']", alias: "envsync.event_name", luceneExpression: "SpanAttributes.envsync.event_name" },
    { sqlExpression: "SpanAttributes['envsync.event_category']", alias: "envsync.event_category", luceneExpression: "SpanAttributes.envsync.event_category" },
    { sqlExpression: "SpanAttributes['envsync.org_id']", alias: "envsync.org_id", luceneExpression: "SpanAttributes.envsync.org_id" },
    { sqlExpression: "SpanAttributes['envsync.role_name']", alias: "envsync.role_name", luceneExpression: "SpanAttributes.envsync.role_name" },
    { sqlExpression: "SpanAttributes['envsync.user_id']", alias: "envsync.user_id", luceneExpression: "SpanAttributes.envsync.user_id" }
  ],
  materializedViews: [],
  querySettings: []
});

var metrics = ensureSource("Metrics", "metric", {
  from: { databaseName: "default", tableName: "" },
  metricTables: {
    gauge: "otel_metrics_gauge",
    sum: "otel_metrics_sum",
    histogram: "otel_metrics_histogram"
  },
  timestampValueExpression: "TimeUnix",
  serviceNameExpression: "ServiceName",
  resourceAttributesExpression: "ResourceAttributes",
  querySettings: []
});

var logs = ensureSource("Logs", "log", {
  from: { databaseName: "default", tableName: "otel_logs" },
  timestampValueExpression: "Timestamp",
  displayedTimestampValueExpression: "Timestamp",
  defaultTableSelectExpression: "Timestamp, ServiceName, SeverityText, Body",
  serviceNameExpression: "ServiceName",
  severityTextExpression: "SeverityText",
  bodyExpression: "Body",
  eventAttributesExpression: "LogAttributes",
  resourceAttributesExpression: "ResourceAttributes",
  traceIdExpression: "TraceId",
  spanIdExpression: "SpanId",
  implicitColumnExpression: "Body",
  highlightedTraceAttributeExpressions: [],
  highlightedRowAttributeExpressions: [
    { sqlExpression: "ServiceName", alias: "service.name", luceneExpression: "ServiceName" },
    { sqlExpression: "LogAttributes['http.method']", alias: "http.method", luceneExpression: "LogAttributes.http.method" },
    { sqlExpression: "LogAttributes['http.route']", alias: "http.route", luceneExpression: "LogAttributes.http.route" },
    { sqlExpression: "LogAttributes['http.status_code']", alias: "http.status_code", luceneExpression: "LogAttributes.http.status_code" },
    { sqlExpression: "LogAttributes['envsync.event_name']", alias: "envsync.event_name", luceneExpression: "LogAttributes.envsync.event_name" },
    { sqlExpression: "LogAttributes['envsync.event_category']", alias: "envsync.event_category", luceneExpression: "LogAttributes.envsync.event_category" },
    { sqlExpression: "LogAttributes['envsync.org_id']", alias: "envsync.org_id", luceneExpression: "LogAttributes.envsync.org_id" },
    { sqlExpression: "LogAttributes['envsync.role_name']", alias: "envsync.role_name", luceneExpression: "LogAttributes.envsync.role_name" },
    { sqlExpression: "LogAttributes['envsync.user_id']", alias: "envsync.user_id", luceneExpression: "LogAttributes.envsync.user_id" },
    { sqlExpression: "LogAttributes['log.source']", alias: "log.source", luceneExpression: "LogAttributes.log.source" }
  ],
  materializedViews: [],
  querySettings: []
});

var sessions = ensureSource("Sessions", "session", {
  from: { databaseName: "default", tableName: "hyperdx_sessions" },
  timestampValueExpression: "Timestamp",
  displayedTimestampValueExpression: "Timestamp",
  defaultTableSelectExpression: "Timestamp, ServiceName, Body",
  serviceNameExpression: "ServiceName",
  bodyExpression: "Body",
  eventAttributesExpression: "LogAttributes",
  resourceAttributesExpression: "ResourceAttributes",
  traceIdExpression: "TraceId",
  spanIdExpression: "SpanId",
  implicitColumnExpression: "Body",
  highlightedTraceAttributeExpressions: [],
  highlightedRowAttributeExpressions: [
    { sqlExpression: "ServiceName", alias: "service.name", luceneExpression: "ServiceName" },
    { sqlExpression: "LogAttributes['envsync.event_name']", alias: "envsync.event_name", luceneExpression: "LogAttributes.envsync.event_name" },
    { sqlExpression: "LogAttributes['envsync.event_category']", alias: "envsync.event_category", luceneExpression: "LogAttributes.envsync.event_category" },
    { sqlExpression: "LogAttributes['envsync.org_id']", alias: "envsync.org_id", luceneExpression: "LogAttributes.envsync.org_id" },
    { sqlExpression: "LogAttributes['envsync.role_name']", alias: "envsync.role_name", luceneExpression: "LogAttributes.envsync.role_name" },
    { sqlExpression: "LogAttributes['envsync.user_id']", alias: "envsync.user_id", luceneExpression: "LogAttributes.envsync.user_id" }
  ],
  materializedViews: [],
  querySettings: []
});

db.sources.updateOne(
  { _id: logs._id },
  { $set: { traceSourceId: traces._id.valueOf(), metricSourceId: metrics._id.valueOf(), updatedAt: now } }
);

db.sources.updateOne(
  { _id: traces._id },
  { $set: { logSourceId: logs._id.valueOf(), metricSourceId: metrics._id.valueOf(), sessionSourceId: sessions._id.valueOf(), updatedAt: now } }
);

db.sources.updateOne(
  { _id: sessions._id },
  { $set: { traceSourceId: traces._id.valueOf(), updatedAt: now } }
);

print(accessKey);
`);

	const accessKey = output.split("\n").map(line => line.trim()).filter(Boolean).at(-1);
	if (!accessKey) {
		throw new Error("Could not resolve self-hosted ClickStack access key");
	}
	return accessKey;
}

function ensureSelfHostedOperator(containerId, accessKey) {
	if (!SELFHOST_OPERATOR_PASSWORD) {
		throw new Error("Missing ENVSYNC_CLICKSTACK_OPERATOR_PASSWORD for self-hosted ClickStack bootstrap");
	}

	const authFields = JSON.parse(runClickstackNodeScript(containerId, `
const User = require("/app/packages/api/build/models/user").default;

const accessKey = ${JSON.stringify(accessKey)};
const email = ${JSON.stringify(SELFHOST_OPERATOR_EMAIL.toLowerCase())};
const password = ${JSON.stringify(SELFHOST_OPERATOR_PASSWORD)};
const operatorName = "EnvSync Self-Hosted Operator";

const user = new User({
  name: operatorName,
  email,
  accessKey,
});

user.setPassword(password, error => {
  if (error) {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
    return;
  }
  process.stdout.write(JSON.stringify({
    email,
    name: operatorName,
    accessKey,
    hash: user.hash,
    salt: user.salt,
  }));
});
`));

	const output = runClickstackMongoScript(containerId, `
var now = new Date();
var teamName = "EnvSync Self-Hosted Team";
var email = ${JSON.stringify(SELFHOST_OPERATOR_EMAIL.toLowerCase())};
var operatorName = "EnvSync Self-Hosted Operator";
var accessKey = ${JSON.stringify(accessKey)};
var hash = ${JSON.stringify(authFields.hash)};
var salt = ${JSON.stringify(authFields.salt)};

var team = db.teams.findOne({ name: teamName });
if (!team) {
  throw new Error("Self-hosted ClickStack team was not created before operator bootstrap");
}

var existingUser = db.users.findOne({ email: email });
if (!existingUser) {
  db.users.insertOne({
    name: operatorName,
    email: email,
    team: team._id,
    accessKey: accessKey,
    hash: hash,
    salt: salt,
    createdAt: now,
    updatedAt: now
  });
} else {
  db.users.updateOne(
    { _id: existingUser._id },
    {
      $set: {
        name: operatorName,
        email: email,
        team: team._id,
        accessKey: accessKey,
        hash: hash,
        salt: salt,
        updatedAt: now
      }
    }
  );
}

print(JSON.stringify({ email: email, accessKey: accessKey, teamId: team._id.valueOf() }));
`);

	const parsed = output.split("\n").map(line => line.trim()).filter(Boolean).at(-1);
	if (!parsed) {
		throw new Error("Could not resolve self-hosted ClickStack operator output");
	}
	return JSON.parse(parsed);
}

function clickstackApi(containerId, accessKey, method, routePath, body) {
	const payload = body == null ? "" : Buffer.from(JSON.stringify(body), "utf8").toString("base64");
	const script = `
const body = process.env.HDX_BODY ? Buffer.from(process.env.HDX_BODY, "base64").toString("utf8") : undefined;
fetch("${CLICKSTACK_API_URL}" + process.env.HDX_PATH, {
  method: process.env.HDX_METHOD,
  headers: {
    Authorization: "Bearer " + process.env.HDX_ACCESS_KEY,
    "Content-Type": "application/json",
  },
  body,
})
  .then(async (res) => {
    const text = await res.text();
    if (!res.ok) {
      console.error(text);
      process.exit(1);
    }
    process.stdout.write(text);
  })
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  });
`;

	const output = runClickstackNodeScript(containerId, `
process.env.HDX_ACCESS_KEY = ${JSON.stringify(accessKey)};
process.env.HDX_METHOD = ${JSON.stringify(method)};
process.env.HDX_PATH = ${JSON.stringify(routePath)};
process.env.HDX_BODY = ${JSON.stringify(payload)};
${script}
`);

	return JSON.parse(output);
}

function numberTile(name, sourceId, x, y, where, extra = {}) {
	const select = { aggFn: "count", ...extra };
	if (where) {
		select.where = where;
		select.whereLanguage = "sql";
	}
	return {
		name,
		x,
		y,
		w: 4,
		h: 3,
		config: {
			displayType: "number",
			sourceId,
			select: [select],
		},
	};
}

function lineTile(name, sourceId, x, y, where, select, groupBy) {
	const normalizedSelect = { ...select };
	if (where) {
		normalizedSelect.where = where;
		normalizedSelect.whereLanguage = "sql";
	}
	return {
		name,
		x,
		y,
		w: 6,
		h: 4,
		config: {
			displayType: "line",
			sourceId,
			select: [normalizedSelect],
			...(groupBy?.length ? { groupBy: groupBy.join(",") } : {}),
		},
	};
}

function getDashboardDefinitions(sourceIds) {
	const logs = sourceIds.Logs;
	const traces = sourceIds.Traces;
	if (!logs || !traces) {
		throw new Error(`Missing required ClickStack sources: ${JSON.stringify(sourceIds)}`);
	}

	return [
		{
			name: "EnvSync Overview",
			tags: ["envsync", "overview"],
			filters: [],
			tiles: [
				numberTile("HTTP Requests", logs, 0, 0, "LogAttributes['log.type'] = 'http_request'"),
				numberTile("Error Logs", logs, 4, 0, "SeverityText = 'ERROR'"),
				numberTile("Trace Spans", traces, 8, 0),
				lineTile("Request Rate (RPS)", traces, 0, 3, "notEmpty(SpanAttributes['http.route'])", {
					aggFn: "count",
				}),
				lineTile("Error Logs Over Time", logs, 6, 3, "SeverityText = 'ERROR'", { aggFn: "count" }),
				lineTile("Span Volume", traces, 0, 7, undefined, { aggFn: "count" }),
				lineTile("Span Volume by Service", traces, 6, 7, undefined, { aggFn: "count" }, ["ServiceName"]),
			],
		},
		{
			name: "EnvSync Response Times",
			tags: ["envsync", "latency"],
			filters: [],
			tiles: [
				lineTile("p50 Span Duration", traces, 0, 0, undefined, {
					aggFn: "quantile",
					level: 0.5,
					valueExpression: "Duration / 1000000",
					numberFormat: { output: "time" },
				}),
				lineTile("p95 Span Duration", traces, 6, 0, undefined, {
					aggFn: "quantile",
					level: 0.95,
					valueExpression: "Duration / 1000000",
					numberFormat: { output: "time" },
				}),
				lineTile("p95 Span Duration by Service", traces, 0, 4, undefined, {
					aggFn: "quantile",
					level: 0.95,
					valueExpression: "Duration / 1000000",
					numberFormat: { output: "time" },
				}, ["ServiceName"]),
				lineTile("Error Span Volume", traces, 6, 4, "StatusCode = 'STATUS_CODE_ERROR'", { aggFn: "count" }),
			],
		},
		{
			name: "EnvSync Request Inspector",
			tags: ["envsync", "requests"],
			filters: [],
			tiles: [
				lineTile("HTTP Requests by Severity", logs, 0, 0, "LogAttributes['log.type'] = 'http_request'", { aggFn: "count" }, ["SeverityText"]),
				lineTile("Error Logs by Severity", logs, 6, 0, "SeverityText = 'ERROR'", { aggFn: "count" }, ["SeverityText"]),
				lineTile("Spans by Name", traces, 0, 4, undefined, { aggFn: "count" }, ["SpanName"]),
				lineTile("Spans by Service", traces, 6, 4, undefined, { aggFn: "count" }, ["ServiceName"]),
			],
		},
		{
			name: "EnvSync Infra Logs",
			tags: ["envsync", "infra"],
			filters: [],
			tiles: [
				lineTile("Logs by Severity", logs, 0, 0, undefined, { aggFn: "count" }, ["SeverityText"]),
				lineTile("Logs by Service", logs, 6, 0, undefined, { aggFn: "count" }, ["ServiceName"]),
				lineTile("Error Logs by Severity", logs, 0, 6, "SeverityText = 'ERROR'", { aggFn: "count" }, ["SeverityText"]),
				lineTile("Traces by Service", traces, 6, 6, undefined, { aggFn: "count" }, ["ServiceName"]),
			],
		},
	];
}

function getSavedSearchDefinitions(sourceIds) {
	const logs = sourceIds.Logs;
	const traces = sourceIds.Traces;
	const sessions = sourceIds.Sessions;
	if (!logs || !traces || !sessions) {
		throw new Error(`Missing required ClickStack sources for saved searches: ${JSON.stringify(sourceIds)}`);
	}

	return [
		{
			name: "Frontend Errors - Web",
			source: logs,
			select: "TimestampTime, ServiceName, SeverityText, Body",
			where: "ServiceName:envsync-web AND (LogAttributes.error.type:* OR \"App error\" OR LogAttributes.log.source:console.error)",
			whereLanguage: "lucene",
			tags: ["envsync", "frontend", "errors", "alerts"],
		},
		{
			name: "Frontend Errors - Landing",
			source: logs,
			select: "TimestampTime, ServiceName, SeverityText, Body",
			where: "ServiceName:envsync-landing AND (LogAttributes.error.type:* OR LogAttributes.log.source:console.error)",
			whereLanguage: "lucene",
			tags: ["envsync", "frontend", "errors", "alerts"],
		},
		{
			name: "API Errors",
			source: traces,
			select: "Timestamp, ServiceName, SpanName, Duration, StatusCode",
			where: "ServiceName = 'envsync-api' AND (toInt64OrZero(SpanAttributes['http.status_code']) >= 500 OR StatusCode = 'STATUS_CODE_ERROR')",
			whereLanguage: "sql",
			tags: ["envsync", "backend", "errors", "alerts"],
		},
		{
			name: "Org Onboarding Completed",
			source: sessions,
			select: "TimestampTime, ServiceName, Body",
			where: "LogAttributes.envsync.event_name:org_onboarding_completed",
			whereLanguage: "lucene",
			tags: ["envsync", "onboarding", "alerts"],
		},
		{
			name: "Apps Created",
			source: sessions,
			select: "TimestampTime, ServiceName, Body",
			where: "LogAttributes.envsync.event_name:app_created",
			whereLanguage: "lucene",
			tags: ["envsync", "applications", "alerts"],
		},
		{
			name: "Users Invited",
			source: sessions,
			select: "TimestampTime, ServiceName, Body",
			where: "LogAttributes.envsync.event_name:user_invited",
			whereLanguage: "lucene",
			tags: ["envsync", "alerts"],
		},
		{
			name: "Webhooks Created",
			source: sessions,
			select: "TimestampTime, ServiceName, Body",
			where: "LogAttributes.envsync.event_name:webhook_created",
			whereLanguage: "lucene",
			tags: ["envsync", "webhooks", "alerts"],
		},
		{
			name: "Slow API Traces",
			source: traces,
			select: "Timestamp, ServiceName, SpanName, Duration, StatusCode",
			where: "ServiceName = 'envsync-api' AND Duration > 1000000000",
			whereLanguage: "sql",
			tags: ["envsync", "backend", "performance", "alerts"],
		},
		{
			name: "Frontend API Calls",
			source: traces,
			select: "Timestamp, ServiceName, SpanName, Duration, StatusCode",
			where: "(ServiceName:envsync-web OR ServiceName:envsync-landing) AND SpanAttributes.http.route:*",
			whereLanguage: "lucene",
			tags: ["envsync", "frontend", "performance"],
		},
	];
}

function ensureSelfHostedSavedSearches(containerId, sourceIds) {
	const definitions = getSavedSearchDefinitions(sourceIds);
	const output = runClickstackMongoScript(containerId, `
var now = new Date();
var teamName = "EnvSync Self-Hosted Team";
var definitions = ${JSON.stringify(definitions)};
var team = db.teams.findOne({ name: teamName });
if (!team) {
  throw new Error("Self-hosted ClickStack team was not created before saved search bootstrap");
}

definitions.forEach(function(definition) {
  var existing = db.savedsearches.findOne({ team: team._id, name: definition.name });
  var doc = {
    team: team._id,
    name: definition.name,
    select: definition.select,
    where: definition.where,
    whereLanguage: definition.whereLanguage,
    orderBy: definition.orderBy || undefined,
    source: ObjectId(definition.source),
    tags: Array.isArray(definition.tags) ? definition.tags : [],
    filters: Array.isArray(definition.filters) ? definition.filters : [],
    updatedAt: now
  };
  if (!existing) {
    doc.createdAt = now;
    db.savedsearches.insertOne(doc);
  } else {
    db.savedsearches.updateOne({ _id: existing._id }, { $set: doc });
  }
});

print(JSON.stringify(definitions.map(function(definition) {
  return definition.name;
})));
`);

	const parsed = output.split("\n").map(line => line.trim()).filter(Boolean).at(-1);
	if (!parsed) {
		throw new Error("Could not resolve self-hosted ClickStack saved search output");
	}
	return JSON.parse(parsed);
}

function ensureSelfHostedAlertWebhook(containerId) {
	if (!ALERT_WEBHOOK_URL) return null;
	const output = runClickstackMongoScript(containerId, `
var now = new Date();
var teamName = "EnvSync Self-Hosted Team";
var webhookName = "EnvSync Alerts";
var team = db.teams.findOne({ name: teamName });
if (!team) {
  throw new Error("Self-hosted ClickStack team was not created before webhook bootstrap");
}

var existing = db.webhooks.findOne({ team: team._id, service: "generic", name: webhookName });
var doc = {
  team: team._id,
  service: "generic",
  name: webhookName,
  url: ${JSON.stringify(ALERT_WEBHOOK_URL)},
  description: "EnvSync self-host alert notifications",
  headers: ${JSON.stringify(ALERT_WEBHOOK_HEADERS)},
  updatedAt: now
};

if (!existing) {
  doc.createdAt = now;
  db.webhooks.insertOne(doc);
  existing = db.webhooks.findOne({ team: team._id, service: "generic", name: webhookName });
} else {
  db.webhooks.updateOne({ _id: existing._id }, { $set: doc });
  existing = db.webhooks.findOne({ _id: existing._id });
}

print(JSON.stringify({
  id: existing._id.valueOf(),
  name: existing.name,
  url: existing.url
}));
`);
	const parsed = output.split("\n").map(line => line.trim()).filter(Boolean).at(-1);
	if (!parsed) {
		throw new Error("Could not resolve self-hosted ClickStack alert webhook output");
	}
	return JSON.parse(parsed);
}

function main() {
	const containerId = resolveClickstackContainerId();
	const accessKey = ensureSelfHostedBootstrap(containerId);
	const browserApiKey = getClickstackBrowserApiKey(containerId);
	const operator = ensureSelfHostedOperator(containerId, accessKey);
	const sourcesResp = clickstackApi(containerId, accessKey, "GET", "/sources");
	const dashboardsResp = clickstackApi(containerId, accessKey, "GET", "/dashboards");
	const sourceIds = Object.fromEntries(sourcesResp.data.map(source => [source.name, source.id]));
	const dashboardsByName = new Map(dashboardsResp.data.map(dashboard => [dashboard.name, dashboard.id]));
	const definitions = getDashboardDefinitions(sourceIds);

	for (const definition of definitions) {
		const existingId = dashboardsByName.get(definition.name);
		if (existingId) {
			clickstackApi(containerId, accessKey, "PUT", `/dashboards/${existingId}`, definition);
			console.error(`Updated dashboard: ${definition.name}`);
			continue;
		}
		clickstackApi(containerId, accessKey, "POST", "/dashboards", definition);
		console.error(`Created dashboard: ${definition.name}`);
	}

	const savedSearches = ensureSelfHostedSavedSearches(containerId, sourceIds);
	for (const name of savedSearches) {
		console.error(`Upserted saved search: ${name}`);
	}

	const alertWebhook = ensureSelfHostedAlertWebhook(containerId);
	if (alertWebhook) {
		console.error(`Upserted alert webhook: ${alertWebhook.name}`);
	}

	console.error(`ClickStack operator email: ${operator.email}`);
	console.error("ClickStack operator password: [redacted]");
	console.error("ClickStack access key: [redacted]");
	if (browserApiKey) {
		console.error("ClickStack browser API key: [redacted]");
	}
	console.log(JSON.stringify({
		operatorEmail: operator.email,
		accessKey: accessKey ? "[redacted]" : undefined,
		browserApiKey: browserApiKey ? "[redacted]" : undefined,
		savedSearches,
		alertWebhook,
	}));
}

main();
