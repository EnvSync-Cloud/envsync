import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { STDBClient } from "@/libs/stdb";
import { NotFoundError } from "@/libs/errors";
import { WebhookHandler } from "@/libs/webhooks";
import { config } from "@/utils/env";
import infoLogs, { LogTypes } from "@/libs/logger";

const urlSetMap = {
    apps: config.DASHBOARD_URL + "/applications",
    org: config.DASHBOARD_URL + "/organisation",
    users: config.DASHBOARD_URL + "/users",
    roles: config.DASHBOARD_URL + "/roles",
    audit: config.DASHBOARD_URL + "/audit",
    env: (appId: string) => `${config.DASHBOARD_URL}/applications/${appId}`,
    secret: (appId: string) => `${config.DASHBOARD_URL}/applications/${appId}/secrets`,
    env_manage: (appId: string) => `${config.DASHBOARD_URL}/applications/${appId}/manage-environments`,
    api_keys: config.DASHBOARD_URL + "/apikeys",
    base: config.DASHBOARD_URL,
};

interface WebhookRow {
    uuid: string;
    name: string;
    org_id: string;
    user_id: string;
    url: string;
    event_types: string;
    is_active: boolean;
    webhook_type: "DISCORD" | "SLACK" | "CUSTOM";
    app_id: string | null;
    linked_to: "org" | "app";
    last_triggered_at: string | null;
    created_at: string;
    updated_at: string;
}

function mapWebhookRow(row: WebhookRow) {
    return {
        id: row.uuid,
        name: row.name,
        org_id: row.org_id,
        user_id: row.user_id,
        url: row.url,
        event_types: typeof row.event_types === "string" ? JSON.parse(row.event_types) : row.event_types,
        is_active: row.is_active,
        webhook_type: row.webhook_type,
        app_id: row.app_id,
        linked_to: row.linked_to,
        last_triggered_at: row.last_triggered_at ? new Date(row.last_triggered_at) : null,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
    };
}

export class WebhookService {
    public static createWebhook = async ({
        event_types,
        linked_to = "org",
        name,
        org_id,
        user_id,
        url,
        webhook_type,
        app_id
    }: {
        name: string,
        org_id: string,
        user_id: string,
        url: string,
        event_types: AuditActions[],
        webhook_type: "DISCORD" | "SLACK" | "CUSTOM",
        app_id?: string,
        linked_to: "org" | "app"
    }): Promise<string> => {
        const id = crypto.randomUUID();
        const stdb = STDBClient.getInstance();

        await stdb.callReducer("create_webhook", [
            id,
            name,
            org_id,
            user_id,
            url,
            JSON.stringify(event_types),
            webhook_type,
            app_id ?? null,
            linked_to,
        ]);

        return id;
    }

    // Perf note (#58): cacheAside is intentionally NOT used here because
    // the endpoint is paginated (page/per_page). Caching paginated list
    // responses would require a cache key per (org_id, page, per_page)
    // combination, and invalidation of *all* page variants on mutation,
    // which adds complexity without clear benefit for a low-traffic list.
    // The single-webhook read (getWebhookById) is already cached.
    public static getWebhookByOrgId = async (org_id: string, page = 1, per_page = 50) => {
        const stdb = STDBClient.getInstance();
        const offset = (page - 1) * per_page;

        const rows = await stdb.query<WebhookRow>(
            `SELECT * FROM webhook WHERE org_id = '${org_id}' LIMIT ${per_page} OFFSET ${offset}`,
        );

        return rows.map(mapWebhookRow);
    };

    public static getWebhookByAppId = async (app_id: string) => {
        const stdb = STDBClient.getInstance();

        const rows = await stdb.query<WebhookRow>(
            `SELECT * FROM webhook WHERE app_id = '${app_id}'`,
        );

        return rows.map(mapWebhookRow);
    };

