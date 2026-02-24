import { type Context } from "hono";

import { WebhookService } from "@/services/webhook.service";
import { AuditLogService } from "@/services/audit_log.service";
import { encapsulate } from "@/utils/encapsulate";

export class WebhookController {
    public static readonly createWebhook = async (c: Context) => {
        const org_id = c.get("org_id");
        const user_id = c.get("user_id");

        const { name, event_types, linked_to = "org" , url, webhook_type, app_id } = await c.req.json();

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
    };

    public static readonly getWebhook = async (c: Context) => {
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
    };

    public static readonly getWebhooks = async (c: Context) => {
        const org_id = c.get("org_id");

        const page = Math.max(1, Number(c.req.query("page")) || 1);
        const per_page = Math.min(100, Math.max(1, Number(c.req.query("per_page")) || 50));

        let webhooks = await WebhookService.getWebhookByOrgId(org_id, page, per_page);

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
    };

    public static readonly updateWebhook = async (c: Context) => {
        const org_id = c.get("org_id");

        const id = c.req.param("id");

        const { app_id,
            event_types,
            is_active,
            linked_to,
            url,
            webhook_type } = await c.req.json();

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
    };

    public static readonly deleteWebhook = async (c: Context) => {
        const org_id = c.get("org_id");

        const id = c.req.param("id");

        const webhook = await WebhookService.getWebhookById(id);

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
    };
}
