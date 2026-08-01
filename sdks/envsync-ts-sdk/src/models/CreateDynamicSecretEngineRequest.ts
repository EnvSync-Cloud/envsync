/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateDynamicSecretEngineRequest = {
    engine_type: CreateDynamicSecretEngineRequest.engine_type;
    name: string;
    config: ({
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
    } | {
        access_key_id: string;
        secret_access_key: string;
        region?: string;
        iam_policy: string;
        default_ttl_seconds?: number;
        max_ttl_seconds?: number;
    } | {
        tenant_id: string;
        client_id: string;
        client_secret: string;
        subscription_id: string;
        roles?: Array<string>;
        default_ttl_seconds?: number;
        max_ttl_seconds?: number;
    });
    enabled?: boolean;
};
export namespace CreateDynamicSecretEngineRequest {
    export enum engine_type {
        POSTGRES = 'postgres',
        MYSQL = 'mysql',
        AWS_IAM = 'aws-iam',
        AZURE_SP = 'azure-sp',
    }
}

