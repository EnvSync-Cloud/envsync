/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateDynamicSecretEngineRequest = {
    name?: string;
    config?: {
        host: string;
        port?: number;
        database: string;
        superuser: {
            username: string;
            password: string;
        };
        creation_statements?: Array<string>;
        default_ttl_seconds?: number;
        max_ttl_seconds?: number;
    };
    enabled?: boolean;
};

