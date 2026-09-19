/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ServiceTokenPermissions } from './ServiceTokenPermissions';
import type { ServiceTokenScope } from './ServiceTokenScope';
export type CreateServiceTokenRequest = {
    name: string;
    app_id?: string;
    env_type_id?: string;
    permissions?: ServiceTokenPermissions;
    scopes?: Array<ServiceTokenScope>;
    expires_in_days?: number;
};

