/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateRotationPolicyRequest = {
    app_id: string;
    env_type_id: string;
    variable_key: string;
    engine_type: CreateRotationPolicyRequest.engine_type;
    schedule_cron: string;
    dual_window_minutes?: number;
    enabled?: boolean;
    connection_config: Record<string, any>;
};
export namespace CreateRotationPolicyRequest {
    export enum engine_type {
        POSTGRES = 'postgres',
        MYSQL = 'mysql',
        MONGODB = 'mongodb',
        AWS_IAM = 'aws-iam',
    }
}

