import { v4 as uuidv4 } from "uuid";

import { DB, JsonValue } from "@/libs/db";
import { orNotFound } from "@/libs/errors";
import infoLogs, { LogTypes } from "@/libs/logger";

export type ProviderType = "datadog" | "splunk" | "sumo-logic";

interface AuditLogPayload {
    readonly action: AuditActions;
    readonly org_id: string;
    readonly user_id: string;
    readonly details: Record<string, unknown>;
    readonly message: string;
}

const SENSITIVE_CONFIG_KEYS = ["api_key", "token"] as const;

function maskSensitiveConfig(config: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
        if (SENSITIVE_CONFIG_KEYS.includes(key as (typeof SENSITIVE_CONFIG_KEYS)[number]) && typeof value === "string") {
            masked[key] = value.slice(0, -4).replace(/./g, "*") + value.slice(-4);
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
