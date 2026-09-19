import { v4 as uuidv4 } from "uuid";

import { DB, JsonValue } from "envsync-api/ports/db";
import { orNotFound } from "envsync-api/ports/errors";
import infoLogs, { LogTypes } from "envsync-api/ports/logger";

export type ProviderType = "datadog" | "splunk" | "sumo-logic" | "logstash" | "fluentd" | "otlp";

interface AuditLogPayload {
    readonly action: AuditActions;
    readonly org_id: string;
    readonly user_id: string;
    readonly details: Record<string, unknown>;
    readonly message: string;
}

const SENSITIVE_CONFIG_KEYS = ["api_key", "token", "password", "authorization"] as const;

function maskSecret(value: string): string {
    if (value.length <= 4) return "****";
    return value.slice(0, -4).replace(/./g, "*") + value.slice(-4);
}

function maskSensitiveConfig(config: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
        if (SENSITIVE_CONFIG_KEYS.includes(key as (typeof SENSITIVE_CONFIG_KEYS)[number]) && typeof value === "string") {
            masked[key] = maskSecret(value);
        } else if (key === "headers" && value && typeof value === "object" && !Array.isArray(value)) {
            masked[key] = Object.fromEntries(
                Object.entries(value as Record<string, unknown>).map(([header, headerValue]) => [
                    header,
                    /authorization|password|token/i.test(header) && typeof headerValue === "string"
                        ? maskSecret(headerValue)
                        : headerValue,
                ]),
            );
        } else {
            masked[key] = value;
        }
    }
    return masked;
}

async function forwardToDatadog(
    config: Record<string, unknown>,
    payload: AuditLogPayload,
): Promise<void> {
    const apiKey = config.api_key as string;
    const site = (config.site as string) ?? "datadoghq.com";
    const service = (config.service as string) ?? "envsync";
    const source = (config.source as string) ?? "envsync-api";

    const url = `https://http-intake.logs.${site}/api/v2/logs`;
    const body = JSON.stringify([{
        ddsource: source,
        ddtags: `action:${payload.action},org:${payload.org_id}`,
        hostname: "envsync-api",
        message: payload.message,
        service,
        audit: {
            action: payload.action,
            org_id: payload.org_id,
            user_id: payload.user_id,
            details: payload.details,
        },
    }]);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "DD-API-KEY": apiKey,
        },
        body,
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        throw new Error(`Datadog logs intake returned ${response.status}: ${await response.text()}`);
    }
}

async function forwardToSplunk(
    config: Record<string, unknown>,
    payload: AuditLogPayload,
): Promise<void> {
    const token = config.token as string;
    const endpoint = config.endpoint as string;
    const source = (config.source as string) ?? "envsync";
    const index = config.index as string | undefined;

    const body: Record<string, unknown> = {
        event: {
            action: payload.action,
            org_id: payload.org_id,
            user_id: payload.user_id,
            message: payload.message,
            details: payload.details,
        },
        source,
    };
    if (index) {
        body.index = index;
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Splunk ${token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        throw new Error(`Splunk HEC returned ${response.status}: ${await response.text()}`);
    }
}

async function forwardToSumoLogic(
    config: Record<string, unknown>,
    payload: AuditLogPayload,
): Promise<void> {
    const url = config.url as string;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Sumo-Category": `envsync/audit/${payload.action}`,
        },
        body: JSON.stringify({
            action: payload.action,
            org_id: payload.org_id,
            user_id: payload.user_id,
            message: payload.message,
            details: payload.details,
        }),
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        throw new Error(`Sumo Logic returned ${response.status}: ${await response.text()}`);
    }
}

function auditEvent(payload: AuditLogPayload) {
    return {
        action: payload.action,
        org_id: payload.org_id,
        user_id: payload.user_id,
        message: payload.message,
        details: payload.details,
    };
}

function requestHeaders(config: Record<string, unknown>): Record<string, string> {
    const headers: Record<string, string> = {};
    const extra = config.headers;
    if (extra && typeof extra === "object" && !Array.isArray(extra)) {
        for (const [key, value] of Object.entries(extra as Record<string, unknown>)) {
            if (typeof value === "string" && value.length > 0) headers[key] = value;
        }
    }
    if (typeof config.authorization === "string" && config.authorization) {
        headers.Authorization = config.authorization;
    }
    const username = config.username as string | undefined;
    const password = config.password as string | undefined;
    if (username && password) {
        headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    }
    return headers;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>, label: string) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
        throw new Error(`${label} returned ${response.status}: ${await response.text()}`);
    }
}

