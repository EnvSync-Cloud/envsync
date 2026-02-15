import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";
import { WebhookHandler } from "@/libs/webhooks";
import { config } from "@/utils/env";
import { JsonValue } from "@/libs/db";
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
        const id = uuidv4();
        const db = await DB.getInstance();

        await db
            .insertInto("webhook_store")
            .values({
                id,
                name,
                org_id,
                user_id,
                url,
                event_types: new JsonValue(event_types),
                is_active: true,
                webhook_type,
                app_id,
                linked_to,
                created_at: new Date(),
                updated_at: new Date(),
            })
            .execute();

        return id;
    }

    public static getWebhookByOrgId = async (org_id: string) => {
        const db = await DB.getInstance();

        const webhooks = await db
            .selectFrom("webhook_store")
            .selectAll()
            .where("org_id", "=", org_id)
            .execute();

        return webhooks;
    };

    public static getWebhookByAppId = async (app_id: string) => {
        const db = await DB.getInstance();

        const webhooks = await db
            .selectFrom("webhook_store")
            .selectAll()
            .where("app_id", "=", app_id)
            .execute();

        return webhooks;
    };

    public static getWebhooksByUserId = async (user_id: string) => {
        const db = await DB.getInstance();

        const webhooks = await db
            .selectFrom("webhook_store")
            .selectAll()
            .where("user_id", "=", user_id)
            .execute();

        return webhooks;
    }

    public static getWebhookById = async (id: string) => {
        const db = await DB.getInstance();

        const webhook = await db
            .selectFrom("webhook_store")
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirstOrThrow();

        return webhook;
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
        const db = await DB.getInstance();

        await db
            .updateTable("webhook_store")
            .set({
                ...data,
                updated_at: new Date(),
            })
            .where("id", "=", id)
            .execute();
    };

    public static deleteWebhook = async (id: string): Promise<void> => {
        const db = await DB.getInstance();

        await db.deleteFrom("webhook_store")
            .where("id", "=", id)
            .execute();
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
        const db = await DB.getInstance();

        const webhooks = await db
            .selectFrom("webhook_store")
            .selectAll()
            .where("org_id", "=", payload.org_id)
            .where("is_active", "=", true)
            .where("event_types", "@>", new JsonValue([payload.event_type]))
            .execute();

        if (webhooks.length === 0) {
            return;
        }
        else {
            infoLogs(
                `Triggering webhooks for event: ${payload.event_type}, org_id: ${payload.org_id}, app_id: ${payload.app_id}, user_id: ${payload.user_id}`,
                LogTypes.LOGS,
                "triggerWebhook"
            )

            await Promise.all(webhooks.map(async (webhook) => {
                const org = await db
                    .selectFrom("orgs")
                    .select(["name"])
                    .where("id", "=", payload.org_id)
                    .executeTakeFirstOrThrow();

                const app = payload.app_id
                    ? await db
                        .selectFrom("app")
                        .select(["name", "id"])
                        .where("id", "=", payload.app_id)
                        .executeTakeFirst()
                    : null;

                const user = await db
                    .selectFrom("users")
                    .select(["full_name", "email"])
                    .where("id", "=", payload.user_id)
                    .executeTakeFirstOrThrow();

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

                if(webhook.linked_to === "app" && app?.id === webhook.app_id) {
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
                
                await db
                    .updateTable("webhook_store")
                    .set({
                        last_triggered_at: new Date(),
                    })
                    .where("id", "=", webhook.id)
                    .execute();
            }));
        }
    };
}