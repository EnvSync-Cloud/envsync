import infoLogs, { LogTypes } from "@/libs/logger";

export const customWebhook = (
    url: string,
    payload: {
        event_type: string;
        org_name: string;
        app_name?: string;
        user_name: string;
        data: Record<string, any>;
        webhook_name: string;
        linked_to_entity: string;
        timestamp: string;
        url_for_entity_in_question: string;
    }
) => {
    return fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Webhook failed with status ${response.status}`);
        }
        return response.json();
    })
    .catch(error => {
        infoLogs(`Error triggering custom webhook: ${error}`, LogTypes.ERROR, "Webhook:Custom");
        throw error;
    });
}