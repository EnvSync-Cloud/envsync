import infoLogs, { LogTypes } from "@/libs/logger";
import type { CICDTriggerConfig } from "./index";

/**
 * Trigger a CircleCI pipeline via the v2 API.
 *
 * The url field must contain a JSON-encoded CICDTriggerConfig:
 * {
 *   "endpoint": "https://circleci.com/api/v2/project/{project-slug}/pipeline",
 *   "token": "{circleci-api-token}",
 *   "ref": "main",
 *   "variables": { "DEPLOY_ENV": "production" }
 * }
 */
export const circleciTrigger = async (
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
): Promise<void> => {
    let config: CICDTriggerConfig;
    try {
        config = JSON.parse(url) as CICDTriggerConfig;
    } catch {
        infoLogs("Invalid CircleCI config: url field must be JSON", LogTypes.ERROR, "Webhook:CircleCI");
        throw new Error("Invalid CircleCI webhook configuration: url must be JSON-encoded CICDTriggerConfig");
    }

    const body = {
        branch: config.ref || "main",
        parameters: {
            ...config.variables,
            envsync_event: payload.event_type,
            envsync_org: payload.org_name,
            envsync_app: payload.app_name || "",
            envsync_user: payload.user_name,
            envsync_timestamp: payload.timestamp,
        },
    };

    const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Circle-Token": config.token,
            ...config.headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        infoLogs(`CircleCI trigger failed: ${response.status} ${errorText}`, LogTypes.ERROR, "Webhook:CircleCI");
        throw new Error(`CircleCI trigger failed with status ${response.status}: ${errorText}`);
    }

    infoLogs(`CircleCI pipeline triggered successfully for ${payload.app_name || payload.org_name}`, LogTypes.LOGS, "Webhook:CircleCI");
};