    public static getWebhooksByUserId = async (user_id: string) => {
        const stdb = STDBClient.getInstance();

        const rows = await stdb.query<WebhookRow>(
            `SELECT * FROM webhook WHERE user_id = '${user_id}'`,
        );

        return rows.map(mapWebhookRow);
    }

    public static getWebhookById = async (id: string) => {
        return cacheAside(CacheKeys.webhook(id), CacheTTL.SHORT, async () => {
            const stdb = STDBClient.getInstance();

            const row = await stdb.queryOne<WebhookRow>(
                `SELECT * FROM webhook WHERE uuid = '${id}'`,
            );

            if (!row) throw new NotFoundError("Webhook", id);

            return mapWebhookRow(row);
        });
    };

    public static updateWebhook = async (
        id: string,
        data: {
            url?: string;
            event_types?: AuditActions[];
            is_active?: boolean;
            webhook_type?: "DISCORD" | "SLACK" | "CUSTOM";
            app_id?: string | null;
            linked_to?: "org" | "app";
        }
    ): Promise<void> => {
        const stdb = STDBClient.getInstance();

        await stdb.callReducer("update_webhook", [
            id,
            data.url ?? null,
            data.event_types ? JSON.stringify(data.event_types) : null,
            data.is_active ?? null,
            data.webhook_type ?? null,
            data.app_id !== undefined ? data.app_id : null,
            data.linked_to ?? null,
        ]);

        // Note: webhooksByOrg list is not cached (paginated endpoint), so only invalidate the single-item cache.
        await invalidateCache(CacheKeys.webhook(id));
    };

    public static deleteWebhook = async (id: string): Promise<void> => {
        const stdb = STDBClient.getInstance();

        await stdb.callReducer("delete_webhook", [id]);

        // Note: webhooksByOrg list is not cached (paginated endpoint), so only invalidate the single-item cache.
        await invalidateCache(CacheKeys.webhook(id));
    };

