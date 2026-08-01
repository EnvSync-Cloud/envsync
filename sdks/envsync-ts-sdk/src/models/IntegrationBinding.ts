/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type IntegrationBinding = {
    id: string;
    org_id: string;
    app_id: string;
    provider_connection_id: string;
    provider_type: IntegrationBinding.provider_type;
    is_enabled: boolean;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
};
export namespace IntegrationBinding {
    export enum provider_type {
        GITHUB = 'github',
        GITLAB = 'gitlab',
        AWS_SSM = 'aws-ssm',
        VERCEL = 'vercel',
        GOOGLE_SECRET_MANAGER = 'google-secret-manager',
    }
}

