/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type BatchCreateSecretsRequest = {
    app_id: string;
    env_type_id: string;
    envs: Array<{
        key: string;
        value: string;
    }>;
};

