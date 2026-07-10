import { discordWebhook } from "./discord";
import { slackWebhook } from "./slack";
import { customWebhook } from "./custom";
import { githubActionsTrigger } from "./github-actions";
import { gitlabPipelineTrigger } from "./gitlab-pipeline";
import { awsCodePipelineTrigger } from "./aws-codepipeline";
import { gcpCloudBuildTrigger } from "./gcp-cloud-build";
import { circleciTrigger } from "./circleci";
import { travisCiTrigger } from "./travis-ci";
import { jenkinsTrigger } from "./jenkins";

export type CICDWebhookType =
    | "GITHUB_ACTIONS" | "GITLAB_PIPELINE" | "AWS_CODEPIPELINE"
    | "GCP_CLOUD_BUILD" | "CIRCLECI" | "TRAVIS_CI" | "JENKINS";

export type AllWebhookType = "DISCORD" | "SLACK" | "CUSTOM" | CICDWebhookType;

export interface CICDTriggerConfig {
    endpoint: string;
    token: string;
    ref?: string;
    inputs?: Record<string, string>;
    variables?: Record<string, string>;
    headers?: Record<string, string>;
}

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
        webhook_type: AllWebhookType,
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
            case "GITHUB_ACTIONS":
                await githubActionsTrigger(url, payload);
                break;
            case "GITLAB_PIPELINE":
                await gitlabPipelineTrigger(url, payload);
                break;
            case "AWS_CODEPIPELINE":
                await awsCodePipelineTrigger(url, payload);
                break;
            case "GCP_CLOUD_BUILD":
                await gcpCloudBuildTrigger(url, payload);
                break;
            case "CIRCLECI":
                await circleciTrigger(url, payload);
                break;
            case "TRAVIS_CI":
                await travisCiTrigger(url, payload);
                break;
            case "JENKINS":
                await jenkinsTrigger(url, payload);
                break;
        }
    }
}