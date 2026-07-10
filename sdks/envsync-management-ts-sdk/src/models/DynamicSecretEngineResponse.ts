/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type DynamicSecretEngineResponse = {
    id: string;
    org_id: string;
    engine_type: DynamicSecretEngineResponse.engine_type;
    name: string;
    config: Record<string, any>;
    enabled: boolean;
    created_at: string;
    updated_at: string;
};
export namespace DynamicSecretEngineResponse {
    export enum engine_type {
        POSTGRES = 'postgres',
        MYSQL = 'mysql',
        AWS_IAM = 'aws-iam',
        AZURE_SP = 'azure-sp',
    }
}

