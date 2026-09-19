/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RotationPolicyResponse = {
    id: string;
    org_id: string;
    app_id: string;
    env_type_id: string;
    variable_key: string;
    engine_type: RotationPolicyResponse.engine_type;
    schedule_cron: string;
    dual_window_minutes: number;
    enabled: boolean;
    last_rotated_at: string | null;
    next_rotation_at: string | null;
    created_at: string;
    updated_at: string;
};
export namespace RotationPolicyResponse {
    export enum engine_type {
        POSTGRES = 'postgres',
        MYSQL = 'mysql',
        MONGODB = 'mongodb',
        AWS_IAM = 'aws-iam',
    }
}

