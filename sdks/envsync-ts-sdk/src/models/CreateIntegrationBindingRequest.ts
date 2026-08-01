/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateIntegrationBindingRequest = {
    provider_connection_id: string;
    provider_type: CreateIntegrationBindingRequest.provider_type;
    is_enabled?: boolean;
    metadata?: Record<string, any>;
};
export namespace CreateIntegrationBindingRequest {
    export enum provider_type {
        GITHUB = 'github',
        GITLAB = 'gitlab',
        AWS_SSM = 'aws-ssm',
        VERCEL = 'vercel',
        GOOGLE_SECRET_MANAGER = 'google-secret-manager',
    }
}