async function forwardToLogstash(
    config: Record<string, unknown>,
    payload: AuditLogPayload,
): Promise<void> {
    const event = auditEvent(payload);
    const body = config.json_batch === false ? event : [event];
    await postJson(config.endpoint as string, body, requestHeaders(config), "Logstash");
}

function fluentdProtocol(config: Record<string, unknown>): "forward" | "http" {
    if (config.protocol === "forward" || config.protocol === "http") return config.protocol;
    if (typeof config.host === "string" && config.host) return "forward";
    return "http";
}

async function forwardToFluentd(
    config: Record<string, unknown>,
    payload: AuditLogPayload,
): Promise<void> {
    const tag = ((config.tag as string | undefined) ?? "envsync.audit").replace(/^\//, "");
    if (fluentdProtocol(config) === "forward") {
        await forwardFluentdPacked(
            (config.host as string) ?? "127.0.0.1",
            Number(config.port ?? 24224),
            tag,
            auditEvent(payload),
        );
        return;
    }
    const endpoint = (config.endpoint as string).replace(/\/$/, "");
    const url = endpoint.includes(tag) ? endpoint : `${endpoint}/${tag}`;
    const event = auditEvent(payload);
    const body = config.json_array === false ? event : [event];
    await postJson(url, body, requestHeaders(config), "Fluentd");
}

function otlpLogsUrl(endpoint: string) {
    const trimmed = endpoint.replace(/\/$/, "");
    return trimmed.endsWith("/v1/logs") ? trimmed : `${trimmed}/v1/logs`;
}

async function forwardToOtlp(
    config: Record<string, unknown>,
    payload: AuditLogPayload,
): Promise<void> {
    const url = otlpLogsUrl(config.endpoint as string);
    const nowNs = `${BigInt(Date.now()) * 1_000_000n}`;
    await postJson(
        url,
        {
            resourceLogs: [
                {
                    resource: {
                        attributes: [
                            { key: "service.name", value: { stringValue: "envsync" } },
                            { key: "org.id", value: { stringValue: payload.org_id } },
                        ],
                    },
                    scopeLogs: [
                        {
                            logRecords: [
                                {
                                    timeUnixNano: nowNs,
                                    severityText: "INFO",
                                    body: { stringValue: payload.message },
                                    attributes: [
                                        { key: "audit.action", value: { stringValue: String(payload.action) } },
                                        { key: "audit.user_id", value: { stringValue: payload.user_id } },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        requestHeaders(config),
        "OTLP",
    );
}

function encodeMsgpack(value: unknown): Uint8Array {
    const out: number[] = [];
    const utf8 = new TextEncoder();
    const write = (item: unknown) => {
        if (item === null || item === undefined) {
            out.push(0xc0);
            return;
        }
        if (typeof item === "boolean") {
            out.push(item ? 0xc3 : 0xc2);
            return;
        }
        if (typeof item === "number") {
            if (Number.isInteger(item) && item >= 0 && item < 128) {
                out.push(item);
                return;
            }
            if (Number.isInteger(item) && item >= -32 && item < 0) {
                out.push(0xe0 | (item + 32));
                return;
            }
            if (Number.isInteger(item) && item >= 0 && item <= 0xffffffff) {
                out.push(0xce, (item >>> 24) & 0xff, (item >>> 16) & 0xff, (item >>> 8) & 0xff, item & 0xff);
                return;
            }
            const view = new DataView(new ArrayBuffer(9));
            view.setUint8(0, 0xcb);
            view.setFloat64(1, item);
            out.push(...new Uint8Array(view.buffer));
            return;
        }
        if (typeof item === "string") {
            const bytes = utf8.encode(item);
            if (bytes.length < 32) out.push(0xa0 | bytes.length);
            else if (bytes.length < 256) out.push(0xd9, bytes.length);
            else out.push(0xda, bytes.length >> 8, bytes.length & 0xff);
            out.push(...bytes);
            return;
        }
        if (Array.isArray(item)) {
            if (item.length < 16) out.push(0x90 | item.length);
            else out.push(0xdc, item.length >> 8, item.length & 0xff);
            item.forEach(write);
            return;
        }
        if (typeof item === "object") {
            const entries = Object.entries(item as Record<string, unknown>);
            if (entries.length < 16) out.push(0x80 | entries.length);
            else out.push(0xde, entries.length >> 8, entries.length & 0xff);
            for (const [key, val] of entries) {
                write(key);
                write(val);
            }
        }
    };
    write(value);
    return Uint8Array.from(out);
}

async function forwardFluentdPacked(
    host: string,
    port: number,
    tag: string,
    record: Record<string, unknown>,
): Promise<void> {
    const net = await import("node:net");
    const packet = encodeMsgpack([tag, Math.floor(Date.now() / 1000), record]);
    await new Promise<void>((resolve, reject) => {
        const socket = net.connect({ host, port }, () => {
            socket.write(Buffer.from(packet), () => socket.end());
        });
        socket.setTimeout(10_000);
        socket.on("timeout", () => {
            socket.destroy();
            reject(new Error(`Fluentd forward ${host}:${port} timed out`));
        });
        socket.on("error", reject);
        socket.on("close", () => resolve());
    });
}

async function forwardToProvider(
    providerType: ProviderType,
    config: Record<string, unknown>,
    payload: AuditLogPayload,
): Promise<void> {
    switch (providerType) {
        case "datadog":
            return forwardToDatadog(config, payload);
        case "splunk":
            return forwardToSplunk(config, payload);
        case "sumo-logic":
            return forwardToSumoLogic(config, payload);
        case "logstash":
            return forwardToLogstash(config, payload);
        case "fluentd":
            return forwardToFluentd(config, payload);
        case "otlp":
            return forwardToOtlp(config, payload);
        default: {
            const _exhaustive: never = providerType;
            throw new Error(`Unsupported provider type: ${String(_exhaustive)}`);
        }
    }
}

export class LogForwardingService {
    public static createConfig = async ({
        org_id,
        name,
        provider_type,
        config,
        enabled = true,
    }: {
        org_id: string;
        name: string;
        provider_type: ProviderType;
        config: Record<string, unknown>;
        enabled?: boolean;
    }): Promise<string> => {
        const id = uuidv4();
        const db = await DB.getInstance();

        await db
            .insertInto("log_forwarding_configs")
            .values({
                id,
                org_id,
                name,
                provider_type,
                config: new JsonValue(config),
                enabled,
                created_at: new Date(),
                updated_at: new Date(),
            })
            .execute();

        return id;
    };

    public static getConfigsByOrgId = async (org_id: string) => {
        const db = await DB.getInstance();

        const configs = await db
            .selectFrom("log_forwarding_configs")
            .selectAll()
            .where("org_id", "=", org_id)
            .execute();

        return configs.map((row) => ({
            ...row,
            config: maskSensitiveConfig(row.config as Record<string, unknown>),
        }));
    };

    public static getConfigById = async (id: string) => {
        const db = await DB.getInstance();

        const config = await orNotFound(
            db
                .selectFrom("log_forwarding_configs")
                .selectAll()
                .where("id", "=", id)
                .executeTakeFirstOrThrow(),
            "LogForwardingConfig",
            id,
        );

        return {
            ...config,
            config: maskSensitiveConfig(config.config as Record<string, unknown>),
        };
    };

    public static deleteConfig = async (id: string): Promise<void> => {
        const db = await DB.getInstance();

        await db
            .deleteFrom("log_forwarding_configs")
            .where("id", "=", id)
            .execute();
    };

    /**
     * Forward an audit log entry to all enabled log forwarding configs for the org.
     * Failures are logged but do not propagate — forwarding is fire-and-forget.
     */
    public static forwardAuditLog = async (payload: AuditLogPayload): Promise<void> => {
        const db = await DB.getInstance();

        const configs = await db
            .selectFrom("log_forwarding_configs")
            .selectAll()
            .where("org_id", "=", payload.org_id)
            .where("enabled", "=", true)
            .execute();

        if (configs.length === 0) {
            return;
        }

        await Promise.allSettled(
            configs.map(async (cfg) => {
                try {
                    await forwardToProvider(
                        cfg.provider_type as ProviderType,
                        cfg.config as Record<string, unknown>,
                        payload,
                    );
                } catch (err) {
                    infoLogs(
                        `Log forwarding failed for config ${cfg.id} (${cfg.provider_type}): ${err instanceof Error ? err.message : String(err)}`,
                        LogTypes.ERROR,
                        "LogForwardingService",
                    );
                }
            }),
        );
    };
}
