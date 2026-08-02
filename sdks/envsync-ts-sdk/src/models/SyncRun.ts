/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SyncRun = {
    id: string;
    org_id: string;
    app_id?: string | null;
    provider_type: SyncRun.provider_type;
    status: SyncRun.status;
    actor_user_id?: string | null;
    started_at: string;
    completed_at?: string | null;
    error_message?: string | null;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
};
export namespace SyncRun {
    export enum provider_type {
        GITHUB = 'github',
        GITLAB = 'gitlab',
        AWS_SSM = 'aws-ssm',
        VERCEL = 'vercel',
        GOOGLE_SECRET_MANAGER = 'google-secret-manager',
    }
    export enum status {
        PENDING = 'pending',
        RUNNING = 'running',
        SUCCEEDED = 'succeeded',
        FAILED = 'failed',
    }
}

