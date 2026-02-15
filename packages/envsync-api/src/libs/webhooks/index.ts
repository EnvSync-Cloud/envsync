import { discordWebhook } from "./discord";
import { slackWebhook } from "./slack";
import { customWebhook } from "./custom";

export class WebhookHandler {
    public static async triggerWebhook(
        url: string,
        payload: {
            event_type: AuditActions;
            org_name: string;
            app_name?: string;
            user_name: string;
            data: Record<string, any>;
            timestamp: string;
            webhook_name: string;
            url_for_entity_in_question: string;
            linked_to_entity: "org" | "app";
        },
        webhook_type: "DISCORD" | "SLACK" | "CUSTOM",
    ): Promise<void> {
        switch (webhook_type) {
            case "DISCORD":
                await discordWebhook(url, payload);
                break;
            case "SLACK":
                await slackWebhook(url, payload);
                break;
            case "CUSTOM":
                await customWebhook(url, payload);
                break;
        }
    }
}