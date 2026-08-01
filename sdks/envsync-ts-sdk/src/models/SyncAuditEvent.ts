/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SyncAuditEvent = {
    id: string;
    org_id: string;
    sync_run_id?: string | null;
    app_id?: string | null;
    env_type_id?: string | null;
    provider_type: SyncAuditEvent.provider_type;
    action: string;
    result: SyncAuditEvent.result;
    actor_user_id?: string | null;
    details: Record<string, any>;
    created_at: string;
    updated_at: string;
};
export namespace SyncAuditEvent {
    export enum provider_type {
        GITHUB = 'github',
        GITLAB = 'gitlab',
        AWS_SSM = 'aws-ssm',
        VERCEL = 'vercel',
        GOOGLE_SECRET_MANAGER = 'google-secret-manager',
    }
    export enum result {
        INFO = 'info',
        SUCCESS = 'success',
        ERROR = 'error',
    }
}

