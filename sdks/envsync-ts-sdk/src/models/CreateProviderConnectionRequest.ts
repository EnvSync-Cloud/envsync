/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateProviderConnectionRequest = {
    provider_type: CreateProviderConnectionRequest.provider_type;
    name: string;
    status?: CreateProviderConnectionRequest.status;
    auth_config?: Record<string, any>;
    metadata?: Record<string, any>;
};
export namespace CreateProviderConnectionRequest {
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

