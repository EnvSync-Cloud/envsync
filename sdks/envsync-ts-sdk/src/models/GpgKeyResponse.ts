/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GpgKeyResponse = {
    id: string;
    org_id: string;
    user_id: string;
    name: string;
    email: string;
    fingerprint: string;
    key_id: string;
    algorithm: string;
    key_size: number | null;
    usage_flags: Array<string>;
    trust_level: string;
    expires_at: string | null;
    revoked_at: string | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
};

