/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ProviderConnection = {
    id: string;
    org_id: string;
    provider_type: ProviderConnection.provider_type;
    name: string;
    status: ProviderConnection.status;
    auth_config: Record<string, any>;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
};
export namespace ProviderConnection {
    export enum provider_type {
        GITHUB = 'github',
        GITLAB = 'gitlab',
        AWS_SSM = 'aws-ssm',
        VERCEL = 'vercel',
        GOOGLE_SECRET_MANAGER = 'google-secret-manager',
    }
    export enum status {
        ACTIVE = 'active',
        INACTIVE = 'inactive',
        ERROR = 'error',
    }
}

