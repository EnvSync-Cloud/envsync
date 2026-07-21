import infoLogs, { LogTypes } from "@/libs/logger";
import type { CICDTriggerConfig } from "./index";

/**
 * Trigger a Travis CI build via the API.
 *
 * The url field must contain a JSON-encoded CICDTriggerConfig:
 * {
 *   "endpoint": "https://api.travis-ci.com/repo/{owner}%2F{repo}/requests",
 *   "token": "{travis-ci-token}",
 *   "ref": "main",
 *   "variables": { "DEPLOY": "true" }
 * }
 */
export const travisCiTrigger = async (
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
        infoLogs("Invalid Travis CI config: url field must be JSON", LogTypes.ERROR, "Webhook:TravisCI");
        throw new Error("Invalid Travis CI webhook configuration: url must be JSON-encoded CICDTriggerConfig");
    }

    const body = {
        request: {
            branch: config.ref || "main",
            config: {
                env: {
                    global: {
                        ENVSYNC_EVENT: payload.event_type,
                        ENVSYNC_ORG: payload.org_name,
                        ENVSYNC_APP: payload.app_name || "",
                        ENVSYNC_USER: payload.user_name,
                        ENVSYNC_TIMESTAMP: payload.timestamp,
                        ...config.variables,
                    },
                },
            },
            message: `EnvSync trigger: ${payload.event_type} by ${payload.user_name}`,
        },
    };

    const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `token ${config.token}`,
            "Travis-API-Version": "3",
            ...config.headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        infoLogs(`Travis CI trigger failed: ${response.status} ${errorText}`, LogTypes.ERROR, "Webhook:TravisCI");
        throw new Error(`Travis CI trigger failed with status ${response.status}: ${errorText}`);
    }

    infoLogs(`Travis CI build triggered successfully for ${payload.app_name || payload.org_name}`, LogTypes.LOGS, "Webhook:TravisCI");
};
