/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateManualSyncRunRequest = {
    app_id?: string | null;
    provider_type: CreateManualSyncRunRequest.provider_type;
    metadata?: Record<string, any>;
};
export namespace CreateManualSyncRunRequest {
    export enum provider_type {
        GITHUB = 'github',
        GITLAB = 'gitlab',
        AWS_SSM = 'aws-ssm',
        VERCEL = 'vercel',
        GOOGLE_SECRET_MANAGER = 'google-secret-manager',
    }
}

