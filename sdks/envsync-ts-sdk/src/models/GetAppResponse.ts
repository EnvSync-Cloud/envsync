/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GetAppResponse = {
    id: string;
    name: string;
    description: string;
    metadata: Record<string, any>;
    enable_secrets: boolean;
    is_managed_secret: boolean;
    public_key?: string;
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
};

