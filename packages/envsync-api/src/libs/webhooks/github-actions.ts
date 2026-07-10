import infoLogs, { LogTypes } from "@/libs/logger";
import type { CICDTriggerConfig } from "./index";

/**
 * Trigger a GitHub Actions workflow dispatch event.
 *
 * The url field must contain a JSON-encoded CICDTriggerConfig:
 * {
 *   "endpoint": "https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow}/dispatches",
 *   "token": "ghp_xxx",
 *   "ref": "main",
 *   "inputs": { "environment": "production" }
 * }
 */
export const githubActionsTrigger = async (
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
        infoLogs("Invalid GitHub Actions config: url field must be JSON", LogTypes.ERROR, "Webhook:GitHubActions");
        throw new Error("Invalid GitHub Actions webhook configuration: url must be JSON-encoded CICDTriggerConfig");
    }

    const body = {
        ref: config.ref || "main",
        inputs: {
            ...config.inputs,
            envsync_event: payload.event_type,
            envsync_org: payload.org_name,
            envsync_app: payload.app_name || "",
            envsync_user: payload.user_name,
            envsync_timestamp: payload.timestamp,
            envsync_message: JSON.stringify(payload.data),
        },
    };

    const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${config.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...config.headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        infoLogs(`GitHub Actions trigger failed: ${response.status} ${errorText}`, LogTypes.ERROR, "Webhook:GitHubActions");
        throw new Error(`GitHub Actions trigger failed with status ${response.status}: ${errorText}`);
    }

    infoLogs(`GitHub Actions workflow triggered successfully for ${payload.app_name || payload.org_name}`, LogTypes.LOGS, "Webhook:GitHubActions");
};
