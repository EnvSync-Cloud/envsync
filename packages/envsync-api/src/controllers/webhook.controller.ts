import { type Context } from "hono";

import { WebhookService } from "@/services/webhook.service";
import { AuditLogService } from "@/services/audit_log.service";
import { encapsulate } from "@/utils/encapsulate";

export class WebhookController {
    public static readonly createWebhook = async (c: Context) => {
        try {
            const org_id = c.get("org_id");
            const user_id = c.get("user_id");

            let { name, event_types, linked_to = "org" , url, webhook_type, app_id } = await c.req.json();

            const permissions = c.get("permissions");

            // Webhooks can only be created by admins or masters in the organization
            if (!(permissions.is_admin || permissions.is_master) || !permissions.have_webhook_access) {
                return c.json({ error: "You do not have permission to create webhooks." }, 403);
            }

            if (!name || !url || !webhook_type) {
                return c.json({ error: "Name, URL, and Webhook Type are required." }, 400);
            }

            if (!event_types || event_types.length === 0) {
                return c.json({ error: "At least one event type is required." }, 400);
            }

            if (linked_to == "app" && !app_id) {
                return c.json({ error: "App ID is required." }, 400);
            }

            const app = await WebhookService.createWebhook({
                name,
                org_id,
                event_types,
                linked_to,
                url,
                user_id,
                webhook_type,
                app_id
            });

            // Log the creation of the webhook
            await AuditLogService.notifyAuditSystem({
                action: "webhook_created",
                org_id,
                user_id: c.get("user_id"),
                details: {
                    event_types,
                    linked_to,
                    url,
                    webhook_type,
                    app_id
                },
                message: `Webhook ${name} created.`,
            });

            return c.json(app, 201);
        } catch (err) {
            if (err instanceof Error) {
                return c.json({ error: err.message }, 500);
            }
        }
    };

    public static readonly getWebhook = async (c: Context) => {
        try {
            const org_id = c.get("org_id");

            const id = c.req.param("id");

            const webhook = await WebhookService.getWebhookById(id);

            if (webhook.org_id !== org_id) {
                return c.json({ error: "Webhook does not belong to your organization" }, 403);
            }

            await AuditLogService.notifyAuditSystem({
                action: "webhook_viewed",
                org_id,
                user_id: c.get("user_id"),
                message: `Webhook ${webhook.name} viewed.`,
                details: {
                    webhook_id: webhook.id,
                    name: webhook.name,
                },
            });

            return c.json(webhook);
        } catch (err) {
            if (err instanceof Error) {
                return c.json({ error: err.message }, 500);
            }
        }
    };

    public static readonly getWebhooks = async (c: Context) => {
        try {
            const org_id = c.get("org_id");

            let webhooks = await WebhookService.getWebhookByOrgId(org_id);

            if (!webhooks || webhooks.length === 0) {
                return c.json([], 200);
            }

            await AuditLogService.notifyAuditSystem({
                action: "webhooks_viewed",
                org_id,
                user_id: c.get("user_id"),
                message: `Webhooks viewed`,
                details: {
                    webhook_count: webhooks.length,
                },
            });

            webhooks = webhooks.map((webhook) => {
                return {
                    ...webhook,
                    url: encapsulate(webhook.url),
                };
            });

            return c.json(webhooks);
        } catch (err) {
            if (err instanceof Error) {
                return c.json({ error: err.message }, 500);
            }
        }
    };

    public static readonly updateWebhook = async (c: Context) => {
        try {
            const org_id = c.get("org_id");

            const id = c.req.param("id");

            const { app_id,
                event_types,
                is_active,
                linked_to,
                url,
                webhook_type } = await c.req.json();

            const permissions = c.get("permissions");

            // Webhooks can only be updated by admins or masters
            if (!permissions.is_admin || !permissions.is_master || !permissions.have_webhook_access) {
                return c.json({ error: "You do not have permission to update webhooks." }, 403);
            }

            const webhook = await WebhookService.getWebhookById(id);

            if (webhook.org_id !== org_id) {
                return c.json({ error: "Webhook does not belong to your organization" }, 403);
            }

            await WebhookService.updateWebhook(id, {
                app_id,
                event_types,
                is_active,
                linked_to,
                url,
                webhook_type
            });

            // Log the update of the webhook
            await AuditLogService.notifyAuditSystem({
                action: "webhook_updated",
                org_id,
                user_id: c.get("user_id"),
                message: `Webhook ${webhook.name} updated.`,
                details: {
                    webhook_id: webhook.id,
                    name: webhook.name,
                },
            });

            return c.json({ message: "Webhook updated successfully" });
        } catch (err) {
            if (err instanceof Error) {
                return c.json({ error: err.message }, 500);
            }
        }
    };

    public static readonly deleteWebhook = async (c: Context) => {
        try {
            const org_id = c.get("org_id");

            const id = c.req.param("id");

            const webhook = await WebhookService.getWebhookById(id);

            const permissions = c.get("permissions");

            // Webhooks can only be delete by admins or masters in the organization
            if (!permissions.is_admin || !permissions.is_master || !permissions.have_webhook_access) {
                return c.json({ error: "You do not have permission to delete webhooks." }, 403);
            }

            if (webhook.org_id !== org_id) {
                return c.json({ error: "Webhook does not belong to your organization" }, 403);
            }

            await WebhookService.deleteWebhook(id);

            // Log the deletion of the webhook
            await AuditLogService.notifyAuditSystem({
                action: "webhook_deleted",
                org_id,
                user_id: c.get("user_id"),
                message: `Webhook ${webhook.name} deleted.`,
                details: {
                    webhook_id: webhook.id,
                    name: webhook.name,
                },
            });

            return c.json({ message: "Webhook deleted successfully" });
        } catch (err) {
            if (err instanceof Error) {
                return c.json({ error: err.message }, 500);
            }
        }
    };
}
