import z from "zod";
import "zod-openapi/extend";

export const createWebhookRequestSchema = z
    .object({
        name: z.string().openapi({ example: "My Webhook" }),
        url: z.string().url().openapi({ example: "https://hooks.example.com/webhook" }),
        event_types: z.array(z.string()).openapi({ example: ["env_created", "env_updated"] }),
        webhook_type: z.enum(["DISCORD", "SLACK", "CUSTOM"]).openapi({ example: "CUSTOM" }),
        linked_to: z.enum(["org", "app"]).default("org").openapi({ example: "org" }),
        app_id: z.string().optional().nullable().openapi({ example: "app_123" }),
    })
    .openapi({ ref: "CreateWebhookRequest" });

export const webhookResponseSchema = z
    .object({
        id: z.string().openapi({ example: "webhook_123" }),
        name: z.string().openapi({ example: "My Webhook" }),
        org_id: z.string().openapi({ example: "org_123" }),
        user_id: z.string().openapi({ example: "user_123" }),
        url: z.string().openapi({ example: "https://hooks.example.com/webhook" }),
        event_types: z.array(z.string()).openapi({ example: ["env_created", "env_updated"] }),
        is_active: z.boolean().openapi({ example: true }),
        webhook_type: z.enum(["DISCORD", "SLACK", "CUSTOM"]).openapi({ example: "CUSTOM" }),
        app_id: z.string().nullable().openapi({ example: "app_123" }),
        linked_to: z.enum(["org", "app"]).openapi({ example: "org" }),
        created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
        updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
        last_triggered_at: z.string().nullable().openapi({ example: "2023-01-01T00:00:00Z" }),
    })
    .openapi({ ref: "WebhookResponse" });

export const webhooksResponseSchema = z
    .array(webhookResponseSchema)
    .openapi({ ref: "WebhooksResponse" });

export const updateWebhookRequestSchema = z
    .object({
        name: z.string().optional().openapi({ example: "Updated Webhook" }),
        url: z.string().url().optional().openapi({ example: "https://hooks.example.com/webhook" }),
        event_types: z.array(z.string()).optional().openapi({ example: ["env_created"] }),
        is_active: z.boolean().optional().openapi({ example: false }),
        webhook_type: z.enum(["DISCORD", "SLACK", "CUSTOM"]).optional().openapi({ example: "CUSTOM" }),
        app_id: z.string().optional().openapi({ example: "app_123" }),
        linked_to: z.enum(["org", "app"]).optional().openapi({ example: "org" }),
    })
    .openapi({ ref: "UpdateWebhookRequest" });