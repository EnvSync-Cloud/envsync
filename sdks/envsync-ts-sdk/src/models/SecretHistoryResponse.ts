/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SecretHistoryResponse = {
    pits: Array<{
        id: string;
        org_id: string;
        app_id: string;
        env_type_id: string;
        change_request_message: string;
        user_id: string;
        created_at: string;
        updated_at: string;
    }>;
    totalPages: number;
};

