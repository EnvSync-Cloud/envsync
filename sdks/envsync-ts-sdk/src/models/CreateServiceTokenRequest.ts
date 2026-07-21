/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ServiceTokenPermissions } from './ServiceTokenPermissions';
export type CreateServiceTokenRequest = {
    name: string;
    app_id?: string;
    env_type_id?: string;
    permissions?: ServiceTokenPermissions;
    expires_in_days?: number;
};