    public static triggerWebhook = async (
        payload: {
            event_type: AuditActions;
            org_id: string;
            app_id?: string;
            user_id: string;
            message: string;
        }
    ): Promise<void> => {
        const stdb = STDBClient.getInstance();

        // Fetch all active webhooks for the org, then filter by event_type in TypeScript
        // (STDB doesn't support JSON @> containment operator)
        const allWebhooks = await stdb.query<WebhookRow>(
            `SELECT * FROM webhook WHERE org_id = '${payload.org_id}' AND is_active = true`,
        );

        const webhooks = allWebhooks
            .map(mapWebhookRow)
            .filter((w) => {
                const eventTypes: string[] = Array.isArray(w.event_types) ? w.event_types : [];
                return eventTypes.includes(payload.event_type);
            });

        if (webhooks.length === 0) {
            return;
        }
        else {
            infoLogs(
                `Triggering webhooks for event: ${payload.event_type}, org_id: ${payload.org_id}, app_id: ${payload.app_id}, user_id: ${payload.user_id}`,
                LogTypes.LOGS,
                "triggerWebhook"
            )

            // Hoist org/app/user lookups outside the per-webhook loop to avoid N+1 queries
            const orgRow = await stdb.queryOne<{ name: string }>(
                `SELECT name FROM org WHERE uuid = '${payload.org_id}'`,
            );
            const org = orgRow ?? { name: "" };

            const app = payload.app_id
                ? await stdb.queryOne<{ name: string; uuid: string }>(
                    `SELECT name, uuid FROM app WHERE uuid = '${payload.app_id}'`,
                )
                : null;

            const userRow = await stdb.queryOne<{ full_name: string; email: string }>(
                `SELECT full_name, email FROM user WHERE uuid = '${payload.user_id}'`,
            );
            const user = userRow ?? { full_name: "", email: "" };

            await Promise.all(webhooks.map(async (webhook) => {
                let url_for_entity_in_question = "";

                switch (payload.event_type) {
                    case "roles_viewed":
                    case "role_viewed":
                    case "role_created":
                    case "role_updated":
                    case "role_deleted":
                        url_for_entity_in_question = urlSetMap.roles;
                        break;
                    case "app_created":
                    case "app_updated":
                    case "app_viewed":
                    case "apps_viewed":
                    case "app_deleted":
                        url_for_entity_in_question = urlSetMap.apps;
                        break;
                    case "org_created":
                    case "org_updated":
                        url_for_entity_in_question = urlSetMap.org;
                        break;
                    case "user_deleted":
                    case "user_invite_accepted":
                    case "user_invite_created":
                    case "user_invite_deleted":
                    case "user_invite_updated":
                    case "user_invite_viewed":
                    case "user_retrieved":
                    case "users_retrieved":
                    case "user_role_updated":
                    case "user_updated":
                        url_for_entity_in_question = urlSetMap.users;
                        break;
                    case "env_created":
                    case "env_updated":
                    case "env_deleted":
                    case "env_viewed":
                    case "envs_viewed":
                    case "envs_batch_updated":
                    case "envs_batch_created":
                    case "envs_batch_deleted":
                    case "envs_rollback_pit":
                    case "envs_rollback_timestamp":
                    case "env_variable_rollback_pit":
                    case "env_variable_rollback_timestamp":
                        url_for_entity_in_question = urlSetMap.env(payload.app_id!);
                        break;
                    case "get_audit_logs":
                        url_for_entity_in_question = urlSetMap.audit;
                        break;
                    case "secret_created":
                    case "secret_updated":
                    case "secret_deleted":
                    case "secret_viewed":
                    case "secrets_viewed":
                    case "secrets_batch_updated":
                    case "secrets_batch_created":
                    case "secrets_batch_deleted":
                    case "secrets_rollback_pit":
                    case "secrets_rollback_timestamp":
                    case "secret_variable_rollback_pit":
                    case "secret_variable_rollback_timestamp":
                        url_for_entity_in_question = urlSetMap.secret(payload.app_id!);
                        break;
                    case "env_type_viewed":
                    case "env_types_viewed":
                    case "env_type_created":
                    case "env_type_updated":
                    case "env_type_deleted":
                        url_for_entity_in_question = urlSetMap.env_manage(payload.app_id!);
                        break;
                    case "apikey_created":
                    case "apikey_updated":
                    case "apikey_deleted":
                    case "apikey_viewed":
                    case "apikeys_viewed":
                    case "apikey_regenerated":
                        url_for_entity_in_question = urlSetMap.api_keys;
                        break;
                    default:
                        url_for_entity_in_question = urlSetMap.base;
                        break;
                }

                if(webhook.linked_to === "app" && app?.uuid === webhook.app_id) {
                    await WebhookHandler.triggerWebhook(
                        webhook.url,
                        {
                            event_type: payload.event_type,
                            org_name: org.name,
                            app_name: app?.name || "",
                            user_name: user.full_name || user.email,
                            webhook_name: webhook.name,
                            linked_to_entity: webhook.linked_to,
                            timestamp: new Date().toISOString(),
                            url_for_entity_in_question: url_for_entity_in_question,
                            data: payload,
                        },
                        webhook.webhook_type
                    )
                }
                else if (webhook.linked_to === "org") {
                    await WebhookHandler.triggerWebhook(
                        webhook.url,
                        {
                            event_type: payload.event_type,
                            org_name: org.name,
                            app_name: app?.name ?? "",
                            user_name: user.full_name || user.email,
                            webhook_name: webhook.name,
                            linked_to_entity: webhook.linked_to,
                            timestamp: new Date().toISOString(),
                            url_for_entity_in_question: url_for_entity_in_question,
                            data: payload,
                        },
                        webhook.webhook_type
                    )
                }

                await stdb.callReducer("update_webhook_last_triggered", [webhook.id]);
            }));
        }
    };
}
