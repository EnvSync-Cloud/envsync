import infoLogs, { LogTypes } from "@/libs/logger";
import type { CICDTriggerConfig } from "./index";

/**
 * Trigger a GCP Cloud Build via the Cloud Build API.
 *
 * The url field must contain a JSON-encoded CICDTriggerConfig:
 * {
 *   "endpoint": "https://cloudbuild.googleapis.com/v1/projects/{project}/triggers/{trigger}:run",
 *   "token": "{gcp-access-token}",
 *   "inputs": { "branchName": "main" }
 * }
 */
export const gcpCloudBuildTrigger = async (
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
        infoLogs("Invalid GCP Cloud Build config: url field must be JSON", LogTypes.ERROR, "Webhook:GCPCloudBuild");
        throw new Error("Invalid GCP Cloud Build webhook configuration: url must be JSON-encoded CICDTriggerConfig");
    }

    const branchName = config.inputs?.branchName || config.ref || "main";

    const body = {
        branchName,
        substitutions: {
            _ENVSYNC_EVENT: payload.event_type,
            _ENVSYNC_ORG: payload.org_name,
            _ENVSYNC_APP: payload.app_name || "",
            _ENVSYNC_USER: payload.user_name,
            _ENVSYNC_TIMESTAMP: payload.timestamp,
            ...config.variables,
        },
    };

    const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.token}`,
            ...config.headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        infoLogs(`GCP Cloud Build trigger failed: ${response.status} ${errorText}`, LogTypes.ERROR, "Webhook:GCPCloudBuild");
        throw new Error(`GCP Cloud Build trigger failed with status ${response.status}: ${errorText}`);
    }

    infoLogs(`GCP Cloud Build triggered successfully for ${payload.app_name || payload.org_name}`, LogTypes.LOGS, "Webhook:GCPCloudBuild");
};
