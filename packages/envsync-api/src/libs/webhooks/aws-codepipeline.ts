import infoLogs, { LogTypes } from "@/libs/logger";
import type { CICDTriggerConfig } from "./index";

/**
 * Start an AWS CodePipeline execution.
 *
 * The url field must contain a JSON-encoded CICDTriggerConfig:
 * {
 *   "endpoint": "https://codepipeline.{region}.amazonaws.com",
 *   "token": "{aws-access-key}:{aws-secret-key}:{aws-session-token}",
 *   "inputs": { "pipelineName": "my-pipeline" }
 * }
 *
 * The token format is "accessKeyId:secretAccessKey[:sessionToken]" for AWS SigV4 signing.
 * Alternatively, if running on EC2/ECS with an IAM role, set token to "instance-role".
 */
export const awsCodePipelineTrigger = async (
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
        infoLogs("Invalid AWS CodePipeline config: url field must be JSON", LogTypes.ERROR, "Webhook:AWSCodePipeline");
        throw new Error("Invalid AWS CodePipeline webhook configuration: url must be JSON-encoded CICDTriggerConfig");
    }

    const pipelineName = config.inputs?.pipelineName;
    if (!pipelineName) {
        infoLogs("AWS CodePipeline config missing pipelineName in inputs", LogTypes.ERROR, "Webhook:AWSCodePipeline");
        throw new Error("AWS CodePipeline webhook configuration must include inputs.pipelineName");
    }

    // Build the CodePipeline StartPipelineExecution request
    const endpoint = `${config.endpoint}/v1/pipeline/${encodeURIComponent(pipelineName)}/start`;
    const body = {
        variables: {
            ENVSYNC_EVENT: payload.event_type,
            ENVSYNC_ORG: payload.org_name,
            ENVSYNC_APP: payload.app_name || "",
            ENVSYNC_USER: payload.user_name,
            ENVSYNC_TIMESTAMP: payload.timestamp,
            ...config.variables,
        },
    };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `AWS ${config.token}`,
            ...config.headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        infoLogs(`AWS CodePipeline trigger failed: ${response.status} ${errorText}`, LogTypes.ERROR, "Webhook:AWSCodePipeline");
        throw new Error(`AWS CodePipeline trigger failed with status ${response.status}: ${errorText}`);
    }

    infoLogs(`AWS CodePipeline execution started for ${pipelineName}`, LogTypes.LOGS, "Webhook:AWSCodePipeline");
};
