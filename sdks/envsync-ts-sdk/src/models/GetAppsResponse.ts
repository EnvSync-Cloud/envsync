/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GetAppsResponse = Array<{
    id: string;
    name: string;
    description: string;
    enable_secrets: boolean;
    is_managed_secret: boolean;
    public_key?: string;
    metadata: Record<string, any>;
    org_id: string;
    envCount: number;
    secretCount: number;
    env_types: Array<{
        id: string;
        name: string;
        is_default: boolean;
        is_protected: boolean;
        color: string;
    }>;
    created_at: string;
    updated_at: string;
}>;
