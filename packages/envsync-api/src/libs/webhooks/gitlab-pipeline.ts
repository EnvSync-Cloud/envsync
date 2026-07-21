import infoLogs, { LogTypes } from "@/libs/logger";
import type { CICDTriggerConfig } from "./index";

/**
 * Trigger a GitLab pipeline via the trigger token endpoint.
 *
 * The url field must contain a JSON-encoded CICDTriggerConfig:
 * {
 *   "endpoint": "https://gitlab.com/api/v4/projects/{id}/trigger/pipeline",
 *   "token": "glptt-xxx",
 *   "ref": "main",
 *   "variables": { "ENV": "production" }
 * }
 */
export const gitlabPipelineTrigger = async (
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
        infoLogs("Invalid GitLab Pipeline config: url field must be JSON", LogTypes.ERROR, "Webhook:GitLabPipeline");
        throw new Error("Invalid GitLab Pipeline webhook configuration: url must be JSON-encoded CICDTriggerConfig");
    }

    const formData = new URLSearchParams();
    formData.append("token", config.token);
    formData.append("ref", config.ref || "main");

    // Add custom variables
    if (config.variables) {
        for (const [key, value] of Object.entries(config.variables)) {
            formData.append(`variables[${key}]`, value);
        }
    }

    // Add EnvSync metadata as variables
    formData.append("variables[ENVSYNC_EVENT]", payload.event_type);
    formData.append("variables[ENVSYNC_ORG]", payload.org_name);
    formData.append("variables[ENVSYNC_APP]", payload.app_name || "");
    formData.append("variables[ENVSYNC_USER]", payload.user_name);
    formData.append("variables[ENVSYNC_TIMESTAMP]", payload.timestamp);

    const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...config.headers,
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        infoLogs(`GitLab Pipeline trigger failed: ${response.status} ${errorText}`, LogTypes.ERROR, "Webhook:GitLabPipeline");
        throw new Error(`GitLab Pipeline trigger failed with status ${response.status}: ${errorText}`);
    }

    infoLogs(`GitLab Pipeline triggered successfully for ${payload.app_name || payload.org_name}`, LogTypes.LOGS, "Webhook:GitLabPipeline");
};
