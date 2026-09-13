/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OrgKmsJobResponse = {
    id: string;
    org_id: string;
    app_id: string | null;
    kind: OrgKmsJobResponse.kind;
    status: OrgKmsJobResponse.status;
    progress: Record<string, any>;
    error_message: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
};
export namespace OrgKmsJobResponse {
    export enum kind {
        KEK_REWRAP = 'kek_rewrap',
        DEK_REWRAP = 'dek_rewrap',
        DETACH_MANAGED = 'detach_managed',
    }
    export enum status {
        PENDING = 'pending',
        RUNNING = 'running',
        SUCCEEDED = 'succeeded',
        FAILED = 'failed',
    }
}

