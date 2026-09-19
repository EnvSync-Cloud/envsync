/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ChangeRequestResponse = {
    id: string;
    org_id: string;
    app_id: string;
    request_kind: ChangeRequestResponse.request_kind;
    source_env_type_id: string | null;
    target_env_type_id: string;
    status: ChangeRequestResponse.status;
    title: string;
    message: string;
    requested_by_user_id: string;
    reviewed_by_user_id: string | null;
    reviewed_at: string | null;
    applied_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
    env_item_count: number;
    secret_item_count: number;
    env_items: Array<{
        id: string;
        change_request_id: string;
        key: string;
        previous_value: string | null;
        proposed_value: string | null;
        operation: 'CREATE' | 'UPDATE' | 'DELETE';
        created_at: string;
        updated_at: string;
    }>;
    secret_items: Array<{
        id: string;
        change_request_id: string;
        key: string;
        previous_value: string | null;
        proposed_value: string | null;
        operation: 'CREATE' | 'UPDATE' | 'DELETE';
        created_at: string;
        updated_at: string;
    }>;
};
export namespace ChangeRequestResponse {
    export enum request_kind {
        DIRECT = 'direct',
        PROMOTION = 'promotion',
    }
    export enum status {
        PENDING = 'pending',
        APPLYING = 'applying',
        APPROVED = 'approved',
        REJECTED = 'rejected',
        CANCELLED = 'cancelled',
        FAILED = 'failed',
    }
}

