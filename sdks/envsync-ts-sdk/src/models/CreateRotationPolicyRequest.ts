/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateRotationPolicyRequest = {
    app_id: string;
    env_type_id: string;
    variable_key: string;
    engine_type: CreateRotationPolicyRequest.engine_type;
    schedule_cron: string;
    dual_window_minutes?: number;
    enabled?: boolean;
    connection_config: Record<string, any>;
};
export namespace CreateRotationPolicyRequest {
    export enum engine_type {
        POSTGRES = 'postgres',
        MYSQL = 'mysql',
        AWS_IAM = 'aws-iam',
        AZURE_SP = 'azure-sp',
        GCP_SERVICE_ACCOUNT = 'gcp-service-account',
        CLOUDFLARE_PAGES = 'cloudflare-pages',
        SENDGRID = 'sendgrid',
        TWILIO = 'twilio',
    }
}

