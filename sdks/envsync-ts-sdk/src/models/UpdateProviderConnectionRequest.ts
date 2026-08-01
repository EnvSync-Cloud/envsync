/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateProviderConnectionRequest = {
    name?: string;
    status?: UpdateProviderConnectionRequest.status;
    auth_config?: Record<string, any>;
    metadata?: Record<string, any>;
};
export namespace UpdateProviderConnectionRequest {
    export enum status {
        ACTIVE = 'active',
        INACTIVE = 'inactive',
        ERROR = 'error',
    }
}

