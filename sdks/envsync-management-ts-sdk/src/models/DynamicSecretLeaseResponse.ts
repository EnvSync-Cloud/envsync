/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type DynamicSecretLeaseResponse = {
    id: string;
    engine_id: string;
    app_id: string;
    env_type_id: string;
    variable_key: string;
    credential_data: Record<string, any>;
    expires_at: string;
    revoked_at: string | null;
    created_at: string;
    updated_at: string;
};

