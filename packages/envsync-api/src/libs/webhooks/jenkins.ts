import infoLogs, { LogTypes } from "@/libs/logger";
import type { CICDTriggerConfig } from "./index";

/**
 * Trigger a Jenkins job via the Jenkins API.
 *
 * The url field must contain a JSON-encoded CICDTriggerConfig:
 * {
 *   "endpoint": "https://jenkins.example.com/job/{job-name}/buildWithParameters",
 *   "token": "{jenkins-api-token}",
 *   "inputs": { "username": "admin", "apiToken": "xxx" }
 * }
 *
 * For token-based auth, use "username:apiToken" format.
 * For CSRF protection, the handler fetches a crumb first if needed.
 */
export const jenkinsTrigger = async (
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
        infoLogs("Invalid Jenkins config: url field must be JSON", LogTypes.ERROR, "Webhook:Jenkins");
        throw new Error("Invalid Jenkins webhook configuration: url must be JSON-encoded CICDTriggerConfig");
    }

    const authHeader = `Basic ${Buffer.from(config.token).toString("base64")}`;

    // Try to fetch Jenkins crumb for CSRF protection
    let crumbHeader: Record<string, string> = {};
    try {
        const baseUrl = new URL(config.endpoint).origin;
        const crumbResponse = await fetch(`${baseUrl}/crumbIssuer/api/json`, {
            headers: { "Authorization": authHeader },
            signal: AbortSignal.timeout(5_000),
        });
        if (crumbResponse.ok) {
            const crumbData = await crumbResponse.json() as { crumbRequestField: string; crumb: string };
            crumbHeader[crumbData.crumbRequestField] = crumbData.crumb;
        }
    } catch {
        // Crumb fetch failed — proceed without CSRF token (some Jenkins setups don't require it)
        infoLogs("Could not fetch Jenkins crumb, proceeding without CSRF token", LogTypes.LOGS, "Webhook:Jenkins");
    }

    const formData = new URLSearchParams();
    formData.append("ENVSYNC_EVENT", payload.event_type);
    formData.append("ENVSYNC_ORG", payload.org_name);
    formData.append("ENVSYNC_APP", payload.app_name || "");
    formData.append("ENVSYNC_USER", payload.user_name);
    formData.append("ENVSYNC_TIMESTAMP", payload.timestamp);

    if (config.variables) {
        for (const [key, value] of Object.entries(config.variables)) {
            formData.append(key, value);
        }
    }

    const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": authHeader,
            ...crumbHeader,
            ...config.headers,
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        infoLogs(`Jenkins trigger failed: ${response.status} ${errorText}`, LogTypes.ERROR, "Webhook:Jenkins");
        throw new Error(`Jenkins trigger failed with status ${response.status}: ${errorText}`);
    }

    infoLogs(`Jenkins job triggered successfully for ${payload.app_name || payload.org_name}`, LogTypes.LOGS, "Webhook:Jenkins");
};
