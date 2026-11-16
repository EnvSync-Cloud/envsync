/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ExportEnvRequest = {
    app_id?: string;
    app_name?: string;
    env_type_id?: string;
    env_type_name?: string;
    env_type?: string;
    enable_secrets?: ExportEnvRequest.enable_secrets;
    is_secret_managed?: ExportEnvRequest.is_secret_managed;
    private_key?: string;
};
export namespace ExportEnvRequest {
    export enum enable_secrets {
        AUTO = 'auto',
        TRUE = 'true',
        FALSE = 'false',
    }
    export enum is_secret_managed {
        AUTO = 'auto',
        TRUE = 'true',
        FALSE = 'false',
    }
}

